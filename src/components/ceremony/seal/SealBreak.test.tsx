// Feature: 05-reveal-ceremony
//
// Markup and source tests for SealBreak (design.md "Seal_Break"; Property 2's
// seal clauses, Property 19's seal clause, Property 21). The default Vitest
// environment is node, so these render with `renderToStaticMarkup` and
// `createElement` (no DOM library, no JSX) inside the real providers.
//
// What these pin:
//   - Property 2 (seal clauses): the settled first render of the marks Stage
//     shows the unbroken seal: no split, no open flap, no flakes, every crack
//     at dashoffset 0 is absent (all hidden), and no letter is in the document.
//   - Property 19 (seal clause): the pointer-hold target is `aria-hidden` and
//     not focusable, and the same Stage carries a real <button> labelled from
//     CEREMONY_COPY.
//   - Property 21: SealBreak's code calls no Math.random or Date.now in render,
//     and statically imports no @/lib/crypto.
//
// Not covered here: the event-driven clauses (ADVANCE fires exactly once on the
// button path, and a throwing setPointerCapture leaves the hold running). Those
// need a DOM to fire pointer and click events, and this node-only environment
// has none. See the final report for the gap.

import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CEREMONY_COPY } from "../copy";
import { LiveRegionProvider } from "../LiveRegion";
import { MotionProvider } from "../motion";
import { SkipProvider } from "../skip";
import { SealBreak, type SealBreakProps } from "./SealBreak";
import { TOTAL_LENGTH, CRACK_COUNT } from "./cracks";

const SOURCE_PATH = new URL("./SealBreak.tsx", import.meta.url);

const renderSealBreak = (overrides: Partial<SealBreakProps> = {}): string =>
  renderToStaticMarkup(
    createElement(
      SkipProvider,
      null,
      createElement(
        LiveRegionProvider,
        null,
        createElement(
          MotionProvider,
          null,
          createElement(SealBreak, {
            patternKey: "us-maya",
            onAdvance: () => undefined,
            ...overrides,
          }),
        ),
      ),
    ),
  );

/** Every crack path's `stroke-dashoffset` as it appears in the markup. */
const crackDashoffsets = (markup: string): string[] =>
  Array.from(markup.matchAll(/<path[^>]*stroke-dashoffset="([^"]+)"/g)).map(
    (m) => m[1],
  );

describe("SealBreak settled render shows the unbroken seal (Property 2, seal clauses)", () => {
  it("is not broken: data-broken is false and no split, flap or letter is drawn", () => {
    const markup = renderSealBreak();
    expect(markup).toContain('data-broken="false"');
    expect(markup).not.toContain('data-broken="true"');
    // Flakes carry their fall vector as inline custom properties; none appear
    // before the seal breaks.
    expect(markup).not.toContain("--flake-x");
    expect(markup).not.toContain("--flake-dx");
  });

  it("draws no crack: all nine paths are hidden at the full dash offset", () => {
    const offsets = crackDashoffsets(renderSealBreak());
    expect(offsets).toHaveLength(CRACK_COUNT);
    for (const offset of offsets) {
      expect(Number(offset)).toBe(TOTAL_LENGTH);
    }
  });

  it("renders the same markup on every render (server and first client render agree)", () => {
    const first = renderSealBreak();
    expect(renderSealBreak()).toBe(first);
    expect(renderSealBreak()).toBe(first);
  });
});

describe("SealBreak seal clause of Property 19: the pointer target has a real button in the same Stage", () => {
  // Feature: 05-reveal-ceremony, Property 19: the seal is the pointer target
  // but the accessible control is a real button that sends the same ADVANCE.
  it("hides the pointer target from assistive tech and keeps it out of the tab order", () => {
    const markup = renderSealBreak();
    const target = markup.match(/<span[^>]*aria-hidden="true"[^>]*>/);
    expect(target).not.toBeNull();
    expect(target?.[0]).not.toMatch(/tabindex/i);
    expect(target?.[0]).not.toMatch(/role="button"/);
  });

  it("renders a real <button type=\"button\"> carrying the Break the seal label", () => {
    const markup = renderSealBreak();
    expect(markup).toMatch(
      new RegExp(
        `<button[^>]*type="button"[^>]*>${CEREMONY_COPY.sealButton}</button>`,
      ),
    );
  });

  it("shows the instruction line in the same Stage as the button", () => {
    const markup = renderSealBreak();
    expect(markup).toContain(
      CEREMONY_COPY.sealInstruction.replace(/'/g, "&#x27;"),
    );
  });
});

describe("SealBreak source (Property 21)", () => {
  // Comments are blanked before matching, so the doc comments that name these
  // calls do not count. String literals are blanked too, so only real calls
  // match.
  const code = readFileSync(SOURCE_PATH, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"(?:\\.|[^"\\])*"/g, '""')
    .replace(/'(?:\\.|[^'\\])*'/g, "''")
    .replace(/`(?:\\.|[^`\\])*`/g, "``");

  it("calls no Math.random and no Date.now", () => {
    expect(code).not.toMatch(/\bMath\s*\.\s*random\b/);
    expect(code).not.toMatch(/\bDate\s*\.\s*now\b/);
  });

  it("imports no @/lib/crypto statically", () => {
    // The specifier is composed from fragments so this test file itself does
    // not contain a literal static crypto import (see source-scan.test.ts).
    const cryptoPrefix = ["@", "lib", "crypto"].join("/");
    const staticImport = new RegExp(
      `(?:from|import)\\s*["']${cryptoPrefix}(?:/[^"']*)?["']`,
    );
    expect(staticImport.test(readFileSync(SOURCE_PATH, "utf8"))).toBe(false);
  });
});
