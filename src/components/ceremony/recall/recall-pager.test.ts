import { describe, expect, it } from "vitest";
import {
  firstInvalidIndex,
  isLastIndex,
  nextIndex,
  previousIndex,
  submitAction,
} from "./recall-pager";

// Feature: 07-judge-journey, task 3: the Recall_Pager's paging rules (R11.3,
// R11.4, R11.5, R11.10, R11.11). Pure functions, so no DOM is needed.

describe("paging moves one question at a time and stops at the ends", () => {
  it("next moves forward and stays on the last question", () => {
    expect(nextIndex(0, 3)).toBe(1);
    expect(nextIndex(1, 3)).toBe(2);
    expect(nextIndex(2, 3)).toBe(2);
  });

  it("previous moves back and stays on the first question", () => {
    expect(previousIndex(2)).toBe(1);
    expect(previousIndex(1)).toBe(0);
    expect(previousIndex(0)).toBe(0);
  });

  it("a single question is both first and last", () => {
    expect(isLastIndex(0, 1)).toBe(true);
    expect(nextIndex(0, 1)).toBe(0);
  });

  it("an empty payload has no last question to move to", () => {
    expect(nextIndex(0, 0)).toBe(0);
  });
});

describe("a form submit decides what happens", () => {
  it("advances on a question that is not the last, and sends nothing (R11.3)", () => {
    expect(submitAction(0, 3, false, true)).toBe("advance");
    expect(submitAction(1, 3, false, true)).toBe("advance");
  });

  it("calls the submit handler on the last question (R11.4)", () => {
    expect(submitAction(2, 3, false, true)).toBe("submit");
  });

  it("submits a single question straight away", () => {
    expect(submitAction(0, 1, false, true)).toBe("submit");
  });

  it("does nothing while a post is in flight, on any question (R11.11)", () => {
    expect(submitAction(0, 3, true, true)).toBe("ignore");
    expect(submitAction(2, 3, true, true)).toBe("ignore");
  });
});

describe("an invalid submit jumps to the first invalid question in payload order (R11.10)", () => {
  const ids = ["q-a", "q-b", "q-c", "q-d"];

  it("returns the payload index of the first invalid question", () => {
    expect(firstInvalidIndex(ids, ["q-c", "q-b"])).toBe(1);
    expect(firstInvalidIndex(ids, ["q-d"])).toBe(3);
  });

  it("returns -1 when nothing is invalid", () => {
    expect(firstInvalidIndex(ids, [])).toBe(-1);
  });

  it("ignores an invalid ID that is not in the payload", () => {
    expect(firstInvalidIndex(ids, ["q-zzz"])).toBe(-1);
  });
});

describe("a form submit does nothing while the question is not ready (R32.13)", () => {
  it("ignores Enter on a question that is not the last, and on the last", () => {
    expect(submitAction(0, 3, false, false)).toBe("ignore");
    expect(submitAction(2, 3, false, false)).toBe("ignore");
  });

  it("ignores a single question that is not ready", () => {
    expect(submitAction(0, 1, false, false)).toBe("ignore");
  });
});
