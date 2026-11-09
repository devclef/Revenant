// Feature: 10-own-questions, task 10 (issue #306): Property 8 (extended).
//
// For any previous Stage, next Stage and shape (authorQuestions, figures),
// focusTargetFor returns the target the "Focus: Load_Entry and Gesture_Entry"
// table gives: stage-heading only for emerging -> recall, default for
// envelope -> recall, author-testimony-heading for a Skip or break when the
// letter has Author_Questions, and figures-heading or letter-heading otherwise.
// Validates C1.12, C6.6.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  focusTargetFor,
  type FocusShape,
  type FocusTarget,
  type Stage,
} from "./stages";

const STAGES: Stage[] = [
  "emerging",
  "envelope",
  "recall",
  "marks",
  "seal",
  "letter",
  "figures",
  "close",
];

/**
 * The design table, written out independently of the implementation so the two
 * must agree. Returns the expected FocusTarget kind for an entry.
 */
function expected(
  prev: Stage | null,
  next: Stage,
  shape: FocusShape,
): FocusTarget["kind"] {
  if (prev === "emerging" && next === "recall") return "stage-heading";
  if (prev === "envelope" && next === "recall") return "default";
  if (prev === "figures" && next === "close") return "none";
  if (prev === "letter" && next === "figures") return "figures-heading";
  if (prev === "letter" && next === "close" && shape.figures) {
    return "figures-heading";
  }
  if (prev === "marks" || prev === "seal") {
    if (next === "letter") {
      return shape.authorQuestions ? "author-testimony-heading" : "default";
    }
    if (next === "figures" || next === "close") {
      if (shape.authorQuestions) return "author-testimony-heading";
      if (shape.figures) return "figures-heading";
      if (next === "close") return "letter-heading";
    }
  }
  return "default";
}

describe("Property 8: focus follows the entry and the letter's shape", () => {
  it("matches the design focus table for every prev, next and shape", () => {
    fc.assert(
      fc.property(
        fc.option(fc.constantFrom(...STAGES), { nil: null }),
        fc.constantFrom(...STAGES),
        fc.record({ authorQuestions: fc.boolean(), figures: fc.boolean() }),
        (prev, next, shape) => {
          expect(focusTargetFor(prev, next, shape).kind).toBe(
            expected(prev, next, shape),
          );
        },
      ),
    );
  });

  it("sends a Skip/break with no figures and no Author_Questions to the letter heading at close", () => {
    const shape: FocusShape = { authorQuestions: false, figures: false };
    expect(focusTargetFor("marks", "close", shape).kind).toBe("letter-heading");
    expect(focusTargetFor("seal", "close", shape).kind).toBe("letter-heading");
  });

  it("sends a Skip/break to the figures heading when the letter has figures but no Author_Questions", () => {
    const shape: FocusShape = { authorQuestions: false, figures: true };
    expect(focusTargetFor("marks", "figures", shape).kind).toBe("figures-heading");
    expect(focusTargetFor("seal", "close", shape).kind).toBe("figures-heading");
  });
});
