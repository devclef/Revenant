// Property 6: a letter needs something to testify about (spec 10, C2.13; this
// ticket replaces the old figure minimum).
//
// A letter is valid for the something-to-testify rule when it has at least one
// non-blank Author_Question or at least one official figure. The rule is the
// same in demo and real mode. Self-reported rows never count. The oracle here
// is the rule as written in the spec, not the code under test.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { MAX_FIGURES } from "./constants";
import { hasSomethingToTestify, validateWrite, type WriteMode } from "./form";
import type { SelfReportedRow } from "./write-draft";

const questionsArb = fc.array(fc.string({ maxLength: 16 }), { maxLength: 3 });

const selfRowArb: fc.Arbitrary<SelfReportedRow> = fc.record({
  name: fc.string({ maxLength: 12 }),
  value: fc.string({ maxLength: 12 }),
  unit: fc.string({ maxLength: 12 }),
  region: fc.string({ maxLength: 12 }),
  period: fc.string({ maxLength: 12 }),
});

/** The rule as the spec states it, written independently of hasSomethingToTestify. */
function oracleHasSomething(questions: readonly string[], figures: number): boolean {
  const hasRealQuestion = questions.some((row) => row.trim() !== "");
  return hasRealQuestion || figures > 0;
}

describe("Property 6: a letter needs something to testify about", () => {
  it("hasSomethingToTestify matches the spec rule for any question set and figure count", () => {
    fc.assert(
      fc.property(
        questionsArb,
        fc.integer({ min: 0, max: MAX_FIGURES + 1 }),
        (questions, figures) => {
          expect(
            hasSomethingToTestify({ questions, officialFigureCount: figures }),
          ).toBe(oracleHasSomething(questions, figures));
        },
      ),
    );
  });

  it("validateWrite reports nothing_to_testify exactly when nothing is testable, in both modes", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("demo" as const, "real" as const),
        questionsArb,
        fc.integer({ min: 0, max: MAX_FIGURES + 1 }),
        (mode: WriteMode, questions, count) => {
          const metricIds = Array.from({ length: count }, (_, i) => `m${i}`);
          const problems = validateWrite({
            text: "A letter.",
            metricIds,
            warningTicked: true,
            questions,
            mode,
            maxFigures: MAX_FIGURES,
          });
          expect(problems.includes("nothing_to_testify")).toBe(
            !oracleHasSomething(questions, count),
          );
          expect(problems.includes("figures_too_many")).toBe(count > MAX_FIGURES);
        },
      ),
    );
  });

  it("a letter with zero figures and no question is blocked in both modes", () => {
    for (const mode of ["demo", "real"] as const) {
      expect(
        validateWrite({ text: "A letter.", metricIds: [], warningTicked: true, questions: [], mode }),
      ).toEqual(["nothing_to_testify"]);
    }
  });

  // Self-reported rows (spec 08 later-tasks, R26) are not figures from the
  // picker. They never count toward what the letter can testify about.
  it("self-reported rows never change whether something can be testified", () => {
    const sealingDay = "2026-11-09";
    fc.assert(
      fc.property(
        fc.constantFrom("demo" as const, "real" as const),
        questionsArb,
        fc.integer({ min: 0, max: MAX_FIGURES + 1 }),
        fc.array(selfRowArb, { maxLength: 12 }),
        (mode, questions, count, selfReported) => {
          const metricIds = Array.from({ length: count }, (_, i) => `m${i}`);
          const base = {
            text: "A letter.",
            metricIds,
            warningTicked: true,
            questions,
            mode,
            maxFigures: MAX_FIGURES,
            sealingDay,
          };
          const without = validateWrite(base);
          const withRows = validateWrite({ ...base, selfReported });

          expect(withRows.includes("nothing_to_testify")).toBe(
            without.includes("nothing_to_testify"),
          );
          expect(withRows.includes("figures_too_many")).toBe(
            without.includes("figures_too_many"),
          );
        },
      ),
    );
  });
});
