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
import { ghostExitFallbackMs, ghostPresent, isGhostExitEnd } from "../scene/ghost-presence";
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

function render(recorded = true): string {
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
          createElement(SealBreak, { patternKey: "us-maya", recorded, seal: SETTLED }),
        ),
      ),
    ),
  );
}

/** The break line the reader sees: the one `data-break-line` paragraph. */
function breakLineOf(markup: string): string {
  const match = markup.match(/data-break-line="">([^<]*)</);
  return match ? match[1].replace(/&#x27;/g, "'") : "";
}

describe("break step: one break line per letter kind (spec 15 R12.1)", () => {
  // Reveal passes recorded = true when the reader's own answers are kept, and
  // false on the text persona walk, where her testimony stands in for the record.
  const KINDS: ReadonlyArray<{ kind: string; recorded: boolean; line: string }> = [
    { kind: "live demo", recorded: true, line: CEREMONY_COPY.testimonyRecorded },
    { kind: "real letter", recorded: true, line: CEREMONY_COPY.testimonyRecorded },
    { kind: "fuel persona", recorded: true, line: CEREMONY_COPY.testimonyRecorded },
    { kind: "Priya (text persona)", recorded: false, line: CEREMONY_COPY.recollectionsRead },
  ];

  for (const { kind, recorded, line } of KINDS) {
    it(`${kind} gets exactly its one line`, () => {
      const markup = render(recorded);
      expect(breakLineOf(markup)).toBe(line);
      const other =
        line === CEREMONY_COPY.testimonyRecorded
          ? CEREMONY_COPY.recollectionsRead
          : CEREMONY_COPY.testimonyRecorded;
      expect(markup).not.toContain(other);
    });
  }

  it("Priya's line says nothing of the reader's is recorded", () => {
    expect(CEREMONY_COPY.recollectionsRead).toBe(
      "You've read her recollections. Nothing of yours is recorded.",
    );
  });
});

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
    expect(CEREMONY_COPY.testimonyRecorded).toBe(
      "What you remembered is recorded.",
    );
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

describe("break step: the ghost hands over and leaves (requirement 12.1)", () => {
  const STAGE_1 = { tag: "reveal", stage: 1 as const, leaving: false };

  it("full motion: the ghost stays mounted through the leave, then unmounts", () => {
    // The break's ADVANCE sets leaving, so the ghost is still there for the leave.
    expect(ghostPresent({ ...STAGE_1, leaving: true })).toBe(true);
    expect(isGhostExitEnd("ghostLeave")).toBe(true);
    // When the leave ends (animationend or fallback), the reveal is past stage 1.
    expect(ghostPresent({ tag: "reveal", stage: 2, leaving: false })).toBe(false);
    expect(ghostExitFallbackMs(false)).toBeGreaterThan(0);
  });

  it("Calm_Mode and Skip: no leave runs, so the ghost is gone in the ADVANCE render", () => {
    expect(ghostPresent({ tag: "reveal", stage: 2, leaving: false })).toBe(false);
    expect(ghostExitFallbackMs(true)).toBe(0);
  });

  it("before the break the ghost holds the seal at stage 1", () => {
    expect(ghostPresent(STAGE_1)).toBe(true);
  });
});
