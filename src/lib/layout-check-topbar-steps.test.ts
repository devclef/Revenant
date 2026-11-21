import { describe, expect, it } from "vitest";

import {
  fillAnswerTexts,
  topBarSealStepNote,
} from "../../tools/qa/layout-check.mjs";

/**
 * Unit tests for the B1.2 helpers in tools/qa/layout-check.mjs used by
 * checkTopBarSteps: fillAnswerTexts (one text per answer field, filled before the
 * fold) and topBarSealStepNote (a missing seal step is a note, not a crash).
 */
describe("fillAnswerTexts", () => {
  it("passing: returns one text per answer field, in page order", () => {
    expect(fillAnswerTexts(2)).toEqual([
      "Walk answer to question 1",
      "Walk answer to question 2",
    ]);
  });

  it("failing: a page with no answer fields gives an empty list, which must not count as filled", () => {
    expect(fillAnswerTexts(0)).toEqual([]);
    expect(fillAnswerTexts(0)).not.toEqual(fillAnswerTexts(1));
  });
});

describe("topBarSealStepNote", () => {
  it("passing: a found seal step gives no note, so the rows are measured", () => {
    expect(topBarSealStepNote(true)).toBeNull();
  });

  it("failing: a missing seal step gives a B1.2 note that the rows are not measured", () => {
    const note = topBarSealStepNote(false);
    expect(note).not.toBeNull();
    expect(note).toContain("B1.2");
    expect(note).toContain("[data-seal-step]");
    expect(note).toContain("not measured");
  });
});
