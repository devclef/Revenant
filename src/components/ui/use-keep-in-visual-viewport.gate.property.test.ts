// Feature: 16-remember-first, Property 1: the Keep_Hook scrolls only for a
// Text_Field while Keyboard_Open. Validates requirements 1.4, 1.5 and 1.13.
// Generated viewports, elements and boxes drive the pure `keepInVisualViewport`
// with a stubbed window; the node test environment has no DOM.

import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

import {
  KEYBOARD_THRESHOLD_PX,
  SCALE_TOLERANCE,
  isKeyboardOpen,
  isTextField,
  keepInVisualViewport,
  type FieldElement,
  type FieldLike,
  type ViewportHost,
} from "./use-keep-in-visual-viewport";

type Rect = { top: number; bottom: number };

const rectArb: fc.Arbitrary<Rect> = fc
  .record({ top: fc.integer({ min: -600, max: 1600 }), height: fc.integer({ min: 1, max: 900 }) })
  .map(({ top, height }) => ({ top, bottom: top + height }));

const viewportArb = fc.record({
  innerHeight: fc.integer({ min: 300, max: 1200 }),
  height: fc.integer({ min: 100, max: 1200 }),
  offsetTop: fc.integer({ min: 0, max: 300 }),
  scale: fc.constantFrom(1, 1 + SCALE_TOLERANCE / 2, 1.5, 2),
});

/** Element shapes covering textarea, text-like inputs, non-text inputs and ARIA roles. */
const fieldShapeArb = fc.constantFrom<{ tagName: string; type?: string; role?: string }>(
  { tagName: "TEXTAREA" },
  { tagName: "INPUT", type: "text" },
  { tagName: "INPUT", type: "EMAIL" },
  { tagName: "INPUT", type: "tel" },
  { tagName: "INPUT", type: "number" },
  { tagName: "INPUT" },
  { tagName: "INPUT", type: "checkbox" },
  { tagName: "INPUT", type: "radio" },
  { tagName: "INPUT", type: "range" },
  { tagName: "BUTTON" },
  { tagName: "DIV" },
  { tagName: "INPUT", type: "text", role: "button" },
  { tagName: "INPUT", type: "text", role: "slider" },
  { tagName: "TEXTAREA", role: "button" },
);

function fieldFrom(shape: { tagName: string; type?: string; role?: string }, box: Rect): FieldElement {
  const like: FieldLike = {
    tagName: shape.tagName,
    type: shape.type,
    getAttribute: (name: string) => (name === "role" ? (shape.role ?? null) : null),
  };
  return { ...like, getBoundingClientRect: () => box };
}

function hostFrom(v: { innerHeight: number; height: number; offsetTop: number; scale: number }) {
  const scrollBy = vi.fn();
  const host: ViewportHost = {
    innerHeight: v.innerHeight,
    visualViewport: { offsetTop: v.offsetTop, height: v.height, scale: v.scale },
    scrollBy,
  };
  return { host, scrollBy };
}

describe("Keep_Hook gate (Property 1)", () => {
  it("scrolls only when the keyboard is open and the focused element is a Text_Field", () => {
    fc.assert(
      fc.property(viewportArb, fieldShapeArb, rectArb, rectArb, fc.boolean(), (v, shape, group, field, calm) => {
        const { host, scrollBy } = hostFrom(v);
        const el = fieldFrom(shape, field);
        const delta = keepInVisualViewport({ getBoundingClientRect: () => group }, el, host, calm);

        const open = isKeyboardOpen({ innerHeight: v.innerHeight, height: v.height, scale: v.scale });
        const text = isTextField(el);
        if (!open || !text) {
          expect(delta).toBe(0);
          expect(scrollBy).not.toHaveBeenCalled();
        } else {
          expect(scrollBy.mock.calls.length).toBe(delta === 0 ? 0 : 1);
        }
      }),
    );
  });

  it("scrolls for an out-of-band Text_Field whenever the keyboard is open", () => {
    fc.assert(
      fc.property(viewportArb, fieldShapeArb, rectArb, rectArb, (v, shape, group, field) => {
        fc.pre(isKeyboardOpen({ innerHeight: v.innerHeight, height: v.height, scale: v.scale }));
        fc.pre(isTextField(fieldFrom(shape, field)));
        const band = { top: v.offsetTop + 56, bottom: v.offsetTop + v.height - 8 };
        const outside = field.top < band.top || field.bottom > band.bottom;
        const groupFits = group.bottom - group.top <= band.bottom - band.top;
        const { host, scrollBy } = hostFrom(v);
        keepInVisualViewport({ getBoundingClientRect: () => group }, fieldFrom(shape, field), host, true);
        // The kept box is the group when it fits; otherwise the field itself.
        const keptOutside = groupFits ? group.top < band.top || group.bottom > band.bottom : outside;
        expect(scrollBy.mock.calls.length > 0).toBe(keptOutside);
      }),
    );
  });

  it("the keyboard threshold is a real gate: a shortfall below it never opens the keyboard", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: KEYBOARD_THRESHOLD_PX - 1 }),
        fc.integer({ min: 100, max: 1200 }),
        (shortfall, height) => {
          expect(isKeyboardOpen({ innerHeight: height + shortfall, height, scale: 1 })).toBe(false);
        },
      ),
    );
  });
});
