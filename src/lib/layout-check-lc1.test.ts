import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { goFailures, lcFailures, LC1_MAX_GAP_PX } from "../../tools/qa/layout-rules-17.mjs";

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
    expect(failures[0].message).toContain("no [data-figures-column] or [data-seal-group] rect to measure");
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
