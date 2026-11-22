import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { CW1_INSET_PX, CW1_SIZES, cwFailures } from "../../tools/qa/layout-rules-17.mjs";

describe("CW1 minimum content width", () => {
  it("fails a 390 px viewport with a 179.4 px content column (minimum 342)", () => {
    const failures = cwFailures({ width: 179.4, viewport: 390 });
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/^CW1/);
    expect(failures[0]).toContain("179.4");
    expect(failures[0]).toContain("342");
  });

  it("passes a 390 px viewport with a 342 px content column", () => {
    expect(cwFailures({ width: 342, viewport: 390 })).toEqual([]);
  });

  it("passes exactly at the boundary viewport minus 48", () => {
    const viewport = 390;
    expect(CW1_INSET_PX).toBe(48);
    expect(cwFailures({ width: viewport - 48, viewport })).toEqual([]);
    expect(cwFailures({ width: viewport - 48 - 0.01, viewport })).toHaveLength(1);
  });

  it("applies the same rule at 360x640", () => {
    expect(CW1_SIZES).toContain("360x640");
    expect(cwFailures({ width: 312, viewport: 360 })).toEqual([]);
    expect(cwFailures({ width: 311.9, viewport: 360 })).toHaveLength(1);
  });

  it("reports no measurement for a missing or non-numeric reading", () => {
    expect(cwFailures({ width: null, viewport: 390 })).toHaveLength(1);
    expect(cwFailures({ width: 342, viewport: "390" })).toHaveLength(1);
    expect(cwFailures(undefined)).toHaveLength(1);
  });

  it("fails exactly when the column is under viewport minus 48, for viewports 360 to 899", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 360, max: 899 }),
        fc.double({ min: 0, max: 1000, noNaN: true, noDefaultInfinity: true }),
        (viewport, width) => {
          const failed = cwFailures({ width, viewport }).length > 0;
          expect(failed).toBe(width < viewport - CW1_INSET_PX);
        },
      ),
    );
  });
});
