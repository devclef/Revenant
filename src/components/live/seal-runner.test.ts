/**
 * Tests for the sealing runner (seal-runner.ts). They drive the real crypto
 * module and the fake authenticator, loaded with dynamic imports so this file
 * does not import the crypto barrel statically (import-boundary.test.ts). The
 * routes are stubbed through a fake SealApi that logs every call, so each test
 * can assert the order of the prompts and the requests.
 */

import { describe, it, expect, vi } from "vitest";

import type { CryptoModule } from "./crypto-module";
import type { PrepareResult, SealApi, SealPostResult } from "./api";
import { encodeBase64url } from "@/lib/seal-format";
import { catalogueMetric, makeFigures } from "./test-figures";
import {
  pressConfirm,
  pressCreate,
  sealWithBackupKey,
  sealWithPasskey,
  type SealDeps,
  type SealDraft,
  type Confirmed,
} from "./seal-runner";

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
  envelopeHash: "b".repeat(64),
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

interface Harness {
  deps: SealDeps;
  log: string[];
  api: { prepare: ReturnType<typeof vi.fn>; seal: ReturnType<typeof vi.fn> };
  fake: Awaited<ReturnType<typeof makeFake>>;
}

async function makeFake(config: Parameters<typeof import("@/lib/crypto/testing/fake-authenticator").createFakeAuthenticator>[0]) {
  const { createFakeAuthenticator } = await import("@/lib/crypto/testing/fake-authenticator");
  return createFakeAuthenticator(config);
}

async function makeHarness(options: {
  fake?: Parameters<typeof import("@/lib/crypto/testing/fake-authenticator").createFakeAuthenticator>[0];
  prepare?: PrepareResult;
  seal?: SealPostResult;
  cryptoPatch?: Partial<CryptoModule>;
  metricIds?: string[];
} = {}): Promise<Harness & { draft: SealDraft }> {
  const crypto = await import("@/lib/crypto");
  const fake = await makeFake(options.fake ?? {});
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
    crypto: { ...crypto, ...(options.cryptoPatch ?? {}) } as CryptoModule,
    port,
    api: api as unknown as SealApi,
    rpId: "localhost",
    now: () => T0,
  };

  const draft = goodDraft();
  if (options.metricIds) draft.metricIds = options.metricIds;
  return { deps, log, api, fake, draft };
}

/** Runs the whole flow with the real passkey steps and returns the result. */
async function runFlow(h: Harness & { draft: SealDraft }, onPrepared?: () => void) {
  const created = await pressCreate(h.deps);
  if (!created.ok) return { created };
  const confirmed = await pressConfirm(h.deps, created.created);
  if (!confirmed.ok) return { created, confirmed };
  const outcome = await sealWithPasskey(h.deps, {
    draft: h.draft,
    confirmed: confirmed.confirmed as Confirmed,
    ...(onPrepared ? { onPrepared } : {}),
  });
  return { created, confirmed, outcome };
}

describe("pressCreate and pressConfirm are pass-throughs", () => {
  it("calls createPasskey synchronously, before any await", async () => {
    const crypto = await import("@/lib/crypto");
    const spy = vi.fn(crypto.createPasskey);
    const h = await makeHarness({ cryptoPatch: { createPasskey: spy as CryptoModule["createPasskey"] } });
    const pending = pressCreate(h.deps);
    expect(spy).toHaveBeenCalledTimes(1);
    await pending;
  });

  it("calls confirmPasskey synchronously, before any await", async () => {
    const crypto = await import("@/lib/crypto");
    const spy = vi.fn(crypto.confirmPasskey);
    const h = await makeHarness({ cryptoPatch: { confirmPasskey: spy as CryptoModule["confirmPasskey"] } });
    const created = await pressCreate(h.deps);
    if (!created.ok) throw new Error("create should pass");
    const pending = pressConfirm(h.deps, created.created);
    expect(spy).toHaveBeenCalledTimes(1);
    await pending;
  });
});

describe("the step order in R15.1", () => {
  it("runs create, get, prepare, then seal, and no request comes before both prompts", async () => {
    const h = await makeHarness();
    const onPrepared = vi.fn(() => h.log.push("onPrepared"));
    const { outcome } = await runFlow(h, onPrepared);
    expect(h.log).toEqual(["create", "get", "prepare", "onPrepared", "seal"]);
    expect(onPrepared).toHaveBeenCalledTimes(1);
    expect(outcome?.ok).toBe(true);
    if (outcome?.ok) {
      expect(outcome.event).toMatchObject({
        type: "SEALED",
        letterId: SEALED.ok ? SEALED.letterId : "",
        factors: "passkey",
        offsetMs: 0,
        // The SEALED event carries the Fingerprint the server echoed, so the
        // card shows the same value the Reveal verifies (R14.4, Property 16).
        envelopeHash: SEALED.ok ? SEALED.envelopeHash : "",
      });
    }
  });

  it("sends the envelope and its hash to the seal route", async () => {
    const h = await makeHarness();
    await runFlow(h);
    const body = h.api.seal.mock.calls[0]?.[0] as { letterId: string; envelope: unknown; envelopeHash: string };
    expect(body.letterId).toBe(PREPARED.ok ? PREPARED.letterId : "");
    expect(typeof body.envelopeHash).toBe("string");
    expect(body.envelopeHash.length).toBeGreaterThan(0);
    expect(body.envelope).toBeTruthy();
  });

  it("offsets the seal times by the server clock difference", async () => {
    const h = await makeHarness({
      prepare: { ...PREPARED, ok: true, serverNow: "2026-11-02T10:00:05.000Z" } as PrepareResult,
    });
    const { outcome } = await runFlow(h);
    expect(outcome?.ok && outcome.event.offsetMs).toBe(5000);
  });
});

describe("a failure at either prompt makes no route call", () => {
  it.each([
    ["the create prompt is cancelled", { failure: "cancel_create" as const }, "CANCELLED"],
    ["the confirm prompt is cancelled", { failure: "cancel_get" as const }, "CANCELLED"],
    ["the create prompt fails", { failure: "error_create" as const }, "CANNOT_LOCK"],
    ["the confirm prompt fails", { failure: "error_get" as const }, "CANNOT_LOCK"],
    ["the authenticator is unavailable", { available: false }, "CANNOT_LOCK"],
    ["the PRF output is missing at confirm", { getPrf: "none" as const }, "CANNOT_LOCK"],
    ["the PRF output is short at confirm", { getPrf: "short" as const }, "CANNOT_LOCK"],
    ["the PRF output mismatches at confirm", { getPrf: "mismatch" as const }, "CANNOT_LOCK"],
  ])("%s: no prepare and no seal", async (_label, fakeConfig, expected) => {
    const h = await makeHarness({ fake: fakeConfig });
    const { created, confirmed, outcome } = await runFlow(h);
    expect(h.api.prepare).not.toHaveBeenCalled();
    expect(h.api.seal).not.toHaveBeenCalled();
    const event = outcome?.ok === false ? outcome.event : (confirmed && !confirmed.ok ? confirmed.event : created && !created.ok ? created.event : null);
    expect(event?.type).toBe(expected);
  });

  it("reports passkeyCreated false when create itself is unavailable", async () => {
    const h = await makeHarness({ fake: { available: false } });
    const created = await pressCreate(h.deps);
    expect(created).toEqual({ ok: false, event: { type: "CANNOT_LOCK", passkeyCreated: false } });
  });

  it("reports passkeyCreated true when confirm fails after create", async () => {
    const h = await makeHarness({ fake: { getPrf: "none" } });
    const { confirmed } = await runFlow(h);
    expect(confirmed).toEqual({ ok: false, event: { type: "CANNOT_LOCK", passkeyCreated: true } });
  });
});

describe("failures after prepare", () => {
  it("prepare busy gives busy and no seal", async () => {
    const h = await makeHarness({ prepare: { ok: false, kind: "busy" } });
    const { outcome } = await runFlow(h);
    expect(outcome).toEqual({ ok: false, event: { type: "FAILED", kind: "busy", passkeyCreated: true } });
    expect(h.api.seal).not.toHaveBeenCalled();
  });

  it("prepare network error gives network", async () => {
    const h = await makeHarness({ prepare: { ok: false, kind: "network" } });
    const { outcome } = await runFlow(h);
    expect(outcome).toEqual({ ok: false, event: { type: "FAILED", kind: "network", passkeyCreated: true } });
  });

  it("a missing then figure gives missing_then with the metric ID and no seal", async () => {
    const h = await makeHarness({ metricIds: ["us-diesel"] });
    const { outcome } = await runFlow(h);
    expect(outcome).toEqual({
      ok: false,
      event: { type: "FAILED", kind: "missing_then", metricId: "us-diesel", passkeyCreated: true },
    });
    expect(h.api.prepare).toHaveBeenCalledTimes(1);
    expect(h.api.seal).not.toHaveBeenCalled();
  });

  it("seal busy (429) gives busy", async () => {
    const h = await makeHarness({ seal: { ok: false, kind: "busy" } });
    const { outcome } = await runFlow(h);
    expect(outcome).toEqual({ ok: false, event: { type: "FAILED", kind: "busy", passkeyCreated: true } });
  });

  it("seal clock mismatch (422) gives clock", async () => {
    const h = await makeHarness({ seal: { ok: false, kind: "clock" } });
    const { outcome } = await runFlow(h);
    expect(outcome).toEqual({ ok: false, event: { type: "FAILED", kind: "clock", passkeyCreated: true } });
  });

  it("a failed wrap check gives cannot_lock with passkeyCreated true and no seal", async () => {
    const crypto = await import("@/lib/crypto");
    const wrapFailing = {
      sealLetter: async () => {
        throw crypto.SealError.wrapFailed();
      },
    } as Partial<CryptoModule>;
    const h = await makeHarness({ cryptoPatch: wrapFailing });
    const { outcome } = await runFlow(h);
    expect(outcome).toEqual({ ok: false, event: { type: "CANNOT_LOCK", passkeyCreated: true } });
    expect(h.api.seal).not.toHaveBeenCalled();
  });
});

describe("sealWithBackupKey", () => {
  async function runBackup(h: Harness & { draft: SealDraft }) {
    const crypto = await import("@/lib/crypto");
    const backupKey = crypto.generateBackupKey();
    const outcome = await sealWithBackupKey(h.deps, { draft: h.draft, backupKey });
    return { outcome, backupKey };
  }

  it("seals with a backup wrap only: factors is backup and no passkey is created", async () => {
    const h = await makeHarness();
    const { outcome } = await runBackup(h);
    expect(outcome).toEqual({
      ok: true,
      event: {
        type: "SEALED",
        letterId: SEALED.ok ? SEALED.letterId : "",
        sealedAt: SEALED.ok ? SEALED.sealedAt : "",
        opensAt: SEALED.ok ? SEALED.opensAt : "",
        offsetMs: 0,
        factors: "backup",
        envelopeHash: SEALED.ok ? SEALED.envelopeHash : "",
      },
    });
    expect(h.log).toEqual(["prepare", "seal"]);
  });

  it("sends a header with one backup Backup_Wrap and no rpId, credentialId or prfSalt", async () => {
    const h = await makeHarness();
    await runBackup(h);
    const body = h.api.seal.mock.calls[0]?.[0] as {
      envelope: {
        wrappedDeks: { factor: string }[];
        rpId?: unknown;
        credentialId?: unknown;
        prfSalt?: unknown;
      };
    };
    expect(body.envelope.wrappedDeks.map((w) => w.factor)).toEqual(["backup"]);
    expect(body.envelope).not.toHaveProperty("rpId");
    expect(body.envelope).not.toHaveProperty("credentialId");
    expect(body.envelope).not.toHaveProperty("prfSalt");
  });

  it("does not zero the backup key, so the card can still show it", async () => {
    const h = await makeHarness();
    const { backupKey } = await runBackup(h);
    expect(Array.from(backupKey).some((b) => b !== 0)).toBe(true);
  });

  it("calls onPrepared once the prepare request has answered", async () => {
    const h = await makeHarness();
    const crypto = await import("@/lib/crypto");
    const onPrepared = vi.fn(() => h.log.push("onPrepared"));
    await sealWithBackupKey(h.deps, {
      draft: h.draft,
      backupKey: crypto.generateBackupKey(),
      onPrepared,
    });
    expect(h.log).toEqual(["prepare", "onPrepared", "seal"]);
    expect(onPrepared).toHaveBeenCalledTimes(1);
  });

  it("a prepare failure reports passkeyCreated false and makes no seal call", async () => {
    const h = await makeHarness({ prepare: { ok: false, kind: "network" } });
    const { outcome } = await runBackup(h);
    expect(outcome).toEqual({
      ok: false,
      event: { type: "FAILED", kind: "network", passkeyCreated: false },
    });
    expect(h.api.seal).not.toHaveBeenCalled();
  });

  it("a missing then figure reports missing_then with passkeyCreated false and no seal", async () => {
    const h = await makeHarness({ metricIds: ["us-diesel"] });
    const { outcome } = await runBackup(h);
    expect(outcome).toEqual({
      ok: false,
      event: { type: "FAILED", kind: "missing_then", metricId: "us-diesel", passkeyCreated: false },
    });
    expect(h.api.seal).not.toHaveBeenCalled();
  });

  it("a seal route clock mismatch reports clock with passkeyCreated false", async () => {
    const h = await makeHarness({ seal: { ok: false, kind: "clock" } });
    const { outcome } = await runBackup(h);
    expect(outcome).toEqual({
      ok: false,
      event: { type: "FAILED", kind: "clock", passkeyCreated: false },
    });
  });
});

describe("sealWithPasskey with the optional backup wrap (R21.1)", () => {
  /** Runs the passkey steps, then seals with a generated backup key. */
  async function runWithBackup(h: Harness & { draft: SealDraft }) {
    const crypto = await import("@/lib/crypto");
    const backupKey = crypto.generateBackupKey();
    const created = await pressCreate(h.deps);
    if (!created.ok) throw new Error("create failed");
    const confirmed = await pressConfirm(h.deps, created.created);
    if (!confirmed.ok) throw new Error("confirm failed");
    const outcome = await sealWithPasskey(h.deps, {
      draft: h.draft,
      confirmed: confirmed.confirmed as Confirmed,
      backupKey,
    });
    return { outcome, backupKey };
  }

  it("seals both wraps: factors is both, and the header has a backup wrap and a passkey wrap", async () => {
    const h = await makeHarness();
    const { outcome } = await runWithBackup(h);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) expect(outcome.event).toMatchObject({ type: "SEALED", factors: "both" });
    const body = h.api.seal.mock.calls[0]?.[0] as {
      envelope: { wrappedDeks: { factor: string }[]; rpId?: unknown };
    };
    expect(body.envelope.wrappedDeks.map((w) => w.factor)).toEqual(["backup", "passkey"]);
    expect(body.envelope).toHaveProperty("rpId");
  });

  it("does not zero the backup key, so the backup key card can still show it", async () => {
    const h = await makeHarness();
    const { backupKey } = await runWithBackup(h);
    expect(backupKey.some((byte) => byte !== 0)).toBe(true);
  });

  it("without a backup key the passkey seal keeps one passkey wrap and factors passkey", async () => {
    const h = await makeHarness();
    const { outcome } = await runFlow(h);
    if (outcome?.ok) expect(outcome.event).toMatchObject({ factors: "passkey" });
    const body = h.api.seal.mock.calls[0]?.[0] as { envelope: { wrappedDeks: { factor: string }[] } };
    expect(body.envelope.wrappedDeks.map((w) => w.factor)).toEqual(["passkey"]);
  });
});
