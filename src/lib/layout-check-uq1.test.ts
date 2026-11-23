import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { UQ1_WANT, uqFailures } from "../../tools/qa/layout-rules-17.mjs";

describe("uqFailures (UQ1: one Demo label and one wax seal)", () => {
  it("fails the main fixture with two Demo labels and two seals", () => {
    const failures = uqFailures({ demoLabels: 2, seals: 2 });
    expect(failures).toHaveLength(2);
    expect(failures.map((f: { check: string }) => f.check)).toEqual([
      "unique-demo-label",
      "unique-wax-seal",
    ]);
    expect(failures.every((f: { id: string }) => f.id === "UQ1")).toBe(true);
  });

  it("passes the fixture with one Demo label and one seal", () => {
    expect(uqFailures({ demoLabels: 1, seals: 1 })).toEqual([]);
  });

  it("wants exactly one of each", () => {
    expect(UQ1_WANT).toBe(1);
  });

  it("fails zero counts, reporting each count it cannot pass", () => {
    expect(uqFailures({ demoLabels: 0, seals: 0 })).toHaveLength(2);
    expect(uqFailures({ demoLabels: 1, seals: 0 })).toHaveLength(1);
    expect(uqFailures({ demoLabels: 0, seals: 1 })).toHaveLength(1);
  });

  it("fails rather than passes when a count is missing", () => {
    const failures = uqFailures({ demoLabels: 1 });
    expect(failures).toHaveLength(1);
    expect(failures[0].id).toBe("UQ1");
    expect(uqFailures(undefined)).toHaveLength(1);
    expect(uqFailures({ demoLabels: NaN, seals: 1 })).toHaveLength(1);
  });
});

describe("property: UQ1 passes exactly when both counts are 1", () => {
  const count = fc.integer({ min: 0, max: 6 });

  it("agrees with the exact-one rule for random label and seal counts", () => {
    fc.assert(
      fc.property(count, count, (demoLabels, seals) => {
        const failures = uqFailures({ demoLabels, seals });
        expect(failures.length === 0).toBe(demoLabels === 1 && seals === 1);
        expect(failures.length).toBe(
          (demoLabels === 1 ? 0 : 1) + (seals === 1 ? 0 : 1),
        );
      }),
      { numRuns: 500 },
    );
  });
});
