// Feature: 09-demo-polish, P8.4, P9, P10: phone constants for the live demo.

import { describe, expect, it } from "vitest";

import {
  LETTER_FIELD_MAX_VH,
  LETTER_FIELD_ROWS,
  MIN_TOUCH_TARGET_PX,
  PHONE_SIZES,
} from "./constants";
import { letterFieldHeightPx, letterFieldMaxPx } from "./phone";

describe("phone constants (P8.4, P9, P10)", () => {
  it("starts the letter field at 3 rows", () => {
    expect(LETTER_FIELD_ROWS).toBe(3);
  });

  it("lets the letter field grow to at most 50% of the visual viewport", () => {
    expect(LETTER_FIELD_MAX_VH).toBe(50);
  });

  it("sets the touch target to at least 44 CSS pixels", () => {
    expect(MIN_TOUCH_TARGET_PX).toBe(44);
  });

  it("walks the two Phone_Sizes: 390x844 and 360x640", () => {
    expect(PHONE_SIZES).toEqual([
      { width: 390, height: 844 },
      { width: 360, height: 640 },
    ]);
  });
});

describe("letter field sizing (P9)", () => {
  it("caps the field at half the visual viewport", () => {
    expect(letterFieldMaxPx(640)).toBe(320);
    expect(letterFieldMaxPx(844)).toBe(422);
  });

  it("uses the content height while it is under the cap", () => {
    expect(letterFieldHeightPx(200, 640)).toBe(200);
  });

  it("stops at the cap when the content is taller", () => {
    expect(letterFieldHeightPx(900, 640)).toBe(320);
  });

  it("never returns a negative height", () => {
    expect(letterFieldHeightPx(-10, 640)).toBe(0);
  });
});
