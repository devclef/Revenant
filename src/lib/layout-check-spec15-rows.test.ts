import { describe, expect, it } from "vitest";

import {
  dl1Failures,
  gc1Failures,
  nb1Failures,
  pv1Failures,
} from "../../tools/qa/layout-check.mjs";

/**
 * Unit tests for the spec 15 row helpers in tools/qa/layout-check.mjs: NB1 (no dirt
 * band), GC1 (ghost in the column, unclipped at phone sizes), DL1 (one Demo label) and
 * PV1 (primary control in view). Each helper gets one passing and one failing example.
 */

describe("nb1Failures", () => {
  it("passes when no element carries a dirt class or [data-dirt]", () => {
    expect(nb1Failures({ count: 0 })).toEqual([]);
  });

  it("fails and names the count when dirt elements remain", () => {
    const problems = nb1Failures({ count: 2 });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("NB1 2 element(s)");
  });
});

describe("gc1Failures", () => {
  it("passes when the ghost is inside a 360 px viewport and centred on it", () => {
    // Centre 180 px, the viewport centre at 360 px wide.
    expect(gc1Failures({ ghost: { left: 100, right: 260 }, w: 360 })).toEqual(
      [],
    );
  });

  it("fails when the ghost runs past the right edge of a 390 px viewport", () => {
    const problems = gc1Failures({ ghost: { left: 300, right: 420 }, w: 390 });
    expect(problems.some((p) => p.includes("outside the 390px viewport"))).toBe(
      true,
    );
  });

  it("fails when the ghost centre is more than 8 px off the viewport centre", () => {
    // Centre 20 px against a 195 px viewport centre, inside the viewport horizontally.
    const problems = gc1Failures({ ghost: { left: 0, right: 40 }, w: 390 });
    expect(problems.some((p) => p.includes("ghost centre is 20px"))).toBe(true);
  });

  it("reports a missing ghost instead of passing", () => {
    expect(gc1Failures({ ghost: null, w: 390 })).toEqual([
      "GC1 no [data-ghost] to measure",
    ]);
  });
});

describe("dl1Failures", () => {
  it("passes when exactly one Demo label is on the page", () => {
    expect(dl1Failures({ count: 1 })).toEqual([]);
  });

  it("fails when the Top_Bar chip and the DemoLabel both show", () => {
    expect(dl1Failures({ count: 2 })).toEqual([
      'DL1 2 "Demo" labels, want one',
    ]);
  });
});

describe("pv1Failures", () => {
  it("passes when the primary control sits inside a 390 x 844 viewport", () => {
    const button = { left: 20, top: 700, right: 370, bottom: 756 };
    expect(pv1Failures({ button, w: 390, h: 844 })).toEqual([]);
  });

  it("fails when the primary control starts below the viewport bottom", () => {
    const button = { left: 20, top: 900, right: 370, bottom: 956 };
    const problems = pv1Failures({ button, w: 390, h: 844 });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain("outside the 844px viewport");
  });

  it("reports a missing primary control instead of passing", () => {
    expect(pv1Failures({ button: null, w: 390, h: 844 })).toEqual([
      "PV1 no [data-primary-control] to measure",
    ]);
  });
});
