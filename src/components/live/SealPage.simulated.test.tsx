/**
 * Simulated_Mode markup on the Demo_Mode Seal_Page (spec 20, Part B,
 * Requirements 11.1, 11.6 to 11.8, 12.2, 12.6 and 12.7).
 *
 * These renders are static. The Simulate_Control is off on every mount, so the
 * page can only show Simulated_Mode after a change event. The tests therefore
 * render the Seal_Step, the failure screens and the Wait step directly, with
 * simulated values set. What needs a click (the port calls, the route sequence,
 * the factory count, the reload) is checked in the browser walk
 * (src/test/integration/simulated-walk.test.ts).
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { LIVE_COPY, REAL_COPY } from "./copy";
import type { PrepareResult, SealApi, SealPostResult } from "./api";
import type { CryptoModule } from "./crypto-module";
import { PRESS_COPY } from "./press/copy";
import type { SealedState } from "./SealedView";
import { SealFailure } from "./SealFailure";
import {
  pressConfirm,
  pressCreate,
  sealWithPasskey,
  type AuthenticatorPort,
  type Created,
  type SealDeps,
  type SealDraft,
  type SealOutcome,
} from "./seal-runner";
import { catalogueMetric, makeFigures } from "./test-figures";
import { LiveWaitStep } from "./stepper/LiveWaitStep";
import { SealStep, type SealStepProps, type SimulateControl } from "./seal-step/SealStep";
import { encodeBase64url } from "@/lib/seal-format";

const SAMPLE_KEY = "0B61-AQN7-Y4X4-736P-3XMB-3YR4-9P7";

/** Requirement 11.8 and 12.7: phrases that must not appear outside the simulated notice. */
const FORBIDDEN_PHRASES = [
  "your device will ask",
  "waiting for your device",
  "saved as",
  "passkey manager",
  "revenant demo",
  "on your device",
];

/** Requirement 11.8: the passkey-era copy that Simulated_Mode must not show. */
const FORBIDDEN_PASSKEY_COPY: readonly (string | undefined)[] = [
  LIVE_COPY.crossDevice,
  LIVE_COPY.crossDeviceQuestion,
  LIVE_COPY.prfHint,
  LIVE_COPY.passkeySteps,
  LIVE_COPY.passkeyDeleteNote,
];

/** The visible text of markup: scripts, styles and tags removed. */
function visibleText(html: string): string {
  return html
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&");
}

/** The markup without the simulated notice element, which may name the passkey manager. */
function withoutSimulatedNotice(html: string): string {
  return html.replace(/<p[^>]*data-simulated-notice=""[^>]*>[\s\S]*?<\/p>/g, "");
}

function expectNoForbiddenText(html: string): void {
  const text = visibleText(withoutSimulatedNotice(html)).toLowerCase();
  for (const phrase of FORBIDDEN_PHRASES) {
    expect(text, phrase).not.toContain(phrase);
  }
  for (const copy of FORBIDDEN_PASSKEY_COPY) {
    if (copy === undefined) continue;
    expect(visibleText(withoutSimulatedNotice(html)), copy).not.toContain(copy);
  }
}

function simulateControl(on: boolean, disabled = false): SimulateControl {
  return { on, disabled, onChange: () => {}, unavailable: false };
}

function sealStepProps(
  tag: SealStepProps["tag"],
  simulate: SimulateControl | undefined,
): SealStepProps {
  return {
    tag,
    backupChoice: "card",
    onBackupChoice: () => {},
    onBackupStart: () => {},
    pressBlocked: false,
    ready: true,
    mode: "write",
    questionCount: 1,
    prfMissing: false,
    onCreatePress: () => {},
    onConfirmPress: () => {},
    onAttempt: () => {},
    simulate,
  };
}

function renderSealStep(
  tag: SealStepProps["tag"],
  simulate: SimulateControl | undefined,
): string {
  return renderToStaticMarkup(createElement(SealStep, sealStepProps(tag, simulate)));
}

/** The one checkbox of the Simulate_Control, as its opening tag. */
function simulateInputTag(html: string): string {
  const label = html.indexOf("data-simulate-control");
  if (label < 0) return "";
  return html.slice(label).match(/<input[^>]*>/)?.[0] ?? "";
}

const SEAL_FORM_TAGS = ["write", "creating", "created", "confirming", "preparing", "sealing"] as const;

describe("Simulate_Control on the Seal_Step (Requirement 11.1, 11.6)", () => {
  it("renders exactly one Simulate_Control, unchecked, named by simulateLabel", () => {
    const html = renderSealStep("write", simulateControl(false));
    expect(html.split("data-simulate-control").length - 1).toBe(1);
    const input = simulateInputTag(html);
    expect(input).toContain('type="checkbox"');
    expect(input).not.toContain("checked");
    // The label's apostrophe is escaped in markup, so compare the visible text.
    expect(visibleText(html)).toContain(LIVE_COPY.simulateLabel);
  });

  it("places the control after the Backup_Choice and before the Backup_Only_Start", () => {
    const html = renderSealStep("write", simulateControl(false));
    const choice = html.indexOf("data-backup-choice");
    const control = html.indexOf("data-simulate-control");
    const start = html.indexOf("data-backup-only-start");
    expect(choice).toBeGreaterThan(-1);
    expect(control).toBeGreaterThan(choice);
    expect(start).toBeGreaterThan(control);
  });

  it("is enabled in write and disabled in every other seal state", () => {
    expect(simulateInputTag(renderSealStep("write", simulateControl(false)))).not.toContain("disabled");
    for (const tag of SEAL_FORM_TAGS.filter((value) => value !== "write")) {
      const input = simulateInputTag(renderSealStep(tag, simulateControl(false, true)));
      expect(input, tag).toContain("disabled");
    }
  });

  it("shows no simulated notice while the mode is off", () => {
    const html = renderSealStep("write", simulateControl(false));
    expect(html).not.toContain("data-simulated-notice");
    expect(html).not.toContain(LIVE_COPY.simulatedNotice);
  });

  it("shows the simulated notice directly after the control when the mode is on", () => {
    const html = renderSealStep("write", simulateControl(true));
    const control = html.indexOf("data-simulate-control");
    const notice = html.indexOf("data-simulated-notice");
    expect(notice).toBeGreaterThan(control);
    expect(html).toContain(LIVE_COPY.simulatedNotice);
  });
});

describe("Backup_Choice with Simulated_Mode on (Requirement 12.2)", () => {
  it("disables the skip radio and shows the required note", () => {
    const html = renderToStaticMarkup(
      createElement(SealStep, { ...sealStepProps("write", simulateControl(true)) }),
    );
    const skip = html.match(/<input[^>]*value="skip"[^>]*>/)?.[0] ?? "";
    expect(skip).toContain("disabled");
    expect(html).toContain(LIVE_COPY.simulatedBackupRequired);
  });

  it("leaves the skip radio enabled with the mode off", () => {
    const html = renderSealStep("write", simulateControl(false));
    const skip = html.match(/<input[^>]*value="skip"[^>]*>/)?.[0] ?? "";
    expect(skip).not.toContain("disabled");
    expect(html).not.toContain(LIVE_COPY.simulatedBackupRequired);
  });
});

describe("Simulated_Mode copy on the Seal_Step (Requirement 11.7, 11.8)", () => {
  it("reads the Simulated_Mode button label in write and creating, and the set label after", () => {
    expect(renderSealStep("write", simulateControl(true))).toContain(PRESS_COPY.sealButtonCreateSimulated);
    expect(renderSealStep("creating", simulateControl(true, true))).toContain(PRESS_COPY.sealButtonCreateSimulated);
    for (const tag of ["created", "confirming", "preparing", "sealing"] as const) {
      expect(renderSealStep(tag, simulateControl(true, true)), tag).toContain(PRESS_COPY.sealButtonSet);
    }
  });

  for (const tag of SEAL_FORM_TAGS) {
    it(`shows no passkey-era phrase in Simulated_Mode (${tag})`, () => {
      expectNoForbiddenText(renderSealStep(tag, simulateControl(true, tag !== "write")));
    });
  }
});

describe("Failure screens in Simulated_Mode (Requirement 11.8)", () => {
  type FailureState = Parameters<typeof SealFailure>[0]["state"];
  const FAILURES: readonly { name: string; state: FailureState }[] = [
    { name: "cannot_lock", state: { tag: "cannot_lock", passkeyCreated: false } },
    { name: "cancelled", state: { tag: "cancelled" } },
    { name: "failed", state: { tag: "failed", kind: "network", passkeyCreated: false } },
  ];

  for (const failure of FAILURES) {
    it(`shows no passkey-era phrase on ${failure.name}`, () => {
      const html = renderToStaticMarkup(
        createElement(SealFailure, {
          state: failure.state,
          onRetry: () => {},
          onFallbackStart: () => {},
          real: false,
          simulated: true,
        }),
      );
      expectNoForbiddenText(html);
    });
  }
});

describe("Wait step of a Simulated_Letter (Requirement 12.6, 12.7)", () => {
  const SIMULATED_LETTER: SealedState = {
    tag: "sealed",
    letterId: "5c1e2f3a-7b8d-4e9f-8a0b-1c2d3e4f5a6b",
    sealedAt: "2026-11-24T14:00:00.000Z",
    opensAt: "2026-11-24T14:00:30.000Z",
    offsetMs: 0,
    factors: "both",
    envelopeHash: "ab".repeat(32),
  };

  function renderWait(): string {
    return renderToStaticMarkup(
      createElement(LiveWaitStep, {
        state: SIMULATED_LETTER,
        appOrigin: "http://localhost:3000",
        step: "wait",
        advanceTo: () => {},
        nowMs: () => Date.parse("2026-11-24T14:00:00.000Z"),
        getBackupKeyText: () => SAMPLE_KEY,
        simulated: true,
      }),
    );
  }

  it("shows the backup key card open, with no show control", () => {
    const html = renderWait();
    expect(html).toContain("data-live-backup-card");
    expect(html).not.toContain(LIVE_COPY.backupCardShow);
  });

  it("shows the simulated key reminder and not the passkey reminder", () => {
    const html = renderWait();
    expect(html).toContain(LIVE_COPY.simulatedKeyReminder);
    expect(html).not.toContain(LIVE_COPY.keyReminder);
  });

  it("carries no passkey-era phrase in its visible text", () => {
    expectNoForbiddenText(renderWait());
  });

  it("keeps the real-mode line out of the simulated Wait step", () => {
    expect(renderWait()).not.toContain(REAL_COPY.stillSealed);
  });
});

/**
 * Counting-factory checks (spec 20, Part B). SealPage calls the crypto module's
 * createSimulatedPort, and these tests replace it with a counting spy. The
 * checks drive the seal runner with the port the factory returns.
 *
 * Two of the ticket's checks need a mounted page: the factory count after the
 * mode is switched off and on, and the press being blocked until the factory
 * resolves. Both depend on React effects and clicks. This test environment is
 * Node with no DOM, so they are not checked here. The browser walk in
 * src/test/integration/simulated-walk.test.ts covers the page behaviour.
 */

const COUNT_T0 = Date.parse("2026-11-02T10:00:00.000Z");

const COUNT_PREPARED: PrepareResult = {
  ok: true,
  letterId: encodeBase64url(new Uint8Array(16)),
  serverSecret: encodeBase64url(new Uint8Array(32)),
  serverNow: "2026-11-02T10:00:00.000Z",
};

function countingDraft(): SealDraft {
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

/** A recording route pair: records each route name and the keys of each seal body. */
function recordingApi() {
  const routes: string[] = [];
  const bodyKeys: string[][] = [];
  const envelopes: unknown[] = [];
  const api: SealApi = {
    prepare: async () => {
      routes.push("prepare");
      return COUNT_PREPARED;
    },
    seal: async (body): Promise<SealPostResult> => {
      routes.push("seal");
      bodyKeys.push(Object.keys(body).sort());
      envelopes.push(body.envelope);
      return {
        ok: true,
        letterId: body.letterId,
        sealedAt: "2026-11-02T10:00:00.000Z",
        opensAt: "2026-11-02T10:00:30.000Z",
        envelopeHash: body.envelopeHash,
      };
    },
  };
  return { api, routes, bodyKeys, envelopes };
}

interface CountedSeal {
  outcome: SealOutcome;
  created: Created;
  routes: string[];
  bodyKeys: string[][];
  envelopes: unknown[];
}

/** One seal with both passkey presses, and a backup wrap, through the given port. */
async function sealThrough(
  port: AuthenticatorPort,
  cryptoModule: CryptoModule,
  backupKey: Parameters<typeof sealWithPasskey>[1]["backupKey"],
): Promise<CountedSeal> {
  const rec = recordingApi();
  const deps: SealDeps = {
    crypto: cryptoModule,
    port,
    api: rec.api,
    rpId: "localhost",
    now: () => COUNT_T0,
  };
  const create = await pressCreate(deps);
  if (!create.ok) throw new Error(`create did not pass: ${create.event.type}`);
  const confirm = await pressConfirm(deps, create.created);
  if (!confirm.ok) throw new Error(`confirm did not pass: ${confirm.event.type}`);
  const outcome = await sealWithPasskey(deps, {
    draft: countingDraft(),
    confirmed: confirm.confirmed,
    backupKey,
  });
  return {
    outcome,
    created: create.created,
    routes: rec.routes,
    bodyKeys: rec.bodyKeys,
    envelopes: rec.envelopes,
  };
}

/** The wrap factor names in a sealed envelope header, sorted. */
function wrapFactors(envelope: unknown): string[] {
  const header = envelope as { wrappedDeks: { factor: string }[] };
  return header.wrappedDeks.map((wrap) => wrap.factor).sort();
}

function portCreateOptions(prfSalt: Uint8Array) {
  return {
    rpId: "localhost",
    rpName: "Revenant",
    userId: new Uint8Array(16),
    userName: "counting-check",
    userDisplayName: "counting-check",
    challenge: new Uint8Array(32),
    pubKeyCredParams: [{ type: "public-key" as const, alg: -7 }],
    residentKey: "required" as const,
    userVerification: "required" as const,
    attestation: "none" as const,
    prfSalt,
    timeoutMs: 1000,
  };
}

describe("Counting factory on the Simulated_Port (Requirement 11, 12)", () => {
  it("a seal through the simulated port has the same routes and body keys as the test fake port, with both wraps", async () => {
    const crypto = await import("@/lib/crypto");
    const factory = vi.fn(crypto.createSimulatedPort);
    const cryptoModule = { ...crypto, createSimulatedPort: factory } as unknown as CryptoModule;

    const { createFakeAuthenticator } = await import("@/lib/crypto/testing/fake-authenticator");
    const simPort = await cryptoModule.createSimulatedPort();
    const backupKey = crypto.generateBackupKey();
    const simulated = await sealThrough(simPort, cryptoModule, backupKey);
    const fake = await sealThrough(createFakeAuthenticator(), cryptoModule, backupKey);

    expect(simulated.outcome.ok).toBe(true);
    expect(fake.outcome.ok).toBe(true);
    expect(simulated.routes).toEqual(["prepare", "seal"]);
    expect(simulated.routes).toEqual(fake.routes);
    expect(simulated.bodyKeys).toEqual(fake.bodyKeys);
    expect(wrapFactors(simulated.envelopes[0])).toEqual(["backup", "passkey"]);
    if (!simulated.outcome.ok) throw new Error("unreachable");
    expect(simulated.outcome.event.factors).toBe("both");
    expect(factory).toHaveBeenCalledTimes(1);
  });

  it("two factory calls give different PRF results for one salt", async () => {
    const crypto = await import("@/lib/crypto");
    const factory = vi.fn(crypto.createSimulatedPort);
    const first = await factory();
    const second = await factory();
    expect(factory).toHaveBeenCalledTimes(2);

    const salt = new Uint8Array(32).fill(7);
    const a = await first.create(portCreateOptions(salt));
    const b = await second.create(portCreateOptions(salt));
    expect(a.prfResult).not.toBeNull();
    expect(b.prfResult).not.toBeNull();
    expect(a.prfResult).not.toEqual(b.prfResult);
  });

  it("a seal then an in-page unlock makes 1 create and 2 gets on the Simulated_Port, and none on the browser port", async () => {
    const crypto = await import("@/lib/crypto");
    const factory = vi.fn(crypto.createSimulatedPort);
    const cryptoModule = { ...crypto, createSimulatedPort: factory } as unknown as CryptoModule;

    const inner = await cryptoModule.createSimulatedPort();
    const counts = { create: 0, get: 0 };
    const counted: AuthenticatorPort = {
      isAvailable: () => inner.isAvailable(),
      create: (options) => {
        counts.create += 1;
        return inner.create(options);
      },
      get: (options) => {
        counts.get += 1;
        return inner.get(options);
      },
    };
    const { createFakeAuthenticator } = await import("@/lib/crypto/testing/fake-authenticator");
    const browser = createFakeAuthenticator();

    const sealed = await sealThrough(counted, cryptoModule, crypto.generateBackupKey());
    expect(sealed.outcome.ok).toBe(true);

    const unlock = await crypto.assertPasskey(counted, {
      rpId: "localhost",
      credentialId: sealed.created.credentialId,
      prfSalt: sealed.created.prfSalt,
      pageHostname: "localhost",
    });
    expect(unlock.ok).toBe(true);

    expect(counts).toEqual({ create: 1, get: 2 });
    expect(browser.calls.length).toBe(0);
  });
});
