// Feature: 15-the-flow, requirement 12.1 (break screen as drawn).
//
// The break step shows the testimony line above the hint, then the hint and the
// Break the seal button. Calm_Mode (reduced motion or the Calm control) plans no
// decorative motion, so the seal breaks with no animation.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CEREMONY_COPY } from "../copy";
import { LiveRegionProvider } from "../LiveRegion";
import { MotionProvider } from "../motion";
import { SkipProvider } from "../skip";
import { SealBreak } from "./SealBreak";
import { planSealBreak } from "./SealBreak";
import type { SealController } from "./useSealBreak";

const SETTLED: SealController = {
  hold: { phase: "idle", progress: 0 },
  broken: false,
  progress: 0,
  press: () => undefined,
  breakNow: () => undefined,
  showAll: () => undefined,
  skip: () => undefined,
  connect: () => undefined,
};

function render(): string {
  return renderToStaticMarkup(
    createElement(
      MotionProvider,
      null,
      createElement(
        SkipProvider,
        null,
        createElement(
          LiveRegionProvider,
          null,
          createElement(SealBreak, { patternKey: "us-maya", seal: SETTLED }),
        ),
      ),
    ),
  );
}

describe("break step: testimony line above the hint (requirement 12.1)", () => {
  it("renders the testimony line before the hint and the button", () => {
    const markup = render();
    const testimony = markup.indexOf(CEREMONY_COPY.testimonyRecorded);
    const hint = markup.indexOf(
      CEREMONY_COPY.sealHint.replace(/'/g, "&#x27;"),
    );
    const button = markup.indexOf(`>${CEREMONY_COPY.sealButton}<`);
    expect(testimony).toBeGreaterThan(-1);
    expect(hint).toBeGreaterThan(testimony);
    expect(button).toBeGreaterThan(hint);
  });

  it("marks the testimony line with data-break-line", () => {
    expect(render()).toContain("data-break-line");
  });

  it("uses the exact sentence from the drawn break screen", () => {
    expect(CEREMONY_COPY.testimonyRecorded).toBe("Your testimony is recorded.");
  });
});

describe("break step: reduced motion and Calm_Mode (requirement 12.7)", () => {
  it("plans no decorative motion in Calm_Mode, so the seal breaks at once", () => {
    expect(planSealBreak({ calm: true }).steps).toHaveLength(0);
  });

  it("plans the full sequence in full motion", () => {
    expect(planSealBreak({ calm: false }).steps.length).toBeGreaterThan(0);
  });
});
