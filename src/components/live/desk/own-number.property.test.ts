// Feature: 14-write-desk, Property 10: The own number is one row, dated the sealing day only when used
//
// The oracles below are written from the rule itself, not from write-draft.ts:
// the draft holds one row, its period is the sealing day when any of the four
// typed fields has text after trimming and "" otherwise, a blank row passes
// validation and seals nothing, and a partly filled row fails with exactly the
// empty fields named.
//
// Validates: Requirements W12.3, W12.4

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { buildLivePayload } from "../build-payload";
import { selfReportedRowsOk, validateWrite } from "../form";
import { catalogueMetric, makeFigures } from "../test-figures";
import {
  initialWriteDraft,
  ownNumberMissing,
  reduceWriteDraft,
  type OwnNumberField,
  type SelfReportedRow,
  type WriteDraft,
} from "../write-draft";

type OwnNumberEvent = {
  type: "OWN_NUMBER_CHANGED";
  field: OwnNumberField;
  text: string;
  sealingDay: string;
};

const FOUR: readonly OwnNumberField[] = ["name", "value", "unit", "region"];

const figures = makeFigures([
  {
    metric: catalogueMetric("us-gasoline-regular"),
    figures: [{ period: "2026-10-26", value: "3.412" }],
  },
]);

// Oracle: the four typed fields that are empty after trimming, in form order.
function oracleMissing(row: SelfReportedRow): OwnNumberField[] {
  return FOUR.filter((field) => row[field].trim() === "");
}

// Oracle: the row is in use when any of the four typed fields has text.
function oracleUsed(row: SelfReportedRow): boolean {
  return FOUR.some((field) => row[field].trim() !== "");
}

// Text a field may hold: blanks, filled text, a value, and padded text.
const textArb = fc.constantFrom(
  "",
  " ",
  "\t",
  " \n ",
  "Rent",
  " Rent ",
  "950",
  "3.5",
  "per month",
  "My city",
);

const sealingDayArb = fc.constantFrom("2026-11-18", "2026-11-09", "2027-01-01");

const rowArb: fc.Arbitrary<SelfReportedRow> = fc.record({
  name: textArb,
  value: textArb,
  unit: textArb,
  region: textArb,
  period: fc.constantFrom("", "2026-09", "2026-09-30"),
});

// A starting draft holds no row or one row, as the desk can leave it.
const startArb: fc.Arbitrary<WriteDraft> = fc.oneof(
  fc.constant(initialWriteDraft("real")),
  rowArb.map((row) => ({ ...initialWriteDraft("real"), selfReported: [row] })),
);

// One sequence of events, all carrying the same sealing day.
function eventsArb(sealingDay: string): fc.Arbitrary<OwnNumberEvent[]> {
  const eventArb: fc.Arbitrary<OwnNumberEvent> = fc
    .record({ field: fc.constantFrom(...FOUR), text: textArb })
    .map(({ field, text }) => ({
      type: "OWN_NUMBER_CHANGED",
      field,
      text,
      sealingDay,
    }));
  return fc.array(eventArb, { minLength: 1, maxLength: 12 });
}

function applyAll(start: WriteDraft, events: readonly OwnNumberEvent[]) {
  return events.reduce<WriteDraft>(
    (draft, event) => reduceWriteDraft(draft, event),
    start,
  );
}

function writeInput(
  selfReported: readonly SelfReportedRow[],
  sealingDay: string,
) {
  return {
    text: "A letter.",
    metricIds: ["us-gasoline-regular"],
    warningTicked: true,
    questions: [] as string[],
    selfReported,
    sealingDay,
  };
}

// A starting draft, one sealing day and a sequence of events that use that day.
const caseArb = fc
  .tuple(startArb, sealingDayArb)
  .chain(([start, day]) =>
    fc.tuple(fc.constant(start), fc.constant(day), eventsArb(day)),
  );

describe("Property 10: the own number is one row", () => {
  it("holds exactly one row after any sequence of events", () => {
    fc.assert(
      fc.property(caseArb, ([start, , events]) => {
        expect(applyAll(start, events).selfReported).toHaveLength(1);
      }),
      { numRuns: 300 },
    );
  });

  it("dates the row with the sealing day exactly when a typed field has text", () => {
    fc.assert(
      fc.property(caseArb, ([start, day, events]) => {
        const [row] = applyAll(start, events).selfReported;
        expect(row).toBeDefined();
        expect(row!.period).toBe(oracleUsed(row!) ? day : "");
      }),
      { numRuns: 300 },
    );
  });
});

describe("Property 10: a blank own number seals nothing and does not block", () => {
  it("passes validation and leaves the payload unchanged", () => {
    const blankArb = fc.constantFrom("", " ", "\t", " \n ");
    fc.assert(
      fc.property(
        sealingDayArb,
        fc.array(fc.tuple(fc.constantFrom(...FOUR), blankArb), {
          minLength: 1,
          maxLength: 8,
        }),
        (day, blanks) => {
          const draft = blanks.reduce<WriteDraft>(
            (state, [field, text]) =>
              reduceWriteDraft(state, {
                type: "OWN_NUMBER_CHANGED",
                field,
                text,
                sealingDay: day,
              }),
            initialWriteDraft("real"),
          );
          const [row] = draft.selfReported;
          expect(row).toBeDefined();
          expect(oracleUsed(row!)).toBe(false);
          expect(row!.period).toBe("");
          expect(selfReportedRowsOk([row!], day)).toBe(true);
          expect(validateWrite(writeInput([row!], day))).toEqual([]);

          const base = {
            text: "A letter.",
            metricIds: ["us-gasoline-regular"],
            authorQuestions: [],
            sealedDate: day,
            figures,
            sealedAt: "2026-11-18T09:00:00.000Z",
          };
          expect(buildLivePayload({ ...base, selfReported: [row!] })).toEqual(
            buildLivePayload({ ...base, selfReported: [] }),
          );
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe("Property 10: a partly filled own number fails and names the empty fields", () => {
  it("fails writeCheck and names exactly the empty typed fields", () => {
    fc.assert(
      fc.property(
        sealingDayArb,
        fc.array(fc.tuple(fc.constantFrom(...FOUR), textArb), {
          minLength: 1,
          maxLength: 8,
        }),
        (day, edits) => {
          const draft = edits.reduce<WriteDraft>(
            (state, [field, text]) =>
              reduceWriteDraft(state, {
                type: "OWN_NUMBER_CHANGED",
                field,
                text,
                sealingDay: day,
              }),
            initialWriteDraft("real"),
          );
          const [row] = draft.selfReported;
          expect(row).toBeDefined();
          const empties = oracleMissing(row!);
          // Only the partly filled case is in scope for this property.
          fc.pre(empties.length > 0 && empties.length < FOUR.length);

          expect(ownNumberMissing(row!)).toEqual(empties);
          expect(selfReportedRowsOk([row!], day)).toBe(false);
          expect(validateWrite(writeInput([row!], day))).toContain(
            "self_reported_invalid",
          );
        },
      ),
      { numRuns: 200 },
    );
  });
});
