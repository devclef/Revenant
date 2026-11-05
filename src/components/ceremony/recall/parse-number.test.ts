import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { CATALOGUE } from "@/lib/figures/catalogue";
import { localeForRegion } from "@/lib/figures/locale";
import {
  formatParsedValue,
  formatRecallNumber,
  parseRecallNumber,
  type UnambiguousFormat,
} from "./parse-number";

// Feature: 08-judge-polish, Task 1 (Recall_Number_Parser, R32).
// Property 7: Recall number round trip.
// Property 8: An Ambiguous_Input never becomes a single value.
// Validates: Requirements 32.1 to 32.4, 32.7, 32.8, 32.9

const NUM_RUNS = 100;
const SPACES = [" ", "\u00A0", "\u202F"] as const;
const FORMATS: readonly UnambiguousFormat[] = [
  "digits",
  "point",
  "comma",
  "comma_grouped",
  "dot_grouped",
  "space_grouped",
];

describe("parseRecallNumber — the six Unambiguous_Formats", () => {
  it.each([
    ["1585", "1585", "digits"],
    ["1585.76", "1585.76", "point"],
    ["1585,76", "1585.76", "comma"],
    ["0,585", "0.585", "comma"],
    ["1,585.76", "1585.76", "comma_grouped"],
    ["1,585,760", "1585760", "comma_grouped"],
    ["1.585,76", "1585.76", "dot_grouped"],
    ["1.585.760", "1585760", "dot_grouped"],
    ["1 585,76", "1585.76", "space_grouped"],
    ["1\u00A0585", "1585", "space_grouped"],
    ["1\u202F585,76", "1585.76", "space_grouped"],
  ])("reads %s as %s (%s)", (text, value, format) => {
    expect(parseRecallNumber(text)).toEqual({ kind: "value", value, format });
  });

  it("keeps every digit, including leading and trailing zeros", () => {
    expect(parseRecallNumber("1.585,70")).toEqual({
      kind: "value",
      value: "1585.70",
      format: "dot_grouped",
    });
    expect(parseRecallNumber("007")).toEqual({
      kind: "value",
      value: "007",
      format: "digits",
    });
    expect(parseRecallNumber("0,500")).toEqual({
      kind: "value",
      value: "0.500",
      format: "comma",
    });
  });

  it("trims surrounding whitespace before reading", () => {
    expect(parseRecallNumber("  1585.76\t")).toEqual({
      kind: "value",
      value: "1585.76",
      format: "point",
    });
  });
});

describe("parseRecallNumber — the Ambiguous_Input comes first", () => {
  it.each([
    ["1.585", "1", "585", "1.585", "1585"],
    ["1,585", "1", "585", "1.585", "1585"],
    ["12.050", "12", "050", "12.050", "12050"],
    [" 3,000 ", "3", "000", "3.000", "3000"],
  ])("%s is ambiguous (head %s, tail %s)", (text, head, tail, decimal, grouping) => {
    expect(parseRecallNumber(text)).toEqual({
      kind: "ambiguous",
      head,
      tail,
      decimal,
      grouping,
    });
  });
});

describe("parseRecallNumber — rejected reasons", () => {
  it("rejects an empty or blank text as empty", () => {
    expect(parseRecallNumber("")).toEqual({ kind: "rejected", reason: "empty" });
    expect(parseRecallNumber(" \t ")).toEqual({ kind: "rejected", reason: "empty" });
  });

  it.each([
    "-5",
    "+5",
    "$12",
    "12a",
    "1..5",
    "1.5.5",
    "12 5",
    "1  585",
    "1.585 760",
    "1,585.760,5",
    "1.585,760,5",
    "12.34.567",
  ])("rejects %s as unreadable", (text) => {
    expect(parseRecallNumber(text)).toEqual({
      kind: "rejected",
      reason: "unreadable",
    });
  });

  it("rejects a canonical value over 40 characters as too long", () => {
    expect(parseRecallNumber("1".repeat(41))).toEqual({
      kind: "rejected",
      reason: "too_long",
    });
  });

  it("accepts a canonical value of exactly 40 characters", () => {
    const text = "1".repeat(40);
    expect(parseRecallNumber(text)).toEqual({
      kind: "value",
      value: text,
      format: "digits",
    });
  });
});

// Property 8: An Ambiguous_Input never becomes a single value.
// Validates: Requirements 32.2, 32.4, 32.7
describe("Property 8: an Ambiguous_Input never becomes a single value", () => {
  it("every head, separator and three-digit tail is ambiguous, with padding", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[1-9][0-9]{0,2}$/),
        fc.constantFrom(".", ","),
        fc.stringMatching(/^[0-9]{3}$/),
        fc.constantFrom("", " ", "\t", "\u00A0", "\u202F"),
        (head, sep, tail, pad) => {
          const result = parseRecallNumber(`${pad}${head}${sep}${tail}${pad}`);
          expect(result).toEqual({
            kind: "ambiguous",
            head,
            tail,
            decimal: `${head}.${tail}`,
            grouping: `${head}${tail}`,
          });
          expect(result.kind).not.toBe("value");
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("text that matches none of the six formats is rejected", () => {
    const badText = fc.oneof(
      // A sign, a letter or a currency symbol before the digits.
      fc
        .tuple(
          fc.constantFrom("-", "+", "$", "\u20AC", "x"),
          fc.stringMatching(/^[0-9]{1,6}$/),
        )
        .map(([prefix, digits]) => `${prefix}${digits}`),
      // Two decimal separators in a row.
      fc
        .tuple(fc.stringMatching(/^[0-9]{1,6}$/), fc.stringMatching(/^[0-9]{1,6}$/))
        .map(([a, b]) => `${a}..${b}`),
      // Mixed separator kinds, bad group lengths and double spaces.
      fc.constantFrom(
        "1.585,760,5",
        "12.34.567",
        "1  585",
        "1 58",
        "1.5.5",
        "1,5,5",
        "12a",
      ),
    );

    fc.assert(
      fc.property(badText, fc.constantFrom("", " "), (text, pad) => {
        expect(parseRecallNumber(`${pad}${text}${pad}`).kind).toBe("rejected");
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// Property 7: Recall number round trip.
// Validates: Requirements 32.1, 32.2, 32.3, 32.8, 32.9
describe("Property 7: recall number round trip", () => {
  const canonicalArb = fc
    .tuple(
      fc.stringMatching(/^[0-9]{1,20}$/),
      fc.option(fc.stringMatching(/^[0-9]{1,15}$/), { nil: undefined }),
    )
    .map(([int, frac]) => (frac === undefined ? int : `${int}.${frac}`));

  it("formatting then parsing returns the same canonical value, with padding", () => {
    fc.assert(
      fc.property(
        canonicalArb,
        fc.constantFrom(...FORMATS),
        fc.constantFrom(...SPACES),
        fc.constantFrom("", " ", "\u00A0"),
        (value, format, space, pad) => {
          const written = formatRecallNumber(value, format, space);
          fc.pre(written !== null);
          expect(parseRecallNumber(written as string)).toEqual({
            kind: "value",
            value,
            format: expect.any(String),
          });
          expect(parseRecallNumber(`${pad}${written}${pad}`)).toMatchObject({
            kind: "value",
            value,
          });
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("removing the commas from formatParsedValue gives the canonical value", () => {
    fc.assert(
      fc.property(canonicalArb, (value) => {
        expect(formatParsedValue(value).replace(/,/g, "")).toBe(value);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("formatRecallNumber — examples", () => {
  it("returns null when a format cannot write the value", () => {
    expect(formatRecallNumber("1585", "point")).toBeNull();
    expect(formatRecallNumber("1585.76", "digits")).toBeNull();
    expect(formatRecallNumber("1.585", "comma")).toBeNull();
    expect(formatRecallNumber("1585", "comma_grouped")).toBeNull();
    expect(formatRecallNumber("007", "comma_grouped")).toBeNull();
  });

  it("writes each grouped format", () => {
    expect(formatRecallNumber("1585.76", "comma_grouped")).toBe("1,585.76");
    expect(formatRecallNumber("1585.76", "dot_grouped")).toBe("1.585,76");
    expect(formatRecallNumber("1585", "space_grouped")).toBe("1 585");
    expect(formatRecallNumber("1585", "space_grouped", "\u202F")).toBe("1\u202F585");
  });
});

describe("formatParsedValue — examples", () => {
  it("groups the integer part and keeps every fractional digit", () => {
    expect(formatParsedValue("1585.70")).toBe("1,585.70");
    expect(formatParsedValue("007")).toBe("007");
    expect(formatParsedValue("0071585")).toBe("0,071,585");
    expect(formatParsedValue("3")).toBe("3");
  });
});

// The display form relies on the locale's separators, so check them per region.
describe("Intl.NumberFormat separators for every Catalogue region", () => {
  it("uses \",\" for grouping and \".\" for the decimal point", () => {
    const regions = [...new Set(CATALOGUE.map((s) => s.metric.region))];
    expect(regions.length).toBeGreaterThan(0);
    for (const region of regions) {
      const parts = new Intl.NumberFormat(localeForRegion(region)).formatToParts(
        1234.5,
      );
      const group = parts.find((p) => p.type === "group")?.value;
      const decimal = parts.find((p) => p.type === "decimal")?.value;
      expect(group, `group separator for ${region}`).toBe(",");
      expect(decimal, `decimal separator for ${region}`).toBe(".");
    }
  });
});
