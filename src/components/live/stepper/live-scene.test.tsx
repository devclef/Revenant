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

let calm = false;

vi.mock("@/components/ceremony/motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ceremony/motion")>();
  return { ...actual, useCalmInForce: () => calm };
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

describe("the live Wait card inside the Scene (D1.2)", () => {
  it("sinks the Ghost with the Envelope in full motion while the countdown runs", () => {
    const html = wait("wait", OPENS_MS - 60_000, false);
    expect(html).toContain("data-live-ghost-layer");
    expect(html).toContain('data-sink="sinking"');
    expect(html).toContain('data-live-countdown="ticking"');
  });

  it("shows the settled sunk pose with no motion in Calm, and the countdown still runs (D1.4)", () => {
    const html = wait("wait", OPENS_MS - 60_000, true);
    expect(html).toContain('data-sink="sunk"');
    expect(html).not.toContain('data-sink="sinking"');
    expect(html).toContain('data-live-countdown="ticking"');
  });

  it("rises the Ghost again at zero, the Emergence on unlock in place (D1.3)", () => {
    const html = wait("wait", OPENS_MS + 1_000, false);
    expect(html).toContain("data-live-ghost-layer");
    // Idle means no data-sink attribute, so the CSS rise plays.
    expect(html).not.toContain("data-sink=");
    expect(html).not.toContain('data-live-countdown="ticking"');
  });

  it("shows the same idle rise at zero in Calm, with no sink", () => {
    const html = wait("wait", OPENS_MS + 1_000, true);
    expect(html).not.toContain("data-sink=");
  });

  it("keeps the key reminder with the unlock control, before and after zero (D1.5)", () => {
    const before = wait("wait", OPENS_MS - 60_000, false);
    const after = wait("wait", OPENS_MS + 1_000, false);
    expect(before).toContain(LIVE_COPY.keyReminder);
    expect(after).toContain(LIVE_COPY.keyReminder);
  });

  it("drops the Ghost on Testify and Receipts, which keep the flow only", () => {
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
