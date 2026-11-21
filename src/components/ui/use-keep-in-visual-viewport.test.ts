// Feature: 09-demo-polish, P9 (keyboard) and 16-remember-first, requirement 1.
// Example tests for the visual viewport keep. The node test environment has no
// DOM, so the pure function `keepInVisualViewport` is driven with stubbed boxes
// and a stubbed window.

import { describe, expect, it, vi } from "vitest";

import {
  KEYBOARD_THRESHOLD_PX,
  isKeyboardOpen,
  isTextField,
  keepInVisualViewport,
  keptBox,
  scrollDeltaFor,
  type BoxedElement,
  type FieldElement,
  type ViewportHost,
} from "./use-keep-in-visual-viewport";

function box(top: number, bottom: number): BoxedElement {
  return { getBoundingClientRect: () => ({ top, bottom }) };
}

function control(
  tagName: string,
  attributes: Record<string, string> = {},
  top = 510,
  bottom = 530,
  type?: string,
): FieldElement {
  return {
    tagName,
    type,
    getAttribute: (name: string) => attributes[name] ?? null,
    getBoundingClientRect: () => ({ top, bottom }),
  };
}

function textField(top = 510, bottom = 530): FieldElement {
  return control("INPUT", {}, top, bottom, "text");
}

/**
 * A host whose keyboard is open by default: the layout viewport is 600 px tall
 * and the visual viewport 300 px, a shortfall of 300, unzoomed.
 */
function host(overrides: Partial<{ height: number; innerHeight: number; scale: number; offsetTop: number }> = {}) {
  const scrollBy = vi.fn();
  const viewport: ViewportHost = {
    innerHeight: overrides.innerHeight ?? 600,
    visualViewport: {
      offsetTop: overrides.offsetTop ?? 0,
      height: overrides.height ?? 300,
      scale: overrides.scale ?? 1,
    },
    scrollBy,
  };
  return { viewport, scrollBy };
}

describe("a Text_Field below the keyboard is scrolled into view (P9)", () => {
  it("scrolls by the amount that puts the bottom of the group above the band, with 'auto' under Calm", () => {
    // Visual viewport 300 px tall at the top: the band is 56 to 292.
    const { viewport, scrollBy } = host();
    const delta = keepInVisualViewport(box(500, 540), textField(), viewport, true);
    expect(delta).toBe(540 - 292);
    expect(scrollBy).toHaveBeenCalledTimes(1);
    expect(scrollBy).toHaveBeenCalledWith({ top: 248, behavior: "auto" });
  });

  it("uses smooth scrolling when Calm is off", () => {
    const { viewport, scrollBy } = host();
    keepInVisualViewport(box(500, 540), textField(), viewport, false);
    expect(scrollBy).toHaveBeenCalledWith({ top: 248, behavior: "smooth" });
  });

  it("respects a visual viewport that starts lower in the layout viewport", () => {
    // Band: 100 + 56 = 156 to 100 + 300 - 8 = 392.
    const { viewport, scrollBy } = host({ offsetTop: 100 });
    const delta = keepInVisualViewport(box(380, 420), textField(), viewport, true);
    expect(delta).toBe(28);
    expect(scrollBy).toHaveBeenCalledWith({ top: 28, behavior: "auto" });
  });

  it("scrolls up when the group is above the top clear space", () => {
    // Visual viewport 600 px tall, layout viewport 1000 px: still open.
    const { viewport, scrollBy } = host({ height: 600, innerHeight: 1000 });
    const delta = keepInVisualViewport(box(20, 60), textField(), viewport, true);
    expect(delta).toBe(20 - 56);
    expect(scrollBy).toHaveBeenCalledWith({ top: -36, behavior: "auto" });
  });
});

describe("no scroll when the group already fits or the keyboard is shut (requirement 1.13)", () => {
  it("does not scroll a group that is already inside the band", () => {
    const { viewport, scrollBy } = host();
    const delta = keepInVisualViewport(box(100, 140), textField(), viewport, true);
    expect(delta).toBe(0);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  // Case 1: Keyboard_Open is false, so no scroll call.
  it("makes no scroll call while Keyboard_Open is false", () => {
    // Shortfall 0: the visual viewport is as tall as the layout viewport.
    const { viewport, scrollBy } = host({ height: 600, innerHeight: 600 });
    const delta = keepInVisualViewport(box(500, 540), textField(), viewport, false);
    expect(delta).toBe(0);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("does nothing when the window has no visualViewport", () => {
    const scrollBy = vi.fn();
    const delta = keepInVisualViewport(
      box(500, 540),
      textField(),
      { innerHeight: 600, scrollBy },
      true,
    );
    expect(delta).toBe(0);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("does nothing when visualViewport is null", () => {
    const scrollBy = vi.fn();
    keepInVisualViewport(box(500, 540), textField(), { visualViewport: null, innerHeight: 600, scrollBy }, true);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("does nothing when there is no group element", () => {
    const { viewport, scrollBy } = host();
    const delta = keepInVisualViewport(null, textField(), viewport, true);
    expect(delta).toBe(0);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("does nothing when there is no focused element", () => {
    const { viewport, scrollBy } = host();
    const delta = keepInVisualViewport(box(500, 540), null, viewport, true);
    expect(delta).toBe(0);
    expect(scrollBy).not.toHaveBeenCalled();
  });
});

describe("only a Text_Field is kept in view (requirement 1.5)", () => {
  // Case 2: a button, checkbox or radio gains focus while the keyboard is open.
  it.each([
    ["a button", control("BUTTON")],
    ["a checkbox", control("INPUT", {}, 510, 530, "checkbox")],
    ["a radio", control("INPUT", {}, 510, 530, "radio")],
    ["a range slider", control("INPUT", {}, 510, 530, "range")],
    ["a div with a button role", control("DIV", { role: "button" })],
  ])("makes no scroll call on focus of %s while Keyboard_Open", (_label, focused) => {
    const { viewport, scrollBy } = host();
    const delta = keepInVisualViewport(box(500, 540), focused, viewport, true);
    expect(delta).toBe(0);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  // Case 3: a button inside the group holds focus when the visual viewport resizes.
  it("makes no scroll call on a visual viewport resize while a button inside the group holds focus", () => {
    const { viewport, scrollBy } = host();
    const delta = keepInVisualViewport(box(500, 540), control("BUTTON"), viewport, true);
    expect(delta).toBe(0);
    expect(scrollBy).not.toHaveBeenCalled();
  });
});

describe("keyboard detection (requirement 1.13)", () => {
  // Case 5: pinch zoom alone is not Keyboard_Open.
  it("treats pinch zoom (scale above 1) as Keyboard_Open being false", () => {
    expect(isKeyboardOpen({ innerHeight: 600, height: 300, scale: 1.5 })).toBe(false);
    const { viewport, scrollBy } = host({ scale: 1.5 });
    const delta = keepInVisualViewport(box(500, 540), textField(), viewport, true);
    expect(delta).toBe(0);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  // Case 6: a shortfall one pixel below the threshold is closed; equal to it is open.
  it("treats a shortfall one pixel below Keyboard_Threshold as Keyboard_Open being false", () => {
    expect(isKeyboardOpen({ innerHeight: 599, height: 450, scale: 1 })).toBe(false);
    expect(isKeyboardOpen({ innerHeight: 600, height: 451, scale: 1 })).toBe(false);
    const { viewport, scrollBy } = host({ innerHeight: 599, height: 450 });
    expect(keepInVisualViewport(box(500, 540), textField(), viewport, true)).toBe(0);
    expect(scrollBy).not.toHaveBeenCalled();
  });

  it("treats a shortfall equal to Keyboard_Threshold as Keyboard_Open", () => {
    expect(KEYBOARD_THRESHOLD_PX).toBe(150);
    expect(isKeyboardOpen({ innerHeight: 600, height: 450, scale: 1 })).toBe(true);
    // Visual viewport 450 px tall: the band is 56 to 442.
    const { viewport, scrollBy } = host({ innerHeight: 600, height: 450 });
    const delta = keepInVisualViewport(box(500, 540), textField(), viewport, true);
    expect(delta).toBe(540 - 442);
    expect(scrollBy).toHaveBeenCalledWith({ top: 98, behavior: "auto" });
  });
});

describe("a group taller than the band keeps the field's own box (requirement 1.7)", () => {
  // Case 7: the group is 900 px tall, the band 236 px. The focused field's box is kept.
  it("keeps the focused field's box in the band rather than aligning the group's top", () => {
    const { viewport, scrollBy } = host();
    const delta = keepInVisualViewport(box(0, 900), textField(500, 540), viewport, true);
    expect(delta).toBe(540 - 292);
    expect(scrollBy).toHaveBeenCalledWith({ top: 248, behavior: "auto" });
  });
});

describe("isTextField", () => {
  it("accepts a textarea", () => {
    expect(isTextField(control("TEXTAREA"))).toBe(true);
  });

  it.each(["text", "search", "email", "tel", "url", "password", "number"])(
    "accepts an input of type %s",
    (type) => {
      expect(isTextField(control("INPUT", {}, 0, 0, type))).toBe(true);
    },
  );

  it("accepts an input with no type, which is text in HTML", () => {
    expect(isTextField(control("INPUT"))).toBe(true);
  });

  it("rejects an element with a button or slider role", () => {
    expect(isTextField(control("INPUT", { role: "slider" }, 0, 0, "text"))).toBe(false);
    expect(isTextField(control("TEXTAREA", { role: "button" }))).toBe(false);
  });

  it("rejects buttons, checkboxes, radios and null", () => {
    expect(isTextField(control("BUTTON"))).toBe(false);
    expect(isTextField(control("INPUT", {}, 0, 0, "checkbox"))).toBe(false);
    expect(isTextField(control("INPUT", {}, 0, 0, "radio"))).toBe(false);
    expect(isTextField(null)).toBe(false);
  });
});

describe("keptBox", () => {
  const band = { top: 56, bottom: 292 };

  it("returns the group's box when the group fits the band", () => {
    expect(keptBox({ top: 100, bottom: 200 }, { top: 120, bottom: 140 }, band)).toEqual({ top: 100, bottom: 200 });
  });

  it("returns the field's box when the group is taller than the band", () => {
    expect(keptBox({ top: 0, bottom: 900 }, { top: 500, bottom: 540 }, band)).toEqual({ top: 500, bottom: 540 });
  });
});

describe("scrollDeltaFor", () => {
  it("aligns the top of a box taller than the band", () => {
    expect(scrollDeltaFor({ top: 500, bottom: 900 }, { top: 56, bottom: 292 })).toBe(444);
  });
});
