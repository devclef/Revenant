import { describe, expect, it } from "vitest";

import {
  INITIAL_TOUCHED,
  markAttempted,
  markTouched,
  showsFieldMessage,
} from "./touched";

describe("touched state", () => {
  it("shows no field message on first load", () => {
    expect(showsFieldMessage(INITIAL_TOUCHED, "letter")).toBe(false);
    expect(showsFieldMessage(INITIAL_TOUCHED, "figures")).toBe(false);
    expect(showsFieldMessage(INITIAL_TOUCHED, "date")).toBe(false);
  });

  it("shows a field's message only after that field was touched", () => {
    const state = markTouched(INITIAL_TOUCHED, "letter");

    expect(showsFieldMessage(state, "letter")).toBe(true);
    expect(showsFieldMessage(state, "figures")).toBe(false);
  });

  it("shows every message after an attempt to seal", () => {
    const state = markAttempted(INITIAL_TOUCHED);

    expect(showsFieldMessage(state, "letter")).toBe(true);
    expect(showsFieldMessage(state, "figures")).toBe(true);
    expect(showsFieldMessage(state, "date")).toBe(true);
  });

  it("returns a new state and never mutates the one it was given", () => {
    const before = markTouched(INITIAL_TOUCHED, "letter");
    const after = markTouched(before, "date");

    expect(after).not.toBe(before);
    expect(before.touched).toEqual({ letter: true });
    expect(after.touched).toEqual({ letter: true, date: true });
    expect(INITIAL_TOUCHED.touched).toEqual({});
  });

  it("returns the same state when a field or the attempt is already recorded", () => {
    const touched = markTouched(INITIAL_TOUCHED, "letter");
    expect(markTouched(touched, "letter")).toBe(touched);

    const attempted = markAttempted(INITIAL_TOUCHED);
    expect(markAttempted(attempted)).toBe(attempted);
  });
});
