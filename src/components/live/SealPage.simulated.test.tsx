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
import { describe, expect, it } from "vitest";

import { LIVE_COPY, REAL_COPY } from "./copy";
import { PRESS_COPY } from "./press/copy";
import type { SealedState } from "./SealedView";
import { SealFailure } from "./SealFailure";
import { LiveWaitStep } from "./stepper/LiveWaitStep";
import { SealStep, type SealStepProps, type SimulateControl } from "./seal-step/SealStep";

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
