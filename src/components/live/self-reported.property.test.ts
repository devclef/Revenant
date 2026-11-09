// Property 22: self-reported values are validated and kept as typed (spec 08
// later-tasks, R1).
//
// Each bound is checked against an oracle written from the rule itself, not from
// form.ts. Whatever the visitor types, the draft keeps the exact text, and
// validation never changes it.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { SELF_REPORTED_TEXT_MAX } from "./constants";
import {
  selfReportedRowProblems,
  selfReportedTextOk,
  selfReportedValueOk,
} from "./form";
import {
  INITIAL_WRITE_DRAFT,
  reduceWriteDraft,
  type SelfReportedRow,
} from "./write-draft";

const SEALING_DAY = "2026-11-09";

// Oracle: a value is valid when it is digits, an optional dot, and at most 4
// fraction digits, and the whole number is at most 999,999,999 (a fraction is
// allowed only when the integer part is below that bound, or is exactly that
// bound with a zero fraction).
function oracleValueOk(raw: string): boolean {
  const s = raw.trim();
  const m = /^(\d+)(?:\.(\d*))?$/.exec(s);
  if (m === null) return false;
  const intPart = m[1] ?? "";
  const frac = m[2];
  if (frac !== undefined && frac.length === 0) return false;
  if ((frac?.length ?? 0) > 4) return false;
  const whole = BigInt(intPart);
  const max = 999999999n;
  if (whole < max) return true;
  if (whole > max) return false;
  return frac === undefined || /^0*$/.test(frac);
}

// Oracle: 1 to 60 characters, counted in code points, after trimming.
function oracleTextOk(raw: string): boolean {
  const n = [...raw.trim()].length;
  return n >= 1 && n <= SELF_REPORTED_TEXT_MAX;
}

const digitsArb = fc
  .array(fc.constantFrom(..."0123456789".split("")), { maxLength: 12 })
  .map((d) => d.join(""));
const padArb = fc.constantFrom("", " ", "  ", "\t");

const valueArb: fc.Arbitrary<string> = fc.oneof(
  // Plausible numbers around the bounds.
  fc
    .tuple(padArb, digitsArb, fc.option(digitsArb, { nil: undefined }), padArb)
    .map(
      ([pre, whole, frac, post]) =>
        `${pre}${whole}${frac === undefined ? "" : `.${frac}`}${post}`,
    ),
  fc.constantFrom(
    "999999999",
    "999999999.0000",
    "999999999.0001",
    "1000000000",
    "0",
    "0.0001",
    "",
    ".5",
    "1.",
    "-1",
    "1e3",
  ),
  fc.string({ maxLength: 16 }),
);

const textArb: fc.Arbitrary<string> = fc.oneof(
  fc.string({ maxLength: 80 }),
  fc.integer({ min: 0, max: 70 }).map((n) => "a".repeat(n)),
  fc.integer({ min: 0, max: 70 }).map((n) => "\u{1F600}".repeat(n)),
  fc
    .array(fc.constantFrom(" ", "\t", "\n"), { maxLength: 6 })
    .map((c) => c.join("")),
);

describe("Property 22: self-reported values are validated and kept as typed", () => {
  it("validates each value against the bounds, matching the oracle", () => {
    fc.assert(
      fc.property(valueArb, (value) => {
        expect(selfReportedValueOk(value)).toBe(oracleValueOk(value));
      }),
      { numRuns: 200 },
    );
  });

  it("validates each name, unit and region against the length bounds", () => {
    fc.assert(
      fc.property(textArb, (text) => {
        expect(selfReportedTextOk(text)).toBe(oracleTextOk(text));
      }),
      { numRuns: 200 },
    );
  });

  it("keeps every typed field exactly as typed, valid or not", () => {
    fc.assert(
      fc.property(textArb, valueArb, (text, value) => {
        let draft = reduceWriteDraft(INITIAL_WRITE_DRAFT, {
          type: "SELF_REPORTED_ADDED",
        });
        draft = reduceWriteDraft(draft, {
          type: "SELF_REPORTED_CHANGED",
          index: 0,
          field: "name",
          text,
        });
        draft = reduceWriteDraft(draft, {
          type: "SELF_REPORTED_CHANGED",
          index: 0,
          field: "value",
          text: value,
        });
        const row: SelfReportedRow = draft.selfReported[0] ?? {
          name: "",
          value: "",
          unit: "",
          region: "",
          period: "",
        };
        // Validation reads the row; it must not change what was typed.
        selfReportedRowProblems(row, SEALING_DAY);
        expect(row.name).toBe(text);
        expect(row.value).toBe(value);
      }),
      { numRuns: 200 },
    );
  });

  it("reports a value problem exactly when the oracle says the value is invalid", () => {
    fc.assert(
      fc.property(valueArb, (value) => {
        const problems = selfReportedRowProblems(
          { name: "n", value, unit: "u", region: "r", period: "2026-10" },
          SEALING_DAY,
        );
        expect(problems.value === undefined).toBe(oracleValueOk(value));
      }),
      { numRuns: 200 },
    );
  });
});
