// Property 29: The figure picker never offers more than it says (spec 08,
// design.md "Correctness Properties"; R10.7). For any number of offered series
// from 0 to 10 and any sequence of toggles, the selection never exceeds
// N = min(MAX_FIGURES, offered), and the hint and the "too many" message both
// state N.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { MAX_FIGURES } from "./constants";
import { LIVE_COPY } from "./copy";
import { figureLimit, validateWrite } from "./form";
import {
  INITIAL_WRITE_DRAFT,
  reduceWriteDraft,
  type WriteDraftEvent,
} from "./write-draft";

const offeredArb = fc.integer({ min: 0, max: 10 });

/** A toggle sequence over ids that the picker offers, possibly repeated. */
function togglesArb(offered: number): fc.Arbitrary<string[]> {
  const ids = Array.from({ length: offered }, (_, i) => `m-${i}`);
  if (ids.length === 0) return fc.constant([]);
  return fc.array(fc.constantFrom(...ids), { maxLength: 40 });
}

describe("Property 29: the figure picker never offers more than it says", () => {
  it("states N = min(MAX_FIGURES, offered) and never selects more than N", () => {
    fc.assert(
      fc.property(
        offeredArb.chain((offered) =>
          fc.tuple(fc.constant(offered), togglesArb(offered)),
        ),
        ([offered, toggles]) => {
          const limit = Math.min(MAX_FIGURES, offered);
          expect(figureLimit(offered)).toBe(limit);

          let draft = INITIAL_WRITE_DRAFT;
          for (const metricId of toggles) {
            const event: WriteDraftEvent = {
              type: "FIGURE_TOGGLED",
              metricId,
              limit,
            };
            draft = reduceWriteDraft(draft, event);
            expect(draft.metricIds.length).toBeLessThanOrEqual(limit);
          }

          // The "too many" rule agrees with N, both at N and one past it.
          const ids = Array.from({ length: limit + 1 }, (_, i) => `x-${i}`);
          // At N the form reports no "too many" problem. With N = 0 it reports
          // nothing_to_testify instead, which is a different rule.
          expect(
            validateWrite({
              text: "a letter",
              metricIds: ids.slice(0, limit),
              warningTicked: true,
              maxFigures: limit,
            }).includes("figures_too_many"),
          ).toBe(false);
          expect(
            validateWrite({
              text: "a letter",
              metricIds: ids,
              warningTicked: true,
              maxFigures: limit,
            }),
          ).toEqual(["figures_too_many"]);

          // Both messages state N in the copy.
          expect(LIVE_COPY.figuresHint.replace("{max}", String(limit))).toContain(
            `between 1 and ${limit}`,
          );
          expect(LIVE_COPY.figuresTooMany.replace("{max}", String(limit))).toContain(
            `no more than ${limit} figures`,
          );
        },
      ),
      { numRuns: 200 },
    );
  });

  it("is 4 for the four series offered today", () => {
    expect(figureLimit(4)).toBe(4);
    expect(figureLimit(10)).toBe(MAX_FIGURES);
    expect(figureLimit(0)).toBe(0);
  });
});
