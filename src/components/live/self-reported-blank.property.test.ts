// Property 6: a blank own-number row changes nothing, and a partly filled row
// blocks sealing (spec 08 later-tasks, R26.1 and R26.3).
//
// The oracles below are written from the rule itself: a row is blank when all
// five fields are empty after trimming, and partly filled when some field is
// filled and another is empty. They do not read form.ts.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { SELF_REPORTED_MAX } from "./constants";
import { buildLivePayload } from "./build-payload";
import { missingSelfReportedFields, validateWrite } from "./form";
import { catalogueMetric, makeFigures } from "./test-figures";
import type { SelfReportedRow } from "./write-draft";

const SEALING_DAY = "2026-11-09";
const SEALED_DATE = "2026-11-09";
const SEALED_AT = "2026-11-09T19:09:47.219Z";

const figures = makeFigures([
  {
    metric: catalogueMetric("us-gasoline-regular"),
    figures: [{ period: "2026-10-26", value: "3.412" }],
  },
]);

const GOOD_ROW: SelfReportedRow = {
  name: "Rent",
  value: "950",
  unit: "per month",
  region: "My city",
  period: "2026-09",
};

const FIELDS = ["name", "value", "unit", "region", "period"] as const;

// Oracle: a row is blank when every field is empty after trimming.
function oracleBlank(row: SelfReportedRow): boolean {
  return FIELDS.every((field) => row[field].trim() === "");
}

// Oracle: a row is partly filled when some field has text and some field is
// empty after trimming.
function oraclePartlyFilled(row: SelfReportedRow): boolean {
  const filled = FIELDS.filter((field) => row[field].trim() !== "").length;
  return filled > 0 && filled < FIELDS.length;
}

// A field is empty or whitespace only, so a blank row never carries text.
const blankTextArb = fc.constantFrom("", " ", "  ", "\t", " \n ");
const blankRowArb: fc.Arbitrary<SelfReportedRow> = fc.record({
  name: blankTextArb,
  value: blankTextArb,
  unit: blankTextArb,
  region: blankTextArb,
  period: blankTextArb,
});

// Text that is not blank, so a filled field has something in it.
const filledTextArb = fc.constantFrom(
  "Rent",
  "950",
  "per month",
  "My city",
  "2026-09",
);

// A row where at least one field is filled and at least one is empty.
const partlyFilledRowArb: fc.Arbitrary<SelfReportedRow> = fc
  .tuple(
    fc.array(fc.boolean(), { minLength: 5, maxLength: 5 }),
    fc.array(filledTextArb, { minLength: 5, maxLength: 5 }),
    fc.array(blankTextArb, { minLength: 5, maxLength: 5 }),
  )
  .filter(([mask]) => mask.some((on) => on) && mask.some((on) => !on))
  .map(([mask, filled, blank]) => {
    const row: Record<string, string> = {};
    FIELDS.forEach((field, i) => {
      row[field] = mask[i] ? filled[i]! : blank[i]!;
    });
    return row as unknown as SelfReportedRow;
  });

// 0 to SELF_REPORTED_MAX blank rows, to place around a real row.
const blankRowsArb = fc.array(blankRowArb, {
  minLength: 0,
  maxLength: SELF_REPORTED_MAX,
});

function writeInput(selfReported: readonly SelfReportedRow[]) {
  return {
    text: "A letter.",
    metricIds: ["us-gasoline-regular"],
    warningTicked: true,
    questions: [] as string[],
    selfReported,
    sealingDay: SEALING_DAY,
  };
}

describe("Property 6: a blank own-number row changes nothing", () => {
  it("is recognised as blank exactly when the oracle says so", () => {
    fc.assert(
      fc.property(blankRowArb, partlyFilledRowArb, (blank, partial) => {
        expect(oracleBlank(blank)).toBe(true);
        expect(oracleBlank(partial)).toBe(false);
        expect(oraclePartlyFilled(partial)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("does not change the validation result, wherever the blank rows sit", () => {
    fc.assert(
      fc.property(
        blankRowsArb,
        fc.integer({ min: 0, max: 10 }),
        (blanks, at) => {
          const withoutBlanks = validateWrite(writeInput([GOOD_ROW]));
          const position = Math.min(at, blanks.length);
          const withBlanks = [
            ...blanks.slice(0, position),
            GOOD_ROW,
            ...blanks.slice(position),
          ];
          expect(validateWrite(writeInput(withBlanks))).toEqual(withoutBlanks);
          expect(validateWrite(writeInput(withBlanks))).toEqual([]);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("does not change the payload, wherever the blank rows sit", () => {
    fc.assert(
      fc.property(
        blankRowsArb,
        fc.integer({ min: 0, max: 10 }),
        (blanks, at) => {
          const base = {
            text: "A letter.",
            metricIds: ["us-gasoline-regular"],
            authorQuestions: [],
            sealedDate: SEALED_DATE,
            figures,
            sealedAt: SEALED_AT,
          };
          const expected = buildLivePayload({
            ...base,
            selfReported: [GOOD_ROW],
          });
          const position = Math.min(at, blanks.length);
          const withBlanks = buildLivePayload({
            ...base,
            selfReported: [
              ...blanks.slice(0, position),
              GOOD_ROW,
              ...blanks.slice(position),
            ],
          });
          expect(withBlanks).toEqual(expected);
        },
      ),
      { numRuns: 200 },
    );
  });

  it("builds the same payload when only blank rows are present", () => {
    fc.assert(
      fc.property(blankRowsArb, (blanks) => {
        const base = {
          text: "A letter.",
          metricIds: ["us-gasoline-regular"],
          authorQuestions: [],
          sealedDate: SEALED_DATE,
          figures,
        };
        const none = buildLivePayload({ ...base });
        const onlyBlank = buildLivePayload({
          ...base,
          selfReported: blanks,
          sealedAt: SEALED_AT,
        });
        expect(onlyBlank).toEqual(none);
      }),
      { numRuns: 200 },
    );
  });
});

describe("Property 6: a partly filled row blocks sealing", () => {
  it("blocks sealing for any partly filled row", () => {
    fc.assert(
      fc.property(partlyFilledRowArb, (row) => {
        expect(oraclePartlyFilled(row)).toBe(true);
        const problems = validateWrite(writeInput([row]));
        expect(problems).toContain("self_reported_invalid");
      }),
      { numRuns: 200 },
    );
  });

  it("names exactly the empty fields", () => {
    fc.assert(
      fc.property(partlyFilledRowArb, (row) => {
        const expected = FIELDS.filter((field) => row[field].trim() === "");
        expect(missingSelfReportedFields(row)).toEqual(expected);
      }),
      { numRuns: 200 },
    );
  });

  it("still blocks when a partly filled row sits beside blank rows", () => {
    fc.assert(
      fc.property(blankRowsArb, partlyFilledRowArb, (blanks, row) => {
        const problems = validateWrite(writeInput([...blanks, row]));
        expect(problems).toContain("self_reported_invalid");
      }),
      { numRuns: 200 },
    );
  });
});
