import { describe, expect, it } from "vitest";

import {
  checkTestifyKinds,
  checkUnansweredFold,
} from "../test/integration/live-walk-helpers";

/*
 * Each walk failure helper added or changed for spec 15 gets one passing and
 * one failing example, so a helper that always passes or always fails is caught.
 */

const FOLD_MESSAGE = "Question 2 is not answered yet.";

describe("checkUnansweredFold (spec 15, R7.4)", () => {
  const passing = {
    question: 2,
    focusedAnswer: 2,
    bodyText: `Your letter. ${FOLD_MESSAGE} More text.`,
    foldSummaries: 1,
    message: FOLD_MESSAGE,
  };

  it("passes when the line is shown once, focus is on the same answer, and one summary is shown", () => {
    const check = checkUnansweredFold(passing);
    expect(check.ok).toBe(true);
    expect(check.expected).toBe(
      "the fold names question 2 and focus moves to its answer field",
    );
    expect(check.message).toBe(
      "PASS the fold names question 2 and focus moves to its answer field",
    );
  });

  it("fails when focus stays on a different answer field", () => {
    const check = checkUnansweredFold({ ...passing, focusedAnswer: 1 });
    expect(check.ok).toBe(false);
    expect(check.message).toBe(
      `FAIL focus is on answer 1, the line "${FOLD_MESSAGE}" is shown, and 1 [data-fold-summary] element(s) are shown`,
    );
  });
});

describe("checkTestifyKinds (spec 15, Testify answer kinds)", () => {
  it("passes a one-figure Testify with one author and one figure answer", () => {
    const check = checkTestifyKinds({
      authorAnswered: 1,
      figureAnswered: 1,
      hasFigure: true,
    });
    expect(check.ok).toBe(true);
    expect(check.message.startsWith("PASS")).toBe(true);
  });

  it("fails a one-figure Testify that answered no figure question", () => {
    const check = checkTestifyKinds({
      authorAnswered: 1,
      figureAnswered: 0,
      hasFigure: true,
    });
    expect(check.ok).toBe(false);
    expect(check.message).toBe(
      "FAIL the Remember step answered 1 author question(s) and 0 figure question(s)",
    );
  });
});
