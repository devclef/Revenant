/**
 * The Sealing_Flow, end to end (spec 06-lock-and-unlock, R15.1, R15.6 to R15.8,
 * R15.10, R15.11 and R22.7). This test drives the real seal-runner.ts with the
 * fake Authenticator_Port and stub routes, then feeds every event the runner
 * emits through the pure reducer (sealReducer) and checks that the resulting
 * state maps to a message in LIVE_COPY. The crypto barrel is loaded with a
 * dynamic import so this file keeps the import boundary (import-boundary.test.ts).
 *
 * The runner and the reducer each have their own focused tests (seal-runner.
 * test.ts, seal-machine.test.ts). This file is the seam between them: it asserts
 * that the two agree on the flow the ticket names:
 *
 *   - call order: create, get, prepare, then seal, with no request before the
 *     two presses;
 *   - zero Seal_Route calls on each PRF_Check failure (R15.6);
 *   - the 429 busy, 422 clock and network messages (R15.8);
 *   - cancelled offering "Try again" and keeping the typed letter (R15.7);
 *   - the warning gate before the first press (R15.11, R22.7).
 */

import { describe, it, expect, vi } from "vitest";

import type { CryptoModule } from "./crypto-module";
import type { PrepareResult, SealApi, SealPostResult } from "./api";
import { encodeBase64url } from "@/lib/seal-format";
import { catalogueMetric, makeFigures } from "./test-figures";
import {
  pressConfirm,
  pressCreate,
  sealWithPasskey,
  type Confirmed,
  type SealDeps,
  type SealDraft,
} from "./seal-runner";
import {
  INITIAL_SEAL_STATE,
  sealReducer,
  type SealEvent,
  type SealState,
} from "./seal-machine";
import { LIVE_COPY } from "./copy";
import { validateWrite } from "./form";

const T0 = Date.parse("2026-11-02T10:00:00.000Z");

const PREPARED: PrepareResult = {
  ok: true,
  letterId: encodeBase64url(new Uint8Array(16)),
  serverSecret: encodeBase64url(new Uint8Array(32)),
  serverNow: "2026-11-02T10:00:00.000Z",
};

const SEALED: SealPostResult = {
  ok: true,
  letterId: encodeBase64url(new Uint8Array(16)),
  sealedAt: "2026-11-02T10:00:00.000Z",
  opensAt: "2026-11-02T10:00:30.000Z",
};

function goodDraft(): SealDraft {
  return {
    text: "A short note to my future self.",
    metricIds: ["us-gasoline-regular"],
    figures: makeFigures([
      {
        metric: catalogueMetric("us-gasoline-regular"),
        figures: [{ period: "2026-10-26", value: "3.412" }],
      },
    ]),
  };
}

type FakeConfig = Parameters<
  typeof import("@/lib/crypto/testing/fake-authenticator").createFakeAuthenticator
>[0];

interface Harness {
  deps: SealDeps;
  log: string[];
  api: { prepare: ReturnType<typeof vi.fn>; seal: ReturnType<typeof vi.fn> };
  draft: SealDraft;
}

async function makeHarness(options: {
  fake?: FakeConfig;
  prepare?: PrepareResult;
  seal?: SealPostResult;
  metricIds?: string[];
} = {}): Promise<Harness> {
  const crypto = await import("@/lib/crypto");
  const { createFakeAuthenticator } = await import("@/lib/crypto/testing/fake-authenticator");
  const fake = createFakeAuthenticator(options.fake ?? {});
  const log: string[] = [];

  const port = {
    isAvailable: () => fake.isAvailable(),
    create: (o: Parameters<typeof fake.create>[0]) => {
      log.push("create");
      return fake.create(o);
    },
    get: (o: Parameters<typeof fake.get>[0]) => {
      log.push("get");
      return fake.get(o);
    },
  };

  const api = {
    prepare: vi.fn(async () => {
      log.push("prepare");
      return options.prepare ?? PREPARED;
    }),
    seal: vi.fn(async () => {
      log.push("seal");
      return options.seal ?? SEALED;
    }),
  };

  const deps: SealDeps = {
    crypto: crypto as CryptoModule,
    port,
    api: api as unknown as SealApi,
    rpId: "localhost",
    now: () => T0,
  };

  const draft = goodDraft();
  if (options.metricIds) draft.metricIds = options.metricIds;
  return { deps, log, api, draft };
}

/**
 * Runs the whole flow the way the page would: each press is its own step, each
 * event the runner emits is fed to the reducer, and the final reducer state is
 * returned alongside the events and the call log.
 */
async function runFlow(h: Harness): Promise<{ state: SealState; events: SealEvent[] }> {
  const events: SealEvent[] = [];
  let state = INITIAL_SEAL_STATE;
  const send = (event: SealEvent) => {
    events.push(event);
    state = sealReducer(state, event);
  };

  send({ type: "CREATE_PRESS" });
  const created = await pressCreate(h.deps);
  if (!created.ok) {
    send(created.event);
    return { state, events };
  }
  send({ type: "CREATED" });

  send({ type: "CONFIRM_PRESS" });
  const confirmed = await pressConfirm(h.deps, created.created);
  if (!confirmed.ok) {
    send(confirmed.event);
    return { state, events };
  }
  send({ type: "CONFIRMED" });

  const outcome = await sealWithPasskey(h.deps, {
    draft: h.draft,
    confirmed: confirmed.confirmed as Confirmed,
    onPrepared: () => send({ type: "PREPARED" }),
  });
  send(outcome.event);
  return { state, events };
}

describe("the whole flow with a working passkey", () => {
  it("runs create, get, prepare, then seal and lands on the sealed state", async () => {
    const h = await makeHarness();
    const { state, events } = await runFlow(h);

    expect(h.log).toEqual(["create", "get", "prepare", "seal"]);
    expect(events.some((e) => e.type === "PREPARED")).toBe(true);
    expect(state.tag).toBe("sealed");
    if (state.tag === "sealed") {
      expect(state.factors).toBe("passkey");
      expect(state.opensAt).toBe(SEALED.ok ? SEALED.opensAt : "");
    }
  });

  it("makes no request until both presses have passed", async () => {
    const h = await makeHarness();
    // Before either press, the api is untouched.
    expect(h.api.prepare).not.toHaveBeenCalled();
    await runFlow(h);
    // The first request in the log is prepare, after both create and get.
    expect(h.log.indexOf("prepare")).toBeGreaterThan(h.log.indexOf("get"));
    expect(h.log.indexOf("get")).toBeGreaterThan(h.log.indexOf("create"));
  });
});

describe("each PRF_Check failure seals nothing and calls the Seal_Route zero times (R15.6)", () => {
  it.each<[string, FakeConfig]>([
    ["create fails", { failure: "error_create" }],
    ["confirm fails", { failure: "error_get" }],
    ["the authenticator is unavailable", { available: false }],
    ["no PRF at confirm", { getPrf: "none" }],
    ["short PRF at confirm", { getPrf: "short" }],
    ["mismatched PRF at confirm", { getPrf: "mismatch" }],
  ])("%s: no prepare, no seal, cannot_lock with a message", async (_label, fake) => {
    const h = await makeHarness({ fake });
    const { state } = await runFlow(h);

    expect(h.api.prepare).not.toHaveBeenCalled();
    expect(h.api.seal).not.toHaveBeenCalled();
    expect(state.tag).toBe("cannot_lock");
    // The cannot_lock screen has a plain title and body, and the fallback
    // control (R15.6).
    expect(LIVE_COPY.cannotLockTitle.length).toBeGreaterThan(0);
    expect(LIVE_COPY.cannotLockBody.length).toBeGreaterThan(0);
    expect(LIVE_COPY.fallbackButton).toContain("backup key");
  });
});

describe("a cancelled prompt offers Try again and keeps the letter (R15.7)", () => {
  it.each<[string, FakeConfig]>([
    ["the create prompt is cancelled", { failure: "cancel_create" }],
    ["the confirm prompt is cancelled", { failure: "cancel_get" }],
  ])("%s: lands on cancelled, and RETRY returns to write", async (_label, fake) => {
    const h = await makeHarness({ fake });
    const { state } = await runFlow(h);

    expect(h.api.seal).not.toHaveBeenCalled();
    expect(state.tag).toBe("cancelled");
    // "Try again" restarts from the Create_Press: the reducer goes back to the
    // write step, where the typed letter and chosen series still live.
    const afterRetry = sealReducer(state, { type: "RETRY" });
    expect(afterRetry.tag).toBe("write");
    expect(LIVE_COPY.tryAgain).toBe("Try again");
    expect(LIVE_COPY.cancelledTitle.length).toBeGreaterThan(0);
  });
});

describe("the route failures carry the right message (R15.8)", () => {
  it("prepare 429 busy gives the busy message and no seal", async () => {
    const h = await makeHarness({ prepare: { ok: false, kind: "busy" } });
    const { state } = await runFlow(h);
    expect(h.api.seal).not.toHaveBeenCalled();
    expect(state).toMatchObject({ tag: "failed", kind: "busy" });
    expect(LIVE_COPY.busyBody).toContain("busy");
    expect(LIVE_COPY.busyBody).toContain("Nothing was sealed");
  });

  it("seal 429 busy gives the busy message", async () => {
    const h = await makeHarness({ seal: { ok: false, kind: "busy" } });
    const { state } = await runFlow(h);
    expect(state).toMatchObject({ tag: "failed", kind: "busy" });
  });

  it("seal 422 clock gives the clock message", async () => {
    const h = await makeHarness({ seal: { ok: false, kind: "clock" } });
    const { state } = await runFlow(h);
    expect(state).toMatchObject({ tag: "failed", kind: "clock" });
    expect(LIVE_COPY.clockBody).toContain("clock");
    expect(LIVE_COPY.clockBody).toContain("Nothing was sealed");
  });

  it("a prepare network error gives the failed message", async () => {
    const h = await makeHarness({ prepare: { ok: false, kind: "network" } });
    const { state } = await runFlow(h);
    expect(state).toMatchObject({ tag: "failed", kind: "network" });
    expect(LIVE_COPY.failedBody).toContain("not sealed");
  });

  it("a seal network error gives the failed message", async () => {
    const h = await makeHarness({ seal: { ok: false, kind: "network" } });
    const { state } = await runFlow(h);
    expect(state).toMatchObject({ tag: "failed", kind: "network" });
  });
});

describe("the warning gate before the first press (R15.11, R22.7)", () => {
  it("an unticked warning blocks the write and names the warning problem", () => {
    const problems = validateWrite({
      text: "A short note.",
      metricIds: ["us-gasoline-regular"],
      warningTicked: false,
    });
    expect(problems).toContain("warning_unticked");
    expect(LIVE_COPY.warningUnticked.length).toBeGreaterThan(0);
  });

  it("a ticked warning with a valid write passes the gate", () => {
    const problems = validateWrite({
      text: "A short note.",
      metricIds: ["us-gasoline-regular"],
      warningTicked: true,
    });
    expect(problems).toEqual([]);
  });

  it("the warning is plain and unmissable, not softened (R15.3, R19.3)", () => {
    expect(LIVE_COPY.warning).toContain("can never be opened");
    expect(LIVE_COPY.warning).not.toContain("!");
    expect(LIVE_COPY.warningLabel).toContain("can never be opened");
  });
});
