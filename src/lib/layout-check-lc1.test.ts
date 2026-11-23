import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  goFailures,
  GO1_SOIL_CLEAR_PX,
  lcFailures,
  lcTrackFailures,
  LC1_MAX_GAP_PX,
  LC1_TRACK_CLEAR_PX,
  rectGap,
} from "../../tools/qa/layout-rules-17.mjs";

type Rect = { left: number; top: number; right: number; bottom: number };

// Figures column for LC1: right edge at x 300, spanning y 100..600.
const FIGURES: Rect = { left: 40, top: 100, right: 300, bottom: 600 };

// Seal group rect that starts `gap` px right of the figures column, with its top inside the column span.
function sealAt(gap: number, top = 419): Rect {
  return { left: FIGURES.right + gap, top, right: FIGURES.right + gap + 200, bottom: top + 300 };
}

// Failing reading from the Break the seal step: the Seal group starts 134 px right of the figures.
const SEAL_FAILING = sealAt(134);

// Passing reading: the Seal group starts 48 px right, with its top inside the column span.
const SEAL_PASSING = sealAt(48, 200);

describe("LC1 Seal group sits near the figures column", () => {
  it("fails a 134 px gap", () => {
    const failures = lcFailures({ figures: FIGURES, sealGroup: SEAL_FAILING });
    expect(failures).toHaveLength(1);
    expect(failures[0].id).toBe("LC1");
    expect(failures[0].check).toBe("column-gap");
    expect(failures[0].message).toContain("134 px");
  });

  it("passes a 48 px gap with the Seal group top inside the column span", () => {
    expect(lcFailures({ figures: FIGURES, sealGroup: SEAL_PASSING })).toEqual([]);
  });

  it("passes a gap of exactly 64 px", () => {
    expect(lcFailures({ figures: FIGURES, sealGroup: sealAt(64, 200) })).toEqual([]);
  });

  it("fails a gap of 65 px", () => {
    const failures = lcFailures({ figures: FIGURES, sealGroup: sealAt(65, 200) });
    expect(failures.map((f) => f.check)).toEqual(["column-gap"]);
  });

  it("fails a Seal group top above the figures column", () => {
    const failures = lcFailures({ figures: FIGURES, sealGroup: { ...sealAt(48, 50), top: 50 } });
    expect(failures.map((f) => f.check)).toEqual(["column-top"]);
  });

  it("fails a Seal group top below the figures column", () => {
    const failures = lcFailures({ figures: FIGURES, sealGroup: { ...sealAt(48, 650), top: 650 } });
    expect(failures.map((f) => f.check)).toEqual(["column-top"]);
  });

  it("fails as no measurement when a rect is missing", () => {
    const failures = lcFailures({ figures: null, sealGroup: SEAL_PASSING });
    expect(failures).toHaveLength(1);
    expect(failures[0].message).toContain("no [data-figures-column]");
    expect(failures[0].message).toContain("[data-seal-group] rect to measure");
  });

  it("fails exactly when the gap exceeds 64 px (property)", () => {
    fc.assert(
      fc.property(fc.integer({ min: -300, max: 500 }), (gap) => {
        const failures = lcFailures({ figures: FIGURES, sealGroup: sealAt(gap, 200) });
        const gapFailed = failures.some((f) => f.check === "column-gap");
        expect(gapFailed).toBe(gap > LC1_MAX_GAP_PX);
      }),
    );
  });
});

// GO1 Soil strip fixtures. The soil strip spans x 40..488 and y 419..545. The text line spans
// the same x range and y 419..440, so it lies inside the strip.
const SOIL: Rect = { left: 40, top: 419, right: 488, bottom: 545 };
const TEXT_IN_SOIL: Rect = { left: 40, top: 419, right: 488, bottom: 440 };
// The same line ending above the top of the strip.
const TEXT_ABOVE_SOIL: Rect = { left: 40, top: 380, right: 488, bottom: 400 };
// Ghost parked well away from the text, so only the Soil check can fire.
const GHOST_FAR: Rect = { left: 0, top: 0, right: 10, bottom: 10 };

describe("GO1 text clear of the Soil strip", () => {
  it("fails text that overlaps the Soil strip", () => {
    const failures = goFailures({
      ghost: GHOST_FAR,
      soil: SOIL,
      text: [{ label: "Soil line", rect: TEXT_IN_SOIL }],
      controls: [],
    });
    expect(failures).toHaveLength(1);
    expect(failures[0].id).toBe("GO1");
    expect(failures[0].check).toBe("soil-overlap");
    expect(failures[0].message).toContain("overlaps the Soil strip");
  });

  it("passes text that ends above the top of the Soil strip", () => {
    const failures = goFailures({
      ghost: GHOST_FAR,
      soil: SOIL,
      text: [{ label: "Soil line", rect: TEXT_ABOVE_SOIL }],
      controls: [],
    });
    expect(failures).toEqual([]);
  });
});

// Tightening after spec 17 (Maya at 1440x900 on main). The Soil strip's box was
// 40..488 x 419..545 on Break the seal, and the D7 fix moved lines off it but left
// them touching it. A line that only touches the box sits on the drawn crest.
describe("GO1 Soil clearance", () => {
  const line = (top: number, bottom: number): Rect => ({ left: 60, top, right: 226, bottom });
  const read = (rect: Rect) =>
    goFailures({ ghost: GHOST_FAR, soil: SOIL, text: [{ label: "3.79 USD per gallon", rect }], controls: [] });

  it("fails a line that touches the top of the Soil strip", () => {
    const failures = read(line(398, 419));
    expect(failures.map((f) => f.check)).toEqual(["soil-clearance"]);
    expect(failures[0].message).toContain("0 px from the Soil strip");
    expect(failures[0].message).toContain(`${GO1_SOIL_CLEAR_PX} px`);
  });

  it("fails a line 7 px above the Soil strip and passes one 8 px above", () => {
    expect(read(line(390, 412)).map((f) => f.check)).toEqual(["soil-clearance"]);
    expect(read(line(390, 411))).toEqual([]);
  });

  it("still names an overlap as soil-overlap, as measured on main (17.1 px into the strip)", () => {
    const failures = read({ left: 60, top: 418, right: 226, bottom: 436.1 });
    expect(failures.map((f) => f.check)).toEqual(["soil-overlap"]);
  });

  it("measures the gap on either axis (property)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 40 }), fc.integer({ min: 0, max: 40 }), (dx, dy) => {
        const a: Rect = { left: 0, top: 0, right: 10, bottom: 10 };
        const b: Rect = { left: 10 + dx, top: 10 + dy, right: 30 + dx, bottom: 30 + dy };
        expect(rectGap(a, b)).toBe(Math.max(dx, dy));
      }),
    );
  });
});

describe("LC1 on Break the seal reads the marks card", () => {
  // Measured on main at 1440x900: the marks card [data-card="marks"] at 60..468 x 221..441
  // and the Seal group at 622..846 x 325..569. [data-figures-column] is not on this step.
  const MARKS: Rect = { left: 60, top: 221, right: 468, bottom: 441 };
  const SEAL_GROUP: Rect = { left: 622, top: 325, right: 846, bottom: 569 };

  it("fails main's 154 px gap and names the column it measured", () => {
    const failures = lcFailures({ figures: MARKS, columnSource: '[data-card="marks"]', sealGroup: SEAL_GROUP });
    expect(failures.map((f) => f.check)).toEqual(["column-gap"]);
    expect(failures[0].message).toContain("154 px");
    expect(failures[0].message).toContain('[data-card="marks"]');
  });

  it("passes the Seal group 48 px right of the marks card", () => {
    const sealGroup = { ...SEAL_GROUP, left: MARKS.right + 48, right: MARKS.right + 272 };
    expect(lcFailures({ figures: MARKS, columnSource: '[data-card="marks"]', sealGroup })).toEqual([]);
  });
});

describe("LC1 step track gap", () => {
  // Measured on main at 1440x900, Maya's Remember: the step track 60..564 x 186..221 and
  // "A letter from Maya" starting at y 221, so the labels touch the line under them.
  const TRACK: Rect = { left: 60, top: 186, right: 564, bottom: 221 };
  const below = (top: number) => ({ label: "A letter from Maya", rect: { left: 60, top, right: 199, bottom: top + 21 } });

  it("fails main's 0 px gap under the step track", () => {
    const failures = lcTrackFailures({ track: TRACK, below: below(221) });
    expect(failures.map((f) => f.check)).toEqual(["track-gap"]);
    expect(failures[0].message).toContain('"A letter from Maya" starts 0 px below the step track');
    expect(failures[0].message).toContain(`${LC1_TRACK_CLEAR_PX} px`);
  });

  it("fails a line that overlaps the track", () => {
    expect(lcTrackFailures({ track: TRACK, below: below(215) }).map((f) => f.check)).toEqual(["track-gap"]);
  });

  it("passes at exactly 16 px and fails at 15 px", () => {
    expect(lcTrackFailures({ track: TRACK, below: below(237) })).toEqual([]);
    expect(lcTrackFailures({ track: TRACK, below: below(236) })).toHaveLength(1);
  });

  it("passes a track with nothing under it, and fails a missing track as no measurement", () => {
    expect(lcTrackFailures({ track: TRACK, below: null })).toEqual([]);
    const failures = lcTrackFailures({ track: null, below: below(300) });
    expect(failures[0].message).toContain("no [data-step-track] rect to measure");
  });

  it("fails exactly when the gap is under 16 px (property)", () => {
    fc.assert(
      fc.property(fc.integer({ min: -30, max: 80 }), (gap) => {
        const failed = lcTrackFailures({ track: TRACK, below: below(TRACK.bottom + gap) }).length > 0;
        expect(failed).toBe(gap < LC1_TRACK_CLEAR_PX);
      }),
    );
  });
});
