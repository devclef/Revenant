import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { buildIcs, type IcsInput } from "./build-ics";
import { parseIcs } from "./test-support";

// Feature: 06-lock-and-unlock, Property 20: The `.ics` file round trips and obeys RFC 5545 shape

const FIXED_PROPERTY_NAMES = new Set([
  "PRODID",
  "VERSION",
  "UID",
  "DTSTAMP",
  "DTSTART",
  "DTEND",
  "SUMMARY",
  "DESCRIPTION",
  "URL",
  "ACTION",
  "TRIGGER",
]);

const ENCODER = new TextEncoder();

/** Text that stresses escaping and folding: punctuation, newlines and multi-byte characters. */
const textArb = fc.oneof(
  fc.string({ unit: "binary", maxLength: 120 }),
  fc.string({ unit: "grapheme", maxLength: 60 }),
  fc
    .array(fc.constantFrom(",", ";", "\\", "\n", "\r", "\r\n", "é", "😀", " ", "x"), { maxLength: 80 })
    .map((parts) => parts.join("")),
);

/** Whole-second instants, so the seconds-precision file can be compared exactly. */
const instantArb = fc
  .integer({ min: Date.UTC(2000, 0, 1) / 1000, max: Date.UTC(2100, 0, 1) / 1000 })
  .map((s) => new Date(s * 1000).toISOString());

const inputArb: fc.Arbitrary<IcsInput> = fc.record({
  letterId: fc.stringMatching(/^[A-Za-z0-9_-]{1,22}$/),
  opensAt: instantArb,
  link: textArb,
  summary: textArb,
  description: textArb,
  domain: fc.constantFrom("revenant.devclef.se", "localhost:3000"),
  dtstamp: instantArb,
});

/** Newlines as the file stores them: CRLF and lone CR both become LF. */
const normalize = (s: string): string => s.replace(/\r\n?/g, "\n");

/** The description the file should hold: the caller's text, with the link appended when missing. */
function expectedDescription(input: IcsInput): string {
  const description = normalize(input.description);
  const link = normalize(input.link);
  return description.includes(link) ? description : `${description}\n${link}`;
}

/** Physical lines of the file: each ends in CRLF, so the last split element is empty. */
function physicalLines(text: string): string[] {
  return text.split("\r\n");
}

describe("Property 20: the .ics file round trips and obeys RFC 5545 shape", () => {
  it("recovers opensAt, link and summary, and keeps to RFC 5545 line rules", () => {
    fc.assert(
      fc.property(inputArb, (input) => {
        const out = buildIcs(input);

        // CRLF only: no bare LF or CR anywhere.
        expect(out.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);

        // No physical line is longer than 75 UTF-8 octets. Each line is either a
        // continuation (starts with one space) or a content line (starts with a property name).
        const lines = physicalLines(out).slice(0, -1);
        for (const line of lines) {
          expect(ENCODER.encode(line).length).toBeLessThanOrEqual(75);
          expect(line.startsWith(" ") || /^[A-Z-]+[;:]/.test(line)).toBe(true);
          // A split inside a surrogate pair would leave a lone surrogate on a line.
          expect(line).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/);
        }

        // Round trip: the parser recovers the same values.
        const parsed = parseIcs(out);
        expect(parsed.opensAt).toBe(input.opensAt);
        expect(parsed.url).toBe(normalize(input.link));
        expect(parsed.summary).toBe(normalize(input.summary));
        expect(parsed.description).toBe(expectedDescription(input));
        expect(parsed.dtstamp).toBe(input.dtstamp);
        expect(parsed.endsAt).toBe(
          new Date(Date.parse(input.opensAt) + 15 * 60_000).toISOString(),
        );

        // No text outside the inputs and the fixed property names.
        for (const name of parsed.names) {
          expect(FIXED_PROPERTY_NAMES.has(name)).toBe(true);
        }
      }),
      { numRuns: 200 },
    );
  });
});
