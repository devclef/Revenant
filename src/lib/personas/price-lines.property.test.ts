// Property 8: Week-of-month words follow the day ranges
// (.kiro/specs/18-persona-dates/design.md, Property 8; R5.6).
//
// For any real calendar date, `weekOfMonthWords` names the month of that date
// and the ordinal "first" for days 1 to 7, "second" for 8 to 14, "third" for
// 15 to 21, "fourth" for 22 to 28 and "fifth" for 29 to 31.
//
// Style follows the sibling property tests: fast-check generators,
// `fc.assert(fc.property)` with { numRuns: 100 }, no network and no I/O.
// weekOfMonthWords is pure.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { weekOfMonthWords } from "./price-lines";

// Month names written out here, not read from season-words.ts, so the test
// does not check the module against itself.
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function ordinalFor(day: number): string {
  if (day <= 7) return "first";
  if (day <= 14) return "second";
  if (day <= 21) return "third";
  if (day <= 28) return "fourth";
  return "fifth";
}

// Every real day from 1 January 2000 to 31 December 2100, UTC.
const dayArb = fc.integer({
  min: Date.UTC(2000, 0, 1),
  max: Date.UTC(2100, 11, 31),
});

describe("Property 8: week-of-month words follow the day ranges", () => {
  it("names the month and the week ordinal of any real date", () => {
    fc.assert(
      fc.property(dayArb, (ms) => {
        const date = new Date(ms);
        const iso = date.toISOString().slice(0, 10);
        const month = MONTHS[date.getUTCMonth()];
        const ordinal = ordinalFor(date.getUTCDate());
        expect(weekOfMonthWords(iso)).toBe(`${ordinal} week of ${month}`);
      }),
      { numRuns: 100 },
    );
  });
});
