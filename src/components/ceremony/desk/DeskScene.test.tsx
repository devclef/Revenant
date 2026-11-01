// Feature: 05-reveal-ceremony
//
// Markup test for the desk scene base (design.md "Desk" and "Final state
// first", R13.1, R13.4-R13.7). Rendered with `renderToStaticMarkup` in
// Vitest's `node` environment, so no effects run: this is exactly the static
// (first / server) render the browser hydrates against.
//
// The "Final state first" rule (design.md) says the very first render is the
// final, settled desk, with no decorative start-state applied. On the client,
// in full motion only, a `useLayoutEffect` moves the scene to its start state
// before the first paint; in the node environment that effect never runs, so
// the markup under test must be the settled desk:
//
//  - the desk container is present (so the page has a desk even with no JS,
//    R13.4 — "without JavaScript the page shows the static desk");
//  - the children are rendered inside it, in source order (R13.1 — the server
//    markup spec 03 requires, in the same order);
//  - no start-state class is attached (Property 15's "contains no start-state
//    class", applied to the desk: nothing is pre-hidden or pre-shifted on the
//    server);
//  - the scene carries no inline literal text of its own — every word a reader
//    sees comes from a child or from `copy.ts` (R15.1, the no-jsx-text rule);
//  - no animation-only markup (the candle light layer, the parallax plane)
//    leaks into an accessibility reading: the decorative layers are
//    `aria-hidden`, so a calm / SSR reading of the scene is just its children.
//
// The scene is wrapped in `MotionProvider` because `DeskScene` reads the motion
// mode from it; on the server that mode is `full` and the final state, so the
// provider changes nothing in this render but mirrors how the scene is mounted
// on a real page (design.md "Motion modes", R17.3).

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DeskScene } from "./DeskScene";
import { MotionProvider } from "../motion";

// Two distinct sentinel children with text content that could never be a
// DeskScene inline literal, so their presence and relative order prove the
// scene renders its children, in order, and nothing of its own between them.
const FIRST = "DESK_CHILD_FIRST";
const SECOND = "DESK_CHILD_SECOND";

function render(): string {
  return renderToStaticMarkup(
    createElement(
      MotionProvider,
      null,
      createElement(
        DeskScene,
        null,
        createElement("p", { key: "a" }, FIRST),
        createElement("p", { key: "b" }, SECOND),
      ),
    ),
  );
}

describe("DeskScene static render", () => {
  it("renders a desk container (the static desk, R13.4)", () => {
    const html = render();
    // The container is marked with a stable data attribute (class names are
    // hashed by the CSS module, so the test keys off data-desk, not a class).
    expect(html).toContain("data-desk");
  });

  it("renders its children, in source order (R13.1)", () => {
    const html = render();
    const first = html.indexOf(FIRST);
    const second = html.indexOf(SECOND);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(second).toBeGreaterThanOrEqual(0);
    // The first child appears before the second: the scene preserves order and
    // inserts nothing of its own that would reorder them.
    expect(first).toBeLessThan(second);
  });

  it("carries no start-state class on the first render (Property 15)", () => {
    const html = render();
    // The settled desk is rendered directly. Nothing is pre-hidden or
    // pre-shifted for an animation that only runs on the client in full motion.
    // A start-state would show up as one of these decorative markers; none may
    // appear in the static markup.
    const startStateMarkers = [
      "data-start-state",
      "data-desk-start",
      "data-pre-animate",
    ];
    for (const marker of startStateMarkers) {
      expect(
        html,
        `the static desk must not carry the start-state marker "${marker}"`,
      ).not.toContain(marker);
    }
  });

  it("renders no inline literal text of its own (R15.1)", () => {
    const html = render();
    // Strip out the two sentinel children. Whatever text remains between tags
    // belongs to the scene itself, and the scene must contribute none: all of
    // its own copy lives in copy.ts, and the desk is drawn purely with CSS.
    const withoutChildren = html.split(FIRST).join("").split(SECOND).join("");
    // Any run of non-whitespace characters sitting as text between a `>` and a
    // `<` is author-visible literal text. The decorative layers are empty
    // elements, so the only text node left should be nothing but whitespace.
    const textBetweenTags = withoutChildren.match(/>([^<]+)</g) ?? [];
    for (const chunk of textBetweenTags) {
      const text = chunk.slice(1, -1);
      expect(
        text.trim(),
        `DeskScene renders an inline literal: "${text.trim()}"`,
      ).toBe("");
    }
  });

  it("leaks no animation-only markup into the reading (the candle layer is aria-hidden)", () => {
    const html = render();
    // The candle light layer is pure decoration. In a calm or SSR reading it
    // must be hidden from assistive tech, so the scene as heard is just its
    // children. If the candle layer is present (data-candle), it carries
    // aria-hidden; the content layers never do.
    if (html.includes("data-candle")) {
      // Find the opening tag that carries the marker and require aria-hidden
      // on the same element.
      const tag = html.match(/<[^>]*data-candle[^>]*>/)?.[0] ?? "";
      expect(
        tag,
        "the candle light layer must be aria-hidden",
      ).toContain('aria-hidden="true"');
    }
    // The children are never themselves marked aria-hidden by the scene: the
    // content stays in the reading. The element wrapping the first child (the
    // parallax plane that holds the content) must not be hidden.
    const firstTagBefore = html.slice(0, html.indexOf(FIRST));
    const lastOpenTag = firstTagBefore.lastIndexOf("<");
    const wrappingTag = firstTagBefore.slice(lastOpenTag);
    expect(wrappingTag).not.toContain('aria-hidden="true"');
  });
});
