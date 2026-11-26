// Feature: 20-easier-sealing-and-receipts (Part C).
//
// The Seal_Button's click must reach the press handler synchronously. The
// passkey API has to be called in the same task as the click, or the browser
// drops the user activation. These tests check that no await or timer sits
// between the click and the spies.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import {
  createPressController,
  type PressConfig,
  type PressController,
  type PressMode,
} from "../press/usePressEnvelope";
import type { CryptoModule } from "../crypto-module";
import type { PrepareResult, SealApi, SealPostResult } from "../api";
import type { SealDeps, SealDraft } from "../seal-runner";
import { useSealFlow, type SealFlow } from "../useSealFlow";
import { catalogueMetric, makeFigures } from "../test-figures";
import { encodeBase64url } from "@/lib/seal-format";

const here = dirname(fileURLToPath(import.meta.url));

function controllerWith(init: Partial<PressConfig>) {
  const config: PressConfig = {
    mode: "write",
    disabled: false,
    instant: false,
    onCreatePress: vi.fn(),
    onConfirmPress: vi.fn(),
    onAttempt: vi.fn(),
    ...init,
  };
  const controller = createPressController(
    () => config,
    () => undefined,
  );
  return { config, controller };
}

describe("Seal_Button click reaches the press synchronously", () => {
  it("calls onCreatePress in the same tick as activate(), with no await", () => {
    const { config, controller } = controllerWith({ mode: "write" });
    controller.activate();
    // No microtask or timer has run yet: the spy must already hold the call.
    expect(config.onCreatePress).toHaveBeenCalledTimes(1);
    expect(config.onConfirmPress).not.toHaveBeenCalled();
  });

  it("calls onConfirmPress in the same tick in the setting mode", () => {
    const { config, controller } = controllerWith({ mode: "setting" });
    controller.activate();
    expect(config.onConfirmPress).toHaveBeenCalledTimes(1);
    expect(config.onCreatePress).not.toHaveBeenCalled();
  });

  it("calls onAttempt synchronously and starts no prompt while blocked", () => {
    const { config, controller } = controllerWith({ disabled: true });
    controller.activate();
    expect(config.onAttempt).toHaveBeenCalledTimes(1);
    expect(config.onCreatePress).not.toHaveBeenCalled();
    expect(config.onConfirmPress).not.toHaveBeenCalled();
  });

  it("the Seal_Button's onClick is the press activate, with no wrapper", () => {
    const source = readFileSync(join(here, "SealButton.tsx"), "utf8");
    expect(source).toMatch(/onClick=\{onActivate\}/);
    expect(source).not.toMatch(/\basync\b/);
    expect(source).not.toMatch(/\bawait\b/);
    expect(source).not.toMatch(
      /setTimeout|requestAnimationFrame|queueMicrotask/,
    );
  });

  it("the press hook passes activate through without a promise", () => {
    const source = readFileSync(
      join(here, "..", "press", "usePressEnvelope.ts"),
      "utf8",
    );
    const activate = /activate\(\) \{[\s\S]*?\n {4}\},/.exec(source)?.[0] ?? "";
    expect(activate).not.toBe("");
    expect(activate).not.toMatch(/\bawait\b|\basync\b|Promise|setTimeout/);
  });
});

// --- Seal_Button click into useSealFlow, with spy crypto -------------------

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
  envelopeHash: "a".repeat(64),
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

/** Fake port and fake routes. The crypto module is loaded dynamically (import-boundary rule). */
async function buildDeps() {
  const crypto = await import("@/lib/crypto");
  const { createFakeAuthenticator } =
    await import("@/lib/crypto/testing/fake-authenticator");
  const fake = createFakeAuthenticator({});
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

/**
 * The crypto module with `createPasskey` and `confirmPasskey` replaced by spies.
 * Each spy delegates to the real function, so the port and the routes stay fake.
 */
async function syncDeps() {
  const built = await buildDeps();
  const real = built.deps.crypto;
  const createPasskeySpy = vi.fn(real.createPasskey);
  const confirmPasskeySpy = vi.fn(real.confirmPasskey);
  const crypto = {
    ...real,
    createPasskey: createPasskeySpy,
    confirmPasskey: confirmPasskeySpy,
  } as unknown as CryptoModule;
  return {
    ...built,
    createPasskeySpy,
    confirmPasskeySpy,
    deps: { ...built.deps, crypto },
  };
}

/** Renders the hook once and returns the handlers it produced. */
function mount(deps: SealDeps, d: SealDraft): SealFlow {
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
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Polls until the condition holds. WebCrypto needs several macrotasks to seal. */
async function waitUntil(condition: () => boolean): Promise<void> {
  for (let i = 0; i < 500 && !condition(); i++) await flush();
}

/** Repeats a press after each macrotask until `done` holds. */
async function pressUntil(
  press: () => void,
  done: () => boolean,
): Promise<void> {
  for (let i = 0; i < 500 && !done(); i++) {
    press();
    await flush();
  }
}

/**
 * A Seal_Button controller in the given mode, wired to the flow's press
 * handlers the way SealStep wires them. The press model takes one ACTIVATE per
 * RESET, so the test resets it before each click.
 */
function sealButtonFor(flow: SealFlow, mode: PressMode): PressController {
  return createPressController(
    () => ({
      mode,
      disabled: false,
      instant: false,
      onCreatePress: flow.onCreatePress,
      onConfirmPress: flow.onConfirmPress,
    }),
    () => undefined,
  );
}

type CallCounter = { mock: { calls: unknown[] } };

/**
 * Clicks until the click itself reaches the spy, and returns how many spy calls
 * that click made before it returned. A flow that refuses the press makes no
 * call, so the loop tries again after a macrotask.
 */
async function clickUntilPrompt(
  controller: PressController,
  spy: CallCounter,
): Promise<number> {
  for (let i = 0; i < 500; i++) {
    controller.reset();
    const before = spy.mock.calls.length;
    controller.activate();
    const started = spy.mock.calls.length - before;
    if (started > 0) return started;
    await flush();
  }
  return 0;
}

describe("Seal_Button click into useSealFlow with spy crypto (synchronous prompt)", () => {
  it("write mode: one click calls createPasskey before the click returns", async () => {
    const { deps, createPasskeySpy } = await syncDeps();
    const flow = mount(deps, draft());
    const write = sealButtonFor(flow, "write");
    write.activate();
    // No await between the click and this check.
    expect(createPasskeySpy).toHaveBeenCalledTimes(1);
    await flush();
    expect(createPasskeySpy).toHaveBeenCalledTimes(1);
  });

  it("setting mode: one click calls confirmPasskey before the click returns", async () => {
    const { deps, createPasskeySpy, confirmPasskeySpy } = await syncDeps();
    const flow = mount(deps, draft());
    const write = sealButtonFor(flow, "write");
    const setting = sealButtonFor(flow, "setting");
    expect(await clickUntilPrompt(write, createPasskeySpy)).toBe(1);
    // The flow is in `created` only once createPasskey resolves, so the setting
    // click may be refused at first. The one that starts the prompt makes its
    // call synchronously, and that is what the count reports.
    expect(await clickUntilPrompt(setting, confirmPasskeySpy)).toBe(1);
    expect(confirmPasskeySpy).toHaveBeenCalledTimes(1);
    expect(createPasskeySpy).toHaveBeenCalledTimes(1);
  });

  it("two create and two confirm clicks give one create and at most one get", async () => {
    const { deps, createSpy, getSpy, api } = await buildDeps();
    const flow = mount(deps, draft());
    const write = sealButtonFor(flow, "write");
    const setting = sealButtonFor(flow, "setting");

    write.activate();
    write.reset();
    write.activate();
    await waitUntil(() => createSpy.mock.calls.length > 0);
    await flush();
    expect(createSpy).toHaveBeenCalledTimes(1);

    await pressUntil(
      () => {
        setting.reset();
        setting.activate();
        setting.reset();
        setting.activate();
      },
      () => getSpy.mock.calls.length > 0,
    );
    await waitUntil(() => api.seal.mock.calls.length > 0);
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(getSpy.mock.calls.length).toBeLessThanOrEqual(1);
  });
});
