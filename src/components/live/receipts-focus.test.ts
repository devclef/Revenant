import { describe, expect, it } from "vitest";

import {
  focusIndex,
  isNewOpenRequest,
  nextOpenRequest,
  type ReceiptsControlKind,
} from "./receipts-focus";

describe("nextOpenRequest", () => {
  it("adds one press to the counter", () => {
    expect(nextOpenRequest(0)).toBe(1);
    expect(nextOpenRequest(4)).toBe(5);
  });
});

describe("isNewOpenRequest", () => {
  it("never opens for the zero counter before any press", () => {
    expect(isNewOpenRequest(0, 0)).toBe(false);
  });

  it("opens once for each new press", () => {
    expect(isNewOpenRequest(1, 0)).toBe(true);
    expect(isNewOpenRequest(1, 1)).toBe(false);
    expect(isNewOpenRequest(2, 1)).toBe(true);
  });
});

describe("focusIndex", () => {
  const kinds: ReceiptsControlKind[] = [
    "summary",
    "control",
    "checkbox",
    "checkbox",
    "control",
  ];

  it("picks the first figure checkbox when figures are ready", () => {
    expect(focusIndex(kinds, true)).toBe(2);
  });

  it("picks the first control after the summary when figures are not ready", () => {
    expect(focusIndex(kinds, false)).toBe(1);
    const ownOnly: ReceiptsControlKind[] = ["summary", "control"];
    expect(focusIndex(ownOnly, true)).toBe(1);
  });

  it("never picks the summary", () => {
    expect(focusIndex(["summary"], true)).toBe(-1);
    expect(focusIndex(["summary"], false)).toBe(-1);
  });

  it("returns -1 when the disclosure has no controls", () => {
    expect(focusIndex([], true)).toBe(-1);
    expect(focusIndex([], false)).toBe(-1);
  });
});
