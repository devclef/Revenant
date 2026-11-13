// Property 11: every pickable figure is in exactly one region group, in a
// fixed order (spec 12, K4.1, K4.3, K4.4, K4.5, K4.6, K4.8).
//
// For any list of pickable series, a series whose region has a heading
// (United States or European Union) appears in exactly one group, and a series
// with no heading appears in none. Groups come in the fixed order "us" then
// "eu", empty groups are left out, and each group keeps the input (Catalogue)
// order. The oracle here is the rule as written in the spec, not the code
// under test.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  groupPickable,
  regionGroupFor,
  type PickableSeries,
} from "./catalogue-list";

const REGIONS = [
  "U.S.",
  "EU27, weighted average",
  "EU",
  "Sweden",
  "Mars colony",
  "",
] as const;

const seriesArb: fc.Arbitrary<PickableSeries> = fc.record({
  metricId: fc.string({ minLength: 1, maxLength: 12 }),
  region: fc.constantFrom(...REGIONS),
  displayName: fc.string({ maxLength: 12 }),
  unit: fc.string({ maxLength: 12 }),
  latestPeriod: fc.constant("2024-01-01"),
  isFixture: fc.boolean(),
});

/** Index of each series in the input, so duplicate metricIds stay distinct. */
const indexed = (list: readonly PickableSeries[]) =>
  list.map((s, i) => ({ s, i }));

describe("Property 11: every pickable figure is in exactly one region group, in a fixed order", () => {
  it("places each series with a heading in exactly one group, and no other", () => {
    fc.assert(
      fc.property(fc.array(seriesArb, { maxLength: 20 }), (list) => {
        const groups = groupPickable(list);

        // Each group holds only series that belong to it.
        for (const g of groups) {
          for (const s of g.series) {
            expect(regionGroupFor(s.region)).toBe(g.group);
          }
        }

        // Count how many times each input object appears across all groups.
        const seen = new Map<PickableSeries, number>();
        for (const g of groups) {
          for (const s of g.series) {
            seen.set(s, (seen.get(s) ?? 0) + 1);
          }
        }

        for (const s of list) {
          const count = seen.get(s) ?? 0;
          if (regionGroupFor(s.region) === null) {
            expect(count).toBe(0);
          } else {
            expect(count).toBe(1);
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it("returns groups in the fixed order us then eu, with no empty group", () => {
    fc.assert(
      fc.property(fc.array(seriesArb, { maxLength: 20 }), (list) => {
        const groups = groupPickable(list);
        const names = groups.map((g) => g.group);

        const expectedOrder = (["us", "eu"] as const).filter((g) =>
          names.includes(g),
        );
        expect(names).toEqual(expectedOrder);

        for (const g of groups) {
          expect(g.series.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("keeps the input (Catalogue) order within each group", () => {
    fc.assert(
      fc.property(fc.array(seriesArb, { maxLength: 20 }), (list) => {
        const order = new Map(indexed(list).map(({ s, i }) => [s, i]));
        const groups = groupPickable(list);

        for (const g of groups) {
          const positions = g.series.map((s) => order.get(s)!);
          const sorted = [...positions].sort((a, b) => a - b);
          expect(positions).toEqual(sorted);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("depends on no value, change or direction, only on region", () => {
    fc.assert(
      fc.property(fc.array(seriesArb, { maxLength: 20 }), (list) => {
        // Changing only the display fields (which can carry any number or
        // movement text) must not change which group a series lands in.
        const relabelled = list.map((s, i) => ({
          ...s,
          displayName: `d${i}`,
          unit: `u${i}`,
          latestPeriod: `2099-${String((i % 12) + 1).padStart(2, "0")}-01`,
        }));
        const before = groupPickable(list).map((g) => g.group);
        const after = groupPickable(relabelled).map((g) => g.group);
        expect(after).toEqual(before);
      }),
      { numRuns: 100 },
    );
  });
});
