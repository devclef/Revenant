// Property 9: persona dates render from the Persona_List in every timezone
// (spec 18, design "Property 9", Requirements 1.5, 1.7, 1.9 and 10.1).
//
// For any Persona_List whose written_as_of and opens_at differ from the
// committed ones, the four persona strings the screens render
// (letterDisclosure, writtenAsOfPrefix, memoryLine, envelopeOpens) carry the
// UTC calendar forms of the new dates and none of the committed forms. The
// check runs at every viewer offset from UTC-12:00 to UTC+14:00 in 15-minute
// steps. The screens take no offset: they read UTC calendar parts (Requirement
// 1.7), so the loop shows the output stays put whatever the viewer's zone.
//
// Expected text is built from a hand-written month table and the copy
// templates, not from Intl, so the test does not reuse the formatter it checks.
// Style follows schema-dates.property.test.ts: fast-check, numRuns 100, no I/O.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import rawPersonaList from "../../../content/personas/personas.json";
import { CEREMONY_COPY } from "@/components/ceremony/copy";
import { DEMO_COPY } from "@/components/demo/copy";
import { REVEAL_COPY } from "@/components/reveal/copy";
import {
  formatCalendarDate,
  formatCalendarMonth,
  formatLetterDate,
} from "@/components/ui/letter-date";

import { PERSONAS } from "./index";
import { parsePersonaList } from "./schema";

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

const pad2 = (n: number): string => String(n).padStart(2, "0");

// --- Expected forms, built from the UTC parts of the stored value ------------

// "5 November 2024" for a YYYY-MM-DD date or a UTC instant.
function dayForm(value: string): string {
  const iso = value.length === 10 ? `${value}T00:00:00.000Z` : value;
  const d = new Date(iso);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// "November 2024" for a YYYY-MM-DD date.
function monthForm(date: string): string {
  const d = new Date(`${date}T00:00:00.000Z`);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

interface DatedPersona {
  display_name: string;
  written_as_of: string;
  opens_at: string;
}

// The four strings a persona screen renders, from the copy templates.
function expectedStrings(p: DatedPersona): Record<string, string> {
  return {
    letterDisclosure: REVEAL_COPY.letterDisclosure
      .replace("{name}", p.display_name)
      .replace("{writtenAsOf}", dayForm(p.written_as_of)),
    writtenAsOfPrefix: DEMO_COPY.writtenAsOfPrefix.replace(
      "{date}",
      dayForm(p.written_as_of),
    ),
    memoryLine: REVEAL_COPY.memoryLine.replace(
      "{month}",
      monthForm(p.written_as_of),
    ),
    envelopeOpens: CEREMONY_COPY.envelopeOpens.replace(
      "{date}",
      dayForm(p.opens_at),
    ),
  };
}

// The same four strings, as the product renders them.
function renderedStrings(p: DatedPersona): Record<string, string> {
  return {
    letterDisclosure: REVEAL_COPY.letterDisclosure
      .replace("{name}", p.display_name)
      .replace("{writtenAsOf}", formatCalendarDate(p.written_as_of)),
    writtenAsOfPrefix: DEMO_COPY.writtenAsOfPrefix.replace(
      "{date}",
      formatCalendarDate(p.written_as_of),
    ),
    memoryLine: REVEAL_COPY.memoryLine.replace(
      "{month}",
      formatCalendarMonth(p.written_as_of),
    ),
    envelopeOpens: CEREMONY_COPY.envelopeOpens.replace(
      "{date}",
      formatLetterDate(p.opens_at, { kind: "utc" }),
    ),
  };
}

// The date forms each persona string can show for one persona.
function formsOf(p: DatedPersona): string[] {
  return [
    dayForm(p.written_as_of),
    monthForm(p.written_as_of),
    dayForm(p.opens_at),
  ];
}

// --- Arbitraries -------------------------------------------------------------

// A written_as_of day (days up to 28, so every month is valid) and an opens_at
// instant at least one day later, at any time of day, so the instant sits near
// midnight often enough for a viewer-zone bug to show.
const datesArb = fc
  .record({
    year: fc.integer({ min: 2000, max: 2030 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }),
    gapDays: fc.integer({ min: 1, max: 900 }),
    hour: fc.integer({ min: 0, max: 23 }),
    minute: fc.integer({ min: 0, max: 59 }),
  })
  .map(({ year, month, day, gapDays, hour, minute }) => {
    const written = `${year}-${pad2(month)}-${pad2(day)}`;
    const openMs =
      Date.parse(`${written}T00:00:00.000Z`) +
      gapDays * 86_400_000 +
      hour * 3_600_000 +
      minute * 60_000;
    return { written_as_of: written, opens_at: new Date(openMs).toISOString() };
  });

// Viewer offsets from UTC-12:00 to UTC+14:00, every 15 minutes.
const OFFSETS_MINUTES: number[] = [];
for (let offset = -720; offset <= 840; offset += 15)
  OFFSETS_MINUTES.push(offset);

describe("Property 9: persona strings render from a changed Persona_List", () => {
  it("shows the new UTC forms and none of the committed forms at every offset", () => {
    const committed = PERSONAS.flatMap((p) => formsOf(p));

    fc.assert(
      fc.property(
        fc.array(datesArb, {
          minLength: PERSONAS.length,
          maxLength: PERSONAS.length,
        }),
        (dates) => {
          const changedRaw = rawPersonaList.personas.map((p, i) => ({
            ...p,
            written_as_of: dates[i].written_as_of,
            opens_at: dates[i].opens_at,
          }));
          // The changed list must still pass the Persona_List schema (R1.3).
          const parsed = parsePersonaList({
            ...rawPersonaList,
            personas: changedRaw,
          });

          // Discard a run where a new form contains a committed form, or the
          // other way round: the "none of the committed forms" check would
          // then fail for a reason unrelated to the renderer.
          const fresh = parsed.personas.flatMap((p) => formsOf(p));
          fc.pre(
            !committed.some((c) =>
              fresh.some((n) => n.includes(c) || c.includes(n)),
            ),
          );

          for (const offset of OFFSETS_MINUTES) {
            for (const persona of parsed.personas) {
              const rendered = renderedStrings(persona);
              const expected = expectedStrings(persona);
              expect(
                rendered,
                `offset ${offset} minutes, ${persona.key}`,
              ).toEqual(expected);
              for (const text of Object.values(rendered)) {
                for (const old of committed) {
                  expect(
                    text.includes(old),
                    `offset ${offset}, ${persona.key}: "${old}"`,
                  ).toBe(false);
                }
              }
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("the committed list renders its own dates, so the check has a real baseline", () => {
    for (const persona of PERSONAS) {
      expect(renderedStrings(persona)).toEqual(expectedStrings(persona));
    }
  });
});
