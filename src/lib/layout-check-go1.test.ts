import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { goFailures, rectOverlap } from "../../tools/qa/layout-rules-17.mjs";

type Rect = { left: number; top: number; right: number; bottom: number };

// Ghost drawn box from the failing main reading (GitHub issue #583).
const GHOST: Rect = { left: 164, top: 143, right: 220, bottom: 208 };

// The text line from the failing reading: x 36..348, y 206..224. It crosses the Ghost's
// lower edge at y 208 and sits inside the Ghost's x range.
const TEXT_OVERLAPPING: Rect = { left: 36, top: 206, right: 348, bottom: 224 };

// The same line moved below the drawn bottom of the Ghost.
const TEXT_BELOW: Rect = { left: 36, top: 216, right: 348, bottom: 234 };

describe("GO1 text and controls clear of the Ghost", () => {
  it("fails the failing main reading, where text crosses the Ghost box", () => {
    const failures = goFailures({
      ghost: GHOST,
      text: [{ label: "Your letter is sealed", rect: TEXT_OVERLAPPING }],
      controls: [],
    });
    expect(failures).toHaveLength(1);
    expect(failures[0].id).toBe("GO1");
    expect(failures[0].layer).toBe("text");
    expect(failures[0].message).toContain("Your letter is sealed");
    expect(failures[0].message).toContain("overlaps the Ghost");
  });

  it("passes the same text moved below the drawn bottom of the Ghost", () => {
    const failures = goFailures({
      ghost: GHOST,
      text: [{ label: "Your letter is sealed", rect: TEXT_BELOW }],
      controls: [],
    });
    expect(failures).toEqual([]);
  });

  it("still fails a text node under an opaque ancestor that overlaps the Ghost", () => {
    // The reader records every text Range with no opaque-ancestor exemption, so the rule
    // sees this node and fails it even though its parent paints a background.
    const failures = goFailures({
      ghost: GHOST,
      text: [{ label: "card body under opaque panel", rect: TEXT_OVERLAPPING }],
      controls: [],
    });
    expect(failures).toHaveLength(1);
    expect(failures[0].layer).toBe("text");
    expect(failures[0].message).toContain("card body under opaque panel");
  });

  it("fails a control that overlaps the Ghost and names the control layer", () => {
    const failures = goFailures({
      ghost: GHOST,
      text: [],
      controls: [{ label: "Continue", rect: { left: 150, top: 190, right: 240, bottom: 230 } }],
    });
    expect(failures).toHaveLength(1);
    expect(failures[0].layer).toBe("control");
    expect(failures[0].message).toContain("Continue");
  });

  it("fails rather than passes when the Ghost box is missing", () => {
    const failures = goFailures({ ghost: null, text: [], controls: [] });
    expect(failures).toHaveLength(1);
    expect(failures[0].message).toMatch(/no \[data-ghost-box\] rect/);
  });

  it("passes when rects only share an edge", () => {
    const touching: Rect = { left: 220, top: 143, right: 260, bottom: 208 };
    expect(goFailures({ ghost: GHOST, text: [{ label: "edge", rect: touching }], controls: [] })).toEqual([]);
  });
});

// Random rects with integer edges. Widths and heights are at least 1 so every rect is real.
const rectArb = fc
  .record({
    left: fc.integer({ min: 0, max: 500 }),
    top: fc.integer({ min: 0, max: 500 }),
    width: fc.integer({ min: 1, max: 300 }),
    height: fc.integer({ min: 1, max: 300 }),
  })
  .map(({ left, top, width, height }) => ({ left, top, right: left + width, bottom: top + height }));

describe("GO1 property: failure exactly when the rects intersect", () => {
  it("goFailures fails if and only if the text rect and Ghost rect strictly intersect", () => {
    fc.assert(
      fc.property(rectArb, rectArb, (ghost, text) => {
        const intersects =
          Math.min(ghost.right, text.right) > Math.max(ghost.left, text.left) &&
          Math.min(ghost.bottom, text.bottom) > Math.max(ghost.top, text.top);
        const failures = goFailures({ ghost, text: [{ label: "t", rect: text }], controls: [] });
        expect(failures.length > 0).toBe(intersects);
        expect(rectOverlap(text, ghost) !== null).toBe(intersects);
      }),
      { numRuns: 500 },
    );
  });
});
