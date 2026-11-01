// Feature: 05-reveal-ceremony
//
// Tests for the polite live region (LiveRegion.tsx, R3.1). The region is how a
// reader who cannot see the Ceremony's motion — a screen-reader reader, or
// anyone in Calm_Mode / prefers-reduced-motion — is still told where the
// Ceremony is: one short line per Stage is announced politely, with no content
// jumping into view and no colour or direction (neutrality.md, R10.1).
//
// How this is observed in this repo's test setup
// -----------------------------------------------
// The repo has no DOM test environment and no @testing-library/react: every
// component test runs in Vitest's `node` environment and reads React through
// `renderToStaticMarkup` (see DeskScene.test.tsx, skip.test.tsx). We add no
// dependency, so this test follows that house style and inspects the static
// (server) markup directly.
//
// The task names the behaviours to prove:
//   - the region renders with role and aria-live="polite";
//   - it is visually hidden (it carries the CSS-module class that hides it —
//     class names are hashed, so this is observed as a non-empty `class`
//     attribute, the same way DeskScene.test.tsx keys off data attributes
//     rather than a hashed class name);
//   - it announces the message passed to it;
//   - it is empty — no stale announcement — when given no message.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LiveRegion } from "./LiveRegion";

function render(message: string): string {
  return renderToStaticMarkup(createElement(LiveRegion, { message }));
}

describe("LiveRegion — politeness and role (R3.1)", () => {
  it("renders a polite live region", () => {
    const html = render("Opening the letter.");
    // aria-live="polite" is what makes a screen reader announce the update
    // without interrupting; it never barges content into view (R3.1).
    expect(html).toContain('aria-live="polite"');
    // The region carries a role so assistive tech treats it as a live region
    // even before its text first changes.
    expect(html).toMatch(/role="(status|log|region)"/);
  });

  it("is atomic, so the whole line is read as one announcement", () => {
    const html = render("Breaking the seal.");
    expect(html).toContain('aria-atomic="true"');
  });
});

describe("LiveRegion — visually hidden", () => {
  it("carries the visually-hidden class (heard, never seen)", () => {
    const html = render("The marks.");
    // Class names are hashed by the CSS module, so — like DeskScene.test.tsx
    // keying off data attributes — this checks the region is given a non-empty
    // class (the `.liveRegion` visually-hidden recipe in ceremony.module.css),
    // rather than matching the hashed name itself.
    const classAttr = html.match(/class="([^"]*)"/);
    expect(classAttr, "the region must carry a class attribute").not.toBeNull();
    expect((classAttr?.[1] ?? "").trim().length).toBeGreaterThan(0);
  });
});

describe("LiveRegion — what it announces", () => {
  it("announces the message it is given", () => {
    const message = "Then, and now.";
    const html = render(message);
    expect(html).toContain(message);
  });

  it("announces a different message when given one", () => {
    const message = "The letter opens.";
    const html = render(message);
    expect(html).toContain(message);
  });

  it("is empty when given no message (no stale announcement)", () => {
    const html = render("");
    // The region element is still present (so a screen reader is already
    // watching it), but it holds no text: an empty message announces nothing.
    // The only characters between the element's tags must be nothing at all.
    const body = html.match(/>([\s\S]*)<\/[a-zA-Z]+>$/);
    expect(body?.[1] ?? "").toBe("");
  });
});
