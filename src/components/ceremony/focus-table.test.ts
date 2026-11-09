// Feature: 10-own-questions (C1.12)
//
// The focus table in stages.ts: every row of spec 10 design.md "Focus:
// Load_Entry and Gesture_Entry", and `letterShape` for the shape it reads.

import { describe, expect, it } from "vitest";

import type { FlowState } from "../reveal/opening-machine";
import { focusTargetFor, letterShape, type FocusShape, type Stage } from "./stages";

const NONE: FocusShape = { authorQuestions: false, figures: false };
const FIGURES: FocusShape = { authorQuestions: false, figures: true };
const AUTHOR: FocusShape = { authorQuestions: true, figures: false };
const AUTHOR_AND_FIGURES: FocusShape = { authorQuestions: true, figures: true };

describe("focusTargetFor: Load_Entry and Gesture_Entry into recall", () => {
  it("returns stage-heading for emerging to recall, for any shape", () => {
    for (const shape of [NONE, FIGURES, AUTHOR, AUTHOR_AND_FIGURES]) {
      expect(focusTargetFor("emerging", "recall", shape)).toEqual({ kind: "stage-heading" });
    }
  });

  it("returns default (the answer field) for envelope to recall, for any shape", () => {
    for (const shape of [NONE, FIGURES, AUTHOR, AUTHOR_AND_FIGURES]) {
      expect(focusTargetFor("envelope", "recall", shape)).toEqual({ kind: "default" });
    }
  });
});

describe("focusTargetFor: marks or seal to letter", () => {
  it("returns author-testimony-heading when the letter has Author_Questions", () => {
    expect(focusTargetFor("marks", "letter", AUTHOR)).toEqual({ kind: "author-testimony-heading" });
    expect(focusTargetFor("seal", "letter", AUTHOR_AND_FIGURES)).toEqual({
      kind: "author-testimony-heading",
    });
  });

  it("returns default when there are no Author_Questions", () => {
    expect(focusTargetFor("marks", "letter", NONE)).toEqual({ kind: "default" });
    expect(focusTargetFor("seal", "letter", FIGURES)).toEqual({ kind: "default" });
  });
});

describe("focusTargetFor: marks or seal to figures or close", () => {
  it("returns author-testimony-heading for a skip when there are Author_Questions", () => {
    expect(focusTargetFor("marks", "figures", AUTHOR)).toEqual({ kind: "author-testimony-heading" });
    expect(focusTargetFor("seal", "close", AUTHOR)).toEqual({ kind: "author-testimony-heading" });
  });

  it("returns figures-heading without Author_Questions when the letter has figures", () => {
    expect(focusTargetFor("marks", "figures", FIGURES)).toEqual({ kind: "figures-heading" });
    expect(focusTargetFor("seal", "close", FIGURES)).toEqual({ kind: "figures-heading" });
  });

  it("returns letter-heading for close when there are neither Author_Questions nor figures", () => {
    expect(focusTargetFor("marks", "close", NONE)).toEqual({ kind: "letter-heading" });
    expect(focusTargetFor("seal", "close", NONE)).toEqual({ kind: "letter-heading" });
  });
});

describe("focusTargetFor: letter, figures and close", () => {
  it("returns figures-heading for letter to figures", () => {
    expect(focusTargetFor("letter", "figures", FIGURES)).toEqual({ kind: "figures-heading" });
  });

  it("returns figures-heading for letter to close when the letter has figures", () => {
    expect(focusTargetFor("letter", "close", FIGURES)).toEqual({ kind: "figures-heading" });
  });

  it("returns none for figures to close, whatever the shape", () => {
    for (const shape of [NONE, FIGURES, AUTHOR, AUTHOR_AND_FIGURES]) {
      expect(focusTargetFor("figures", "close", shape)).toEqual({ kind: "none" });
    }
  });
});

describe("focusTargetFor: everything else", () => {
  it("returns default for the first mount and for other pairs", () => {
    expect(focusTargetFor(null, "marks", FIGURES)).toEqual({ kind: "default" });
    expect(focusTargetFor("recall", "marks", FIGURES)).toEqual({ kind: "default" });
    expect(focusTargetFor("recall", "recall", FIGURES)).toEqual({ kind: "default" });
    expect(focusTargetFor("emerging", "marks", FIGURES)).toEqual({ kind: "default" });
  });

  it("never returns stage-heading outside the Load_Entry", () => {
    const stages: Stage[] = [
      "emerging", "sealed", "envelope", "recall", "marks", "seal",
      "letter", "figures", "close", "error",
    ];
    for (const prev of [null, ...stages]) {
      for (const next of stages) {
        if (prev === "emerging" && next === "recall") continue;
        expect(focusTargetFor(prev, next, AUTHOR_AND_FIGURES)).not.toEqual({
          kind: "stage-heading",
        });
      }
    }
  });
});

describe("letterShape", () => {
  it("is false for both values before recall", () => {
    const before: FlowState[] = [
      { tag: "loading" },
      { tag: "verifying" },
      { tag: "not_placed" },
    ];
    for (const state of before) {
      expect(letterShape(state)).toEqual(NONE);
    }
  });

  it("reads figures from the opened payload on recall and reveal", () => {
    const withFigures = {
      tag: "recall",
      opened: { payload: { figures: [{}], recall_questions: [] } },
      drafts: {},
      invalid: [],
    } as unknown as FlowState;
    const withoutFigures = {
      tag: "reveal",
      stage: 1,
      opened: { payload: { figures: [], recall_questions: [] } },
    } as unknown as FlowState;
    expect(letterShape(withFigures)).toEqual(FIGURES);
    expect(letterShape(withoutFigures)).toEqual(NONE);
  });

  it("reads authorQuestions from a text recall question on the opened payload", () => {
    const withText = {
      tag: "reveal",
      stage: 1,
      opened: {
        payload: {
          figures: [],
          recall_questions: [{ id: "q-note", answer_type: "text", text: "Note" }],
        },
      },
    } as unknown as FlowState;
    const numberOnly = {
      tag: "reveal",
      stage: 1,
      opened: {
        payload: {
          figures: [],
          recall_questions: [{ id: "q-fuel", answer_type: "number", metric_id: "fuel", text: "Fuel" }],
        },
      },
    } as unknown as FlowState;
    expect(letterShape(withText)).toEqual(AUTHOR);
    expect(letterShape(numberOnly)).toEqual(NONE);
  });
});
