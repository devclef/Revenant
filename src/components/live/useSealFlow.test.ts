/**
 * Tests for the sealing hook (useSealFlow.ts). The project has no DOM test
 * library, so the hook runs inside a capture component rendered with
 * renderToStaticMarkup. The handlers returned from that render are then called
 * directly. The passkey port and the routes are fakes, loaded and built here
 * with dynamic imports (import-boundary.test.ts forbids a static crypto import).
 */

import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { CryptoModule } from "./crypto-module";
import type { PrepareResult, SealApi, SealPostResult } from "./api";
import type { SealDeps, SealDraft } from "./seal-runner";
import { useSealFlow, type SealFlow } from "./useSealFlow";
import { catalogueMetric, makeFigures } from "./test-figures";
import { encodeBase64url } from "@/lib/seal-format";

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

function draft(): SealDraft {
  return {
    text: "A short note.",
    metricIds: ["us-gasoline-regular"],
    figures: makeFigures([
      {
        metric: catalogueMetric("us-gasoline-regular"),
        figures: [{ period: "2026-10-26", value: "3.412" }],
      },
    ]),
  };
}

async function buildDeps(fakeConfig: Parameters<typeof import("@/lib/crypto/testing/fake-authenticator").createFakeAuthenticator>[0] = {}) {
  const crypto = await import("@/lib/crypto");
  const { createFakeAuthenticator } = await import("@/lib/crypto/testing/fake-authenticator");
  const fake = createFakeAuthenticator(fakeConfig);
  const createSpy = vi.fn(fake.create);
  const getSpy = vi.fn(fake.get);
  const port = {
    isAvailable: () => fake.isAvailable(),
    create: createSpy,
    get: getSpy,
  };
  const api = {
    prepare: vi.fn(async () => PREPARED),
    seal: vi.fn(async () => SEALED),
  };
  const deps: SealDeps = {
    crypto: crypto as CryptoModule,
    port,
    api: api as unknown as SealApi,
    rpId: "localhost",
    now: () => T0,
  };
  return { deps, createSpy, getSpy, api };
}

/** Renders the hook once and returns the handlers it produced. */
function mount(deps: SealDeps | null, d: SealDraft): SealFlow {
  let captured: SealFlow | undefined;
  function Capture() {
    captured = useSealFlow(deps, d);
    return null;
  }
  renderToStaticMarkup(createElement(Capture));
  if (captured === undefined) throw new Error("hook did not render");
  return captured;
}

/** Lets queued promise callbacks run. */
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** Polls until the condition holds. WebCrypto needs several macrotasks to seal. */
async function waitUntil(condition: () => boolean): Promise<void> {
  for (let i = 0; i < 500 && !condition(); i++) await flush();
}

/**
 * Repeats a press after each macrotask until `done` holds. The hook refuses a
 * press while the previous step is still in flight, so under load the first
 * press can land too early. Retrying makes the test wait for the step, not for
 * a fixed number of ticks.
 */
async function pressUntil(press: () => void, done: () => boolean): Promise<void> {
  for (let i = 0; i < 500 && !done(); i++) {
    press();
    await flush();
  }
}

describe("useSealFlow double-press guard", () => {
  it("a second Create_Press before the first resolves starts one passkey prompt", async () => {
    const { deps, createSpy } = await buildDeps();
    const flow = mount(deps, draft());
    flow.onCreatePress();
    flow.onCreatePress();
    await flush();
    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  it("a second Confirm_Press before the first resolves starts one confirm and one seal", async () => {
    const { deps, createSpy, getSpy, api } = await buildDeps();
    const flow = mount(deps, draft());
    flow.onCreatePress();
    await waitUntil(() => createSpy.mock.calls.length > 0);
    await pressUntil(() => flow.onConfirmPress(), () => getSpy.mock.calls.length > 0);
    flow.onConfirmPress();
    await waitUntil(() => api.seal.mock.calls.length > 0);
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(getSpy).toHaveBeenCalledTimes(1);
    expect(api.prepare).toHaveBeenCalledTimes(1);
    expect(api.seal).toHaveBeenCalledTimes(1);
  });

  it("Confirm_Press before a passkey exists starts no prompt", async () => {
    const { deps, createSpy, getSpy } = await buildDeps();
    const flow = mount(deps, draft());
    flow.onConfirmPress();
    await flush();
    expect(createSpy).not.toHaveBeenCalled();
    expect(getSpy).not.toHaveBeenCalled();
  });

  it("presses do nothing while the crypto module is not loaded", async () => {
    const { createSpy } = await buildDeps();
    const flow = mount(null, draft());
    flow.onCreatePress();
    await flush();
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("Retry after a cancelled passkey lets the judge press Create_Press again", async () => {
    const { deps, createSpy } = await buildDeps({ failure: "cancel_create" });
    const flow = mount(deps, draft());
    flow.onCreatePress();
    await waitUntil(() => createSpy.mock.calls.length > 0);
    await pressUntil(
      () => {
        flow.onRetry();
        flow.onCreatePress();
      },
      () => createSpy.mock.calls.length >= 2,
    );
    expect(createSpy).toHaveBeenCalledTimes(2);
  });

  it("the fallback handlers are no-op stubs and never call the crypto module", async () => {
    const { deps, createSpy, getSpy, api } = await buildDeps();
    const flow = mount(deps, draft());
    flow.onFallbackStart();
    flow.onFallbackSealPress();
    flow.onFallbackDecline();
    await flush();
    expect(createSpy).not.toHaveBeenCalled();
    expect(getSpy).not.toHaveBeenCalled();
    expect(api.prepare).not.toHaveBeenCalled();
    expect(flow.backupKeyText).toBeNull();
  });
});
