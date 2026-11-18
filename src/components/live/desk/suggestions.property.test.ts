// Feature: 14-write-desk, Property 4 (design.md "Correctness Properties").
//
// suggestionsFor skips every suggestion already present as a row and keeps the
// list order: the Occasion's own suggestions first, then SHARED_SUGGESTIONS.
//
// Validates: Requirements W8.2, W8.3.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { OCCASIONS, SHARED_SUGGESTIONS, type OccasionId } from "../occasions";
import { suggestionsFor } from "./suggestions";

const OCCASION_IDS: readonly OccasionId[] = OCCASIONS.map((o) => o.id);
const ALL_SUGGESTIONS: readonly string[] = [
  ...OCCASIONS.flatMap((o) => o.suggestions),
  ...SHARED_SUGGESTIONS,
];

/** The full candidate list in list order, duplicates removed at first position. */
function candidatesOf(id: OccasionId): string[] {
  const found = OCCASIONS.find((o) => o.id === id);
  if (!found) throw new Error(`no occasion ${id}`);
  return [...new Set([...found.suggestions, ...SHARED_SUGGESTIONS])];
}

const rowArb = fc.oneof(
  fc.constantFrom(...ALL_SUGGESTIONS),
  fc.constantFrom(...ALL_SUGGESTIONS).map((s) => `  ${s}  `),
  fc.string({ maxLength: 120 }),
);

describe("suggestionsFor (Property 4, spec 14 W8.2, W8.3)", () => {
  it("never returns a suggestion that is already a row", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...OCCASION_IDS),
        fc.array(rowArb, { maxLength: 8 }),
        (id, rows) => {
          const taken = new Set(rows.map((r) => r.trim()));
          const result = suggestionsFor(id, rows);
          for (const suggestion of result) {
            expect(taken.has(suggestion.trim())).toBe(false);
          }
        },
      ),
    );
  });

  it("keeps the list order and returns exactly the candidates not yet rows", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...OCCASION_IDS),
        fc.array(rowArb, { maxLength: 8 }),
        (id, rows) => {
          const taken = new Set(rows.map((r) => r.trim()));
          const expected = candidatesOf(id).filter((s) => !taken.has(s.trim()));
          expect(suggestionsFor(id, rows)).toEqual(expected);
        },
      ),
    );
  });

  it("returns every candidate when there are no rows", () => {
    fc.assert(
      fc.property(fc.constantFrom(...OCCASION_IDS), (id) => {
        expect(suggestionsFor(id, [])).toEqual(candidatesOf(id));
      }),
    );
  });
});
