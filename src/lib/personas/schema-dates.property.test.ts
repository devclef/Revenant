// Property 10: invalid persona dates are rejected with the persona key and
// field in the message (design.md "Property 10", R1.4).
//
// For any valid Persona_List and any persona in it, replacing written_as_of
// with a string that is not a real YYYY-MM-DD date, or replacing opens_at with
// a string that is not a millisecond-precision UTC instant, makes
// parsePersonaList throw. The issue for that field sits at the persona's
// position and its message reads `persona "<key>": <field> ...`, so the report
// names the persona and the field. The unmutated list always passes.
//
// Style follows schema.property.test.ts: fast-check generators,
// `fc.assert(fc.property)` with { numRuns: 100 }, no network and no I/O.

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { z } from "zod";

import { parsePersonaList } from "./schema";

interface RawPersona {
  key: string;
  display_name: string;
  intro_line: string;
  region: string;
  letter_id: string;
  envelope_hash: string;
  written_as_of: string;
  opens_at: string;
  metrics: { metric_id: string; recall_subject: string }[];
  letter_path: string;
}

// --- Date arbitraries --------------------------------------------------------

const pad2 = (n: number): string => String(n).padStart(2, "0");

// Days in a month, computed with the UTC calendar so leap years are right.
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

const yearArb = fc.integer({ min: 2000, max: 2030 });

// A real calendar day, written as YYYY-MM-DD.
const validDayArb: fc.Arbitrary<string> = fc
  .tuple(yearArb, fc.integer({ min: 1, max: 12 }))
  .chain(([year, month]) =>
    fc
      .integer({ min: 1, max: daysInMonth(year, month) })
      .map((day) => `${year}-${pad2(month)}-${pad2(day)}`),
  );

// Strings in the YYYY-MM-DD shape whose day is past the end of its month.
const impossibleDayArb: fc.Arbitrary<string> = fc
  .tuple(
    yearArb,
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 29, max: 31 }),
  )
  .filter(([year, month, day]) => day > daysInMonth(year, month))
  .map(([year, month, day]) => `${year}-${pad2(month)}-${pad2(day)}`);

// Strings in the YYYY-MM-DD shape whose month is not 01 to 12.
const impossibleMonthArb: fc.Arbitrary<string> = fc
  .tuple(
    yearArb,
    fc.integer({ min: 13, max: 99 }),
    fc.integer({ min: 1, max: 28 }),
  )
  .map(([year, month, day]) => `${year}-${pad2(month)}-${pad2(day)}`);

// Strings that are not in the YYYY-MM-DD shape at all.
const wrongShapeArb: fc.Arbitrary<string> = fc.constantFrom(
  "2024-1-5",
  "20241105",
  "2024/11/05",
  "05-11-2024",
  "5 November 2024",
  "tomorrow",
  "",
);

const invalidWrittenAsOfArb: fc.Arbitrary<string> = fc.oneof(
  impossibleDayArb,
  impossibleMonthArb,
  wrongShapeArb,
);

// Strings that are not a millisecond-precision UTC instant. The date part is a
// real day or an impossible one, and the time part breaks the format or the
// round trip through Date.
const badTimeSuffixArb: fc.Arbitrary<string> = fc.constantFrom(
  "T00:00:00Z",
  "T00:00:00.000+00:00",
  "T00:00:00.000",
  "T24:00:00.000Z",
  "T00:60:00.000Z",
  "T00:00:60.000Z",
  " 00:00:00.000Z",
);

const invalidOpensAtArb: fc.Arbitrary<string> = fc.oneof(
  fc
    .tuple(validDayArb, badTimeSuffixArb)
    .map(([day, suffix]) => `${day}${suffix}`),
  fc
    .tuple(impossibleDayArb, fc.constant("T00:00:00.000Z"))
    .map(([day, suffix]) => `${day}${suffix}`),
  fc.constantFrom("", "not-a-date", "2024-11-05"),
);

// --- A valid list to mutate --------------------------------------------------

const KEYS = ["us-maya", "eu-tomas", "sw-ingrid", "text-persona"] as const;

// Builds one valid persona. opens_at is the day after written_as_of midnight,
// so the ordering cross-check passes before any mutation.
function validPersona(key: string, writtenAsOf: string): RawPersona {
  const openMs = Date.parse(`${writtenAsOf}T00:00:00.000Z`) + 86_400_000;
  return {
    key,
    display_name: "A persona",
    intro_line: "A short everyday line about the week ahead.",
    region: "Testland",
    letter_id: "AAAAAAAAAAAAAAAAAAAAAA",
    envelope_hash: "a".repeat(64),
    written_as_of: writtenAsOf,
    opens_at: new Date(openMs).toISOString(),
    metrics: [{ metric_id: "us-diesel", recall_subject: "a gallon of diesel" }],
    letter_path: `letters/${key}.txt`,
  };
}

// Two personas with distinct keys and letter IDs. The mutated one is the one
// at `index`, so the test also checks that the message names the right persona.
const listArb = fc
  .record({
    keys: fc.uniqueArray(fc.constantFrom(...KEYS), {
      minLength: 2,
      maxLength: 2,
    }),
    days: fc.array(validDayArb, { minLength: 2, maxLength: 2 }),
    index: fc.integer({ min: 0, max: 1 }),
  })
  .map(({ keys, days, index }) => ({
    personas: keys.map((key, i) => {
      const p = validPersona(key, days[i]);
      // Give each persona its own letter ID so the duplicate check stays quiet.
      p.letter_id =
        i === 0 ? "AAAAAAAAAAAAAAAAAAAAAA" : "AQAAAAAAAAAAAAAAAAAAAA";
      return p;
    }),
    index,
  }));

// --- Helpers -----------------------------------------------------------------

/** Parse `raw`, expecting failure, and return the Zod issues. */
function issuesFor(raw: unknown): z.core.$ZodIssue[] {
  try {
    parsePersonaList(raw);
  } catch (error) {
    if (error instanceof z.ZodError) return error.issues;
    throw error;
  }
  throw new Error("expected parsePersonaList to throw, but it succeeded");
}

// --- Property 10 -------------------------------------------------------------

describe("Property 10: invalid persona dates are rejected with the persona key and field", () => {
  it("the unmutated generated list always passes", () => {
    fc.assert(
      fc.property(listArb, ({ personas }) => {
        expect(() =>
          parsePersonaList({ personas, retired_letter_ids: [] }),
        ).not.toThrow();
      }),
      { numRuns: 100 },
    );
  });

  it("an invalid written_as_of fails and names the persona key and written_as_of", () => {
    fc.assert(
      fc.property(
        listArb,
        invalidWrittenAsOfArb,
        ({ personas, index }, bad) => {
          const list = structuredClone(personas);
          list[index].written_as_of = bad;

          const issues = issuesFor({ personas: list, retired_letter_ids: [] });
          const key = list[index].key;
          const path = `personas.${index}.written_as_of`;

          const hit = issues.find((issue) => issue.path.join(".") === path);
          expect(hit).toBeDefined();
          expect(hit?.message).toContain(`persona "${key}": written_as_of`);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("an invalid opens_at fails and names the persona key and opens_at", () => {
    fc.assert(
      fc.property(listArb, invalidOpensAtArb, ({ personas, index }, bad) => {
        const list = structuredClone(personas);
        list[index].opens_at = bad;

        const issues = issuesFor({ personas: list, retired_letter_ids: [] });
        const key = list[index].key;
        const path = `personas.${index}.opens_at`;

        const hit = issues.find((issue) => issue.path.join(".") === path);
        expect(hit).toBeDefined();
        expect(hit?.message).toContain(`persona "${key}": opens_at`);
      }),
      { numRuns: 100 },
    );
  });
});
