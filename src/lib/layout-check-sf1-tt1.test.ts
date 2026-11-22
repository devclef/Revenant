import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { sfFailures, ttFailures, SF1_RATIO, TT1_MIN_PX } from "../../tools/qa/layout-rules-17.mjs";

// SF1 (GitHub issue #587): the Seal panel fills at least 99% of its surface, with no cream strip beside it.
describe("SF1 Seal panel fills its surface", () => {
  it("fails the main-build panel of 1040 px in a 1360 px surface", () => {
    const failures = sfFailures({ panelWidth: 1040, surfaceWidth: 1360, creamRun: 0 });
    expect(failures).toHaveLength(1);
    expect(failures[0].id).toBe("SF1");
    expect(failures[0].check).toBe("panel-width");
    expect(failures[0].message).toContain("1040 px");
    expect(failures[0].message).toContain("1360 px");
  });

  it("passes when the panel is equal to the surface width", () => {
    expect(sfFailures({ panelWidth: 1360, surfaceWidth: 1360, creamRun: 0 })).toEqual([]);
  });

  it("passes a panel at exactly 99% of the surface", () => {
    expect(sfFailures({ panelWidth: 990, surfaceWidth: 1000, creamRun: 0 })).toEqual([]);
  });

  it("fails a panel just under 99% of the surface", () => {
    const failures = sfFailures({ panelWidth: 989, surfaceWidth: 1000, creamRun: 0 });
    expect(failures.map((f) => f.check)).toEqual(["panel-width"]);
  });

  it("fails a cream strip wider than 2 px beside the panel", () => {
    const failures = sfFailures({ panelWidth: 1360, surfaceWidth: 1360, creamRun: 3 });
    expect(failures.map((f) => f.check)).toEqual(["cream-strip"]);
  });

  it("passes a cream run of exactly 2 px", () => {
    expect(sfFailures({ panelWidth: 1360, surfaceWidth: 1360, creamRun: 2 })).toEqual([]);
  });

  it("fails when a measurement is missing", () => {
    const failures = sfFailures({ panelWidth: null, surfaceWidth: 1360, creamRun: null });
    expect(failures).toHaveLength(1);
    expect(failures[0].message).toContain("no [data-seal-step]");
  });

  it("fails exactly when the panel is under 99% of the surface (property)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 5000 }), fc.integer({ min: 1, max: 5000 }), (panelWidth, surfaceWidth) => {
        const failures = sfFailures({ panelWidth, surfaceWidth, creamRun: 0 });
        const underRatio = panelWidth < SF1_RATIO * surfaceWidth;
        expect(failures.some((f) => f.check === "panel-width")).toBe(underRatio);
      }),
    );
  });
});

// TT1 (GitHub issue #587): the visible wax mark is at least 44 px square at rest.
describe("TT1 wax mark meets the target size", () => {
  it("fails a 15 x 15 px wax mark at 1440x900", () => {
    const failures = ttFailures({ targets: [{ label: "Press the seal", wax: { width: 15, height: 15 } }] });
    expect(failures).toHaveLength(1);
    expect(failures[0].id).toBe("TT1");
    expect(failures[0].check).toBe("wax-target-size");
    expect(failures[0].message).toContain("15 x 15 px");
  });

  it("fails a 10 x 10 px wax mark at 390x844", () => {
    const failures = ttFailures({ targets: [{ label: "Press the seal", wax: { width: 10, height: 10 } }] });
    expect(failures).toHaveLength(1);
    expect(failures[0].message).toContain("10 x 10 px");
  });

  it("passes a wax mark of 392 x 253 px on its own", () => {
    expect(ttFailures({ targets: [{ label: "Press the seal", wax: { width: 392, height: 253 } }] })).toEqual([]);
  });

  it("passes a wax mark of at least 60 x 60 px", () => {
    expect(ttFailures({ targets: [{ label: "Press the seal", wax: { width: 60, height: 60 } }] })).toEqual([]);
  });

  it("passes a wax mark of exactly 44 x 44 px", () => {
    expect(ttFailures({ targets: [{ label: "Press the seal", wax: { width: TT1_MIN_PX, height: TT1_MIN_PX } }] })).toEqual([]);
  });

  it("fails a wax mark of 43 px in one dimension", () => {
    const failures = ttFailures({ targets: [{ label: "Press the seal", wax: { width: 44, height: 43 } }] });
    expect(failures.map((f) => f.check)).toEqual(["wax-target-size"]);
  });

  it("fails a target with no measurable wax mark", () => {
    const failures = ttFailures({ targets: [{ label: "Press the seal", wax: null }] });
    expect(failures).toHaveLength(1);
    expect(failures[0].message).toContain("no [data-wax] mark measured");
  });

  it("fails when no press target is found", () => {
    const failures = ttFailures({ targets: [] });
    expect(failures).toHaveLength(1);
    expect(failures[0].message).toContain("no [data-press-target]");
  });
});
