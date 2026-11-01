// Feature: 05-reveal-ceremony
//
// Static-markup test for DeskDecor (design.md "Desk", R13.3, R8.6, R15.1).
// Rendered with renderToStaticMarkup, which runs no effects. This is the server
// and first-client render, so it shows only what exists before mount: the
// decorative canvas, aria-hidden, with no text and no tilt button.

import { createElement, type RefObject } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MotionProvider } from "../motion";
import { DeskDecor } from "./DeskDecor";

function render(): string {
  const target: RefObject<HTMLElement | null> = { current: null };
  return renderToStaticMarkup(
    createElement(MotionProvider, null, createElement(DeskDecor, { target })),
  );
}

describe("DeskDecor static render", () => {
  it("renders the dust canvas, hidden from assistive technology", () => {
    const html = render();
    const tag = html.match(/<canvas[^>]*>/)?.[0] ?? "";
    expect(tag).toContain("data-desk-dust");
    expect(tag).toContain('aria-hidden="true"');
  });

  it("renders no tilt button before the effect has checked for permission", () => {
    expect(render()).not.toContain("<button");
  });

  it("renders no text of its own (R15.1)", () => {
    const text = render().replace(/<[^>]*>/g, "").trim();
    expect(text).toBe("");
  });
});
