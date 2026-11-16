// Markup tests for the live demo inside the Scene (spec 09, D1.1 to D1.6). They
// render with renderToStaticMarkup in Node. The Calm state comes from a mock of
// useCalmInForce, so both the full and the Calm markup can be asserted.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { SceneShell, type SceneShellProps } from "@/components/ceremony/scene/SceneShell";
import { SoilStrip } from "@/components/ceremony/scene/SoilStrip";
import { LIVE_COPY } from "../copy";
import type { SealedState } from "../SealedView";

import { LiveWaitStep } from "./LiveWaitStep";
import { LiveStepper } from "./LiveStepper";
import { LIVE_STEPS, initialStepperState } from "./live-steps";

/** Every stepper step, rendered inside the Scene, in full motion and in Calm (D1.1, D1.4). */
describe("each stepper step inside the Scene", () => {
  for (const isCalm of [false, true]) {
    const label = isCalm ? "Calm" : "full";
    for (const step of LIVE_STEPS) {
      it(`renders ${step} in the Scene with the Soil in ${label}`, () => {
        calm = isCalm;
        const shellProps: SceneShellProps = {
          variant: "plain",
          demo: true,
          backdrop: true,
          children: createElement(LiveStepper, {
            state: initialStepperState(step),
            dispatch: () => undefined,
            renderStep: () => createElement("p", null, "STEP_BODY"),
          }),
        };
        const html = renderToStaticMarkup(createElement(SceneShell, shellProps));
        expect(html).toContain(`data-step="${step}"`);
        expect(html).toContain("STEP_BODY");
        expect(html).toContain("data-soil-strip");
        expect(html).toContain(`data-ceremony-motion="${isCalm ? "calm" : "full"}"`);
      });
    }
  }
});


let calm = false;

vi.mock("@/components/ceremony/motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ceremony/motion")>();
  return {
    ...actual,
    useCalmInForce: () => calm,
    // The shell and the Top_Bar read the mode from useMotion, so Calm reaches them too.
    useMotion: () => ({ mode: calm ? "calm" : "full", setCalm: () => undefined }),
  };
});

const OPENS_AT = "2026-11-08T00:00:00.000Z";
const OPENS_MS = Date.parse(OPENS_AT);

const sealed: SealedState = {
  tag: "sealed",
  letterId: "AAAAAAAAAAAAAAAAAAAAAA",
  sealedAt: "2026-11-07T12:00:00.000Z",
  opensAt: OPENS_AT,
  offsetMs: 0,
  factors: "backup",
  envelopeHash: "a".repeat(64),
};

function wait(step: "wait" | "testify" | "receipts", nowMs: number, isCalm: boolean): string {
  calm = isCalm;
  return renderToStaticMarkup(
    createElement(LiveWaitStep, {
      state: sealed,
      appOrigin: "https://revenant.example",
      step,
      advanceTo: () => undefined,
      nowMs: () => nowMs,
    }),
  );
}

// Retired (spec 09, Wait layout): the fixed Wait ghost and its sink states
// (D1.2 to D1.4) are gone from the Wait card. The Envelope now sits in the
// flow (SealedEnvelopeView), and the in-flow ghost behind it returns with
// HeldGhost. The key reminder stays with the unlock control (D1.5).
describe("the live Wait card inside the Scene (D1.5)", () => {
  it("keeps the key reminder with the unlock control, before and after zero (D1.5)", () => {
    const before = wait("wait", OPENS_MS - 60_000, false);
    const after = wait("wait", OPENS_MS + 1_000, false);
    expect(before).toContain(LIVE_COPY.keyReminder);
    expect(after).toContain(LIVE_COPY.keyReminder);
  });

  it("draws no fixed Wait ghost on the Wait card", () => {
    expect(wait("wait", OPENS_MS - 60_000, false)).not.toContain("data-live-ghost-layer");
    expect(wait("wait", OPENS_MS + 1_000, false)).not.toContain("data-live-ghost-layer");
  });

  it("drops any ghost layer on Testify and Receipts, which keep the flow only", () => {
    expect(wait("testify", OPENS_MS + 1_000, false)).not.toContain("data-live-ghost-layer");
    expect(wait("receipts", OPENS_MS + 1_000, false)).not.toContain("data-live-ghost-layer");
  });
});

describe("the live page Scene (D1.1, D1.6)", () => {
  it("draws the light and the Soil when the plain shell has a backdrop", () => {
    calm = false;
    const shellProps: SceneShellProps = { variant: "plain", demo: true, backdrop: true, children: createElement("p", null, "step") };
    const html = renderToStaticMarkup(createElement(SceneShell, shellProps));
    expect(html).toContain(renderToStaticMarkup(createElement(SoilStrip)));
    expect(html).toContain('data-ceremony-motion="full"');
    // The shell still has no ceremony root.
    expect(html).not.toContain('data-ceremony="');
  });

  it("draws no Soil and no Ghost on a plain shell without a backdrop, as on /l/[id] (D1.6)", () => {
    calm = false;
    const shellProps: SceneShellProps = { variant: "plain", demo: false, controls: "none", children: createElement("p", null, "letter") };
    const html = renderToStaticMarkup(createElement(SceneShell, shellProps));
    expect(html).not.toContain(renderToStaticMarkup(createElement(SoilStrip)));
    expect(html).not.toContain("data-ghost-layer");
    expect(html).not.toContain("data-ghost-box");
  });
});
