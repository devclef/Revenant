// Feature: 05-reveal-ceremony, Task 5 (task 2 of the then-and-now work)
// Markup and motion tests for Passage (design.md "The stage 3 sequence", R10.6,
// R11.2). Rendered with `renderToStaticMarkup` and `createElement`, matching the
// other ceremony figure tests.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CEREMONY_COPY } from "../copy";
import { EASE_STANDARD, PASSAGE_MS } from "../constants";
import { MotionProvider } from "../motion";
import {
  PASSAGE_SHEET_COUNT,
  Passage,
  lightStyle,
  passageAnimationFor,
  sheetStyle,
} from "./Passage";

const renderPassage = (): string =>
  renderToStaticMarkup(createElement(MotionProvider, null, createElement(Passage)));

describe("Passage markup", () => {
  it("puts the decorative scene inside an aria-hidden element", () => {
    const html = renderPassage();
    const scene = html.match(/<div class="[^"]*passageScene[^"]*" aria-hidden="true">([\s\S]*?)<\/div>/);
    expect(scene).not.toBeNull();
    // Three sheets and the light layer, all decorative.
    expect(scene?.[1].match(/<span/g)?.length).toBe(PASSAGE_SHEET_COUNT + 1);
  });

  it("keeps the live line outside the aria-hidden scene so it is announced", () => {
    const html = renderPassage();
    const sceneEnd = html.indexOf("</div>", html.indexOf("passageScene"));
    const liveAt = html.indexOf('role="status"');
    expect(liveAt).toBeGreaterThan(sceneEnd);
    expect(html).toContain('aria-live="polite"');
  });

  it("takes its live line from copy.ts", () => {
    const html = renderPassage();
    expect(html).toContain(CEREMONY_COPY.passageLive);
  });

  it("plays the turn and drift over PASSAGE_MS in full motion", () => {
    // Initial render is full motion: the device mode is read only after mount.
    const html = renderPassage();
    expect(html).toContain(`animation-duration:${PASSAGE_MS}ms`);
    expect(html).toContain(`animation-timing-function:${EASE_STANDARD}`);
  });
});

describe("Passage motion", () => {
  it("animates only in full motion", () => {
    expect(passageAnimationFor("full")).toEqual({
      duration: `${PASSAGE_MS}ms`,
      easing: EASE_STANDARD,
    });
    expect(passageAnimationFor("light")).toBeUndefined();
    expect(passageAnimationFor("calm")).toBeUndefined();
  });

  it("draws still sheets and light with no inline animation when not animating", () => {
    expect(sheetStyle(undefined)).toEqual({});
    expect(lightStyle(undefined)).toEqual({});
  });

  it("uses the same duration for every span, since a span never reaches Passage", () => {
    // Passage takes no props, so no span or date can change its timing (R10.6).
    const first = renderPassage();
    const second = renderPassage();
    expect(first).toBe(second);
  });
});
