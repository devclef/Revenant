// Property 6: the figure minimum follows the mode and the questions (spec 10,
// C2.13).
//
// A real letter (`/seal`) with at least one non-empty Author_Question may seal
// with no figure. Every other write needs one figure, and `/demo/live` keeps
// 1 to 6. The oracle here is the rule as written in the spec, not the code
// under test, so validateWrite and minFiguresFor are checked against it.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { MAX_FIGURES } from "./constants";
import { minFiguresFor, validateWrite, type WriteMode } from "./form";

const questionsArb = fc.array(fc.string({ maxLength: 16 }), { maxLength: 3 });

/** The rule as the spec states it, written independently of minFiguresFor. */
function oracleMinimum(mode: WriteMode, questions: readonly string[]): number {
  const hasRealQuestion = questions.some((row) => row.trim() !== "");
  return mode === "real" && hasRealQuestion ? 0 : 1;
}

describe("Property 6: the figure minimum follows mode and questions", () => {
  it("minFiguresFor matches the spec rule for every mode and question set", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("demo" as const, "real" as const),
        questionsArb,
        (mode, questions) => {
          expect(minFiguresFor(mode, questions)).toBe(
            oracleMinimum(mode, questions),
          );
        },
      ),
    );
  });

  it("validateWrite reports figures_none exactly when the count is below the minimum", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("demo" as const, "real" as const),
        questionsArb,
        fc.integer({ min: 0, max: MAX_FIGURES + 1 }),
        (mode, questions, count) => {
          const metricIds = Array.from({ length: count }, (_, i) => `m${i}`);
          const problems = validateWrite({
            text: "A letter.",
            metricIds,
            warningTicked: true,
            questions,
            mode,
            maxFigures: MAX_FIGURES,
          });
          const below = count < oracleMinimum(mode, questions);
          expect(problems.includes("figures_none")).toBe(below);
          expect(problems.includes("figures_too_many")).toBe(
            count > MAX_FIGURES,
          );
        },
      ),
    );
  });

  it("keeps the demo picker at 1 to 6 whatever the questions say", () => {
    fc.assert(
      fc.property(questionsArb, (questions) => {
        expect(minFiguresFor("demo", questions)).toBe(1);
      }),
    );
  });
});
