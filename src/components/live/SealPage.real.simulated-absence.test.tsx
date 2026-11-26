/**
 * Requirement 13 (spec 20, Part B): Simulated_Mode is never on `/seal`.
 *
 * Every Real_Mode pair from `PAIRS` (spec 19's SealPage.real.test.tsx) is
 * rendered three ways: with no simulated value, with a simulated prop, and with
 * simulated values in deps and in the draft. None of the renders may show a
 * Simulate_Control or any Simulated_Mode string. PAIRS must keep at least the
 * entries it had at commit c2bf2db8, so the table cannot shrink unnoticed.
 *
 * The page never reads these values in Real_Mode. The renders also check that
 * the Simulated_Port factory is never called on a Real_Mode render, through a
 * spy on the crypto module that a real page would load.
 */

import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { encodeBase64url } from "@/lib/seal-format";

import type { CryptoModule } from "./crypto-module";
import type { PrepareResult, SealApi, SealPostResult } from "./api";
import { LIVE_COPY } from "./copy";
import { PRESS_COPY } from "./press/copy";
import type { SealDeps, SealDraft } from "./seal-runner";
import { catalogueMetric, makeFigures } from "./test-figures";
import type { SealFlow } from "./useSealFlow";
import { PAIRS } from "./SealPage.real.test";
import type { SealState } from "./seal-machine";
import type { StepperStep } from "./stepper/live-steps";
import { SealPage } from "./SealPage";

// The Real_Mode static render, with the same mocks SealPage.real.test uses.
// It takes the extra props of the simulated inputs, which the shared helper
// does not.
const stub = vi.hoisted(() => ({
  flowState: { tag: "write" } as import("./seal-machine").SealState,
  step: null as null | import("./stepper/live-steps").StepperStep,
  keyText: "test-backup-key" as string | null,
  crypto: { browserAuthenticatorPort: {} },
}));

vi.mock("./useSealFlow", () => ({
  useSealFlow: () => ({
    state: stub.flowState,
    onCreatePress: () => {},
    onConfirmPress: () => {},
    onFallbackStart: () => {},
    onFallbackSealPress: () => {},
    onFallbackDecline: () => {},
    onRetry: () => {},
    getBackupKeyText: () => stub.keyText,
  }),
}));

vi.mock("./useCryptoModule", () => ({
  useCryptoModule: () => stub.crypto,
}));

vi.mock("./prf-hint", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./prf-hint")>()),
  usePrfHint: () => "missing",
}));

vi.mock("@/components/reveal/figures-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/reveal/figures-api")>()),
  useFigures: () => ({ status: "loading" }),
}));

vi.mock("./stepper/LiveStepper", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./stepper/LiveStepper")>();
  return {
    ...actual,
    LiveStepper: (props: import("./stepper/LiveStepper").LiveStepperProps) => {
      if (stub.step === null) return actual.LiveStepper(props);
      return actual.LiveStepper({
        ...props,
        state: {
          ...props.state,
          step: stub.step,
          sealed: stub.step === "sealed",
        },
      });
    },
  };
});

const BASE = {
  rpId: "revenant.devclef.se",
  appOrigin: "https://revenant.devclef.se",
  mode: "real" as const,
};

function renderReal(
  step: StepperStep,
  state: SealState,
  extra: Record<string, unknown> = {},
): string {
  stub.step = step;
  stub.flowState = state;
  try {
    return renderToStaticMarkup(
      createElement(SealPage, { ...BASE, ...extra } as never),
    );
  } finally {
    stub.step = null;
    stub.flowState = { tag: "write" };
  }
}

/** PAIRS had 13 entries at commit c2bf2db8. It may grow, never shrink. */
const BASELINE_PAIR_COUNT = 13;

/** The text as React writes it into markup, so apostrophes match their escaped form. */
function escapedForMarkup(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** Every Simulated_Mode string in the copy tables, by key, as markup text. */
const SIMULATED_STRINGS: readonly string[] = [
  ...Object.entries(LIVE_COPY),
  ...Object.entries(PRESS_COPY),
]
  .filter(([key]) => /simulat/i.test(key))
  .map(([, value]) => escapedForMarkup(String(value)));

/** Requirement 13.1 names these; the list is also every key with "simulat" in it. */
const REQUIRED_STRINGS: readonly string[] = [
  LIVE_COPY.simulateLabel,
  LIVE_COPY.simulatedNotice,
  LIVE_COPY.simulatedBackupRequired,
  LIVE_COPY.simulatedKeyReminder,
  PRESS_COPY.sealButtonCreateSimulated,
];

/** The renders in which a Real_Mode page is handed a simulated value. */
const SIMULATED_INPUTS: ReadonlyArray<{ name: string; extra: Record<string, unknown> }> = [
  { name: "no simulated value", extra: {} },
  { name: "simulated prop", extra: { simulated: true } },
  { name: "deps.simulated", extra: { deps: { simulated: true } } },
  { name: "draft simulated", extra: { draft: { simulated: true } } },
];

describe("Real_Mode renders no Simulated_Mode control or string (Requirement 13.1, 13.2)", () => {
  it("keeps at least the baseline number of pairs", () => {
    expect(PAIRS.length).toBeGreaterThanOrEqual(BASELINE_PAIR_COUNT);
  });

  it("holds every required Simulated_Mode string in the copy tables", () => {
    for (const text of REQUIRED_STRINGS) {
      expect(text.length).toBeGreaterThan(0);
      expect(SIMULATED_STRINGS).toContain(escapedForMarkup(text));
    }
  });

  for (const pair of PAIRS) {
    for (const input of SIMULATED_INPUTS) {
      it(`${pair.name}, ${input.name}: no Simulate_Control and no Simulated_Mode string`, () => {
        const html = renderReal(pair.step, pair.state, input.extra);
        expect(html).not.toContain("data-simulate-control");
        expect(html).not.toContain("data-simulated-notice");
        for (const text of SIMULATED_STRINGS) {
          expect(html, text).not.toContain(text);
        }
      });
    }
  }
});

/**
 * A driven Real_Mode run (Requirement 17.2 f). The hook is mounted with the same
 * crypto stub mechanism as useSealFlow.test.ts: the real crypto barrel, a fake
 * passkey authenticator, and fake routes. The barrel's createSimulatedPort is
 * replaced with a spy. The run covers a passkey seal with both presses, a
 * cancelled create followed by a retry, and a backup-only seal. The spy must
 * never be called.
 *
 * SealPage.real.test mocks ./useSealFlow for the static renders above. This
 * block loads the real hook with vi.importActual, so the mock does not apply.
 */

type FakeConfig = Parameters<
  typeof import("@/lib/crypto/testing/fake-authenticator").createFakeAuthenticator
>[0];

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

function realDraft(): SealDraft {
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

/** Deps for one run: the real barrel with a spied createSimulatedPort, and fake passkey and routes. */
async function realRunDeps(config: FakeConfig = {}) {
  const crypto = await import("@/lib/crypto");
  const { createFakeAuthenticator } = await import("@/lib/crypto/testing/fake-authenticator");
  const fake = createFakeAuthenticator(config);
  const simulatedPortSpy = vi.fn(crypto.createSimulatedPort);
  const createSpy = vi.fn(fake.create);
  const getSpy = vi.fn(fake.get);
  const api = {
    prepare: vi.fn(async () => PREPARED),
    seal: vi.fn(async () => SEALED),
  };
  const cryptoStub = { ...crypto, createSimulatedPort: simulatedPortSpy };
  const deps: SealDeps = {
    crypto: cryptoStub as unknown as CryptoModule,
    port: {
      isAvailable: () => fake.isAvailable(),
      create: createSpy,
      get: getSpy,
    },
    api: api as unknown as SealApi,
    rpId: "localhost",
    now: () => T0,
  };
  return { deps, simulatedPortSpy, createSpy, getSpy, api };
}

/** Mounts the real hook once and returns the handlers it produced. */
async function mountRealFlow(deps: SealDeps | null): Promise<SealFlow> {
  const { useSealFlow } = await vi.importActual<typeof import("./useSealFlow")>("./useSealFlow");
  let captured: SealFlow | undefined;
  function Capture() {
    captured = useSealFlow(deps, realDraft());
    return null;
  }
  renderToStaticMarkup(createElement(Capture));
  if (captured === undefined) throw new Error("hook did not render");
  return captured;
}

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Polls until the condition holds. WebCrypto needs several macrotasks to seal. */
async function waitUntil(condition: () => boolean): Promise<void> {
  for (let i = 0; i < 500 && !condition(); i++) await settle();
}

/** Repeats a press after each macrotask until `done` holds, so a refused press is retried. */
async function pressUntil(press: () => void, done: () => boolean): Promise<void> {
  for (let i = 0; i < 500 && !done(); i++) {
    press();
    await settle();
  }
}

describe("Real_Mode driven run never calls createSimulatedPort (Requirement 17.2 f)", () => {
  it("a passkey seal with both presses, a cancelled create with a retry, and a backup-only seal", async () => {
    // Run 1: Create_Press, then Confirm_Press, then the seal.
    const passkeyRun = await realRunDeps();
    const passkeyFlow = await mountRealFlow(passkeyRun.deps);
    passkeyFlow.onCreatePress();
    await waitUntil(() => passkeyRun.createSpy.mock.calls.length > 0);
    await pressUntil(() => passkeyFlow.onConfirmPress(), () => passkeyRun.getSpy.mock.calls.length > 0);
    passkeyFlow.onConfirmPress();
    await waitUntil(() => passkeyRun.api.seal.mock.calls.length > 0);
    expect(passkeyRun.createSpy).toHaveBeenCalledTimes(1);
    expect(passkeyRun.getSpy).toHaveBeenCalledTimes(1);
    expect(passkeyRun.api.seal).toHaveBeenCalledTimes(1);
    expect(passkeyRun.simulatedPortSpy).not.toHaveBeenCalled();

    // Run 2: the passkey create is cancelled, then Retry lets Create_Press run again.
    const retryRun = await realRunDeps({ failure: "cancel_create" });
    const retryFlow = await mountRealFlow(retryRun.deps);
    retryFlow.onCreatePress();
    await waitUntil(() => retryRun.createSpy.mock.calls.length > 0);
    await pressUntil(
      () => {
        retryFlow.onRetry();
        retryFlow.onCreatePress();
      },
      () => retryRun.createSpy.mock.calls.length >= 2,
    );
    expect(retryRun.createSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(retryRun.simulatedPortSpy).not.toHaveBeenCalled();

    // Run 3: a backup-only seal, with no passkey port touched.
    const backupRun = await realRunDeps();
    const backupFlow = await mountRealFlow(backupRun.deps);
    expect(backupFlow.onBackupOnlyStart()).toBe(true);
    await pressUntil(() => backupFlow.onFallbackSealPress(), () => backupRun.api.seal.mock.calls.length > 0);
    expect(backupRun.api.seal).toHaveBeenCalledTimes(1);
    expect(backupRun.createSpy).not.toHaveBeenCalled();
    expect(backupRun.simulatedPortSpy).not.toHaveBeenCalled();
  }, 60_000);
});
