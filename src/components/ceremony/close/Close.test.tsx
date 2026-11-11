// Feature: 07-judge-journey, spec 07 task 6 (design.md "Close")
//
// Close renders the persona items in order, the Demo_2_On link only while
// demo2On is true, and the live kind's R18.6 note unchanged. Tests use
// renderToStaticMarkup, the house style for component tests in this repo.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CEREMONY_COPY } from "@/components/ceremony/copy";
import { LIVE_COPY } from "@/components/live/copy";
import { Close, DEMO_2_HREF, startOverHref } from "./Close";

const KEY = "us-maya";

const renderPersona = (demo2On: boolean) =>
  renderToStaticMarkup(
    createElement(Close, { kind: "persona", personaKey: KEY, demo2On }),
  );

/** The visible text of the markup: every tag removed. */
const textOf = (html: string): string => html.replace(/<[^>]+>/g, "");

describe("Close, persona kind", () => {
  it("renders the heading as an h2 with the closing line", () => {
    const html = renderPersona(false);
    expect(html).toMatch(/<h2[^>]*>/);
    expect(html).toContain(CEREMONY_COPY.closeLine);
    expect(CEREMONY_COPY.closeLine).toBe(
      "Your testimony sits beside the record. What lies between them is yours to read.",
    );
  });

  it("puts the Demo_2_On link, the note and Start over in that order when demo2On is true", () => {
    const html = renderPersona(true);
    const at = (s: string) => html.indexOf(s);
    expect(at(CEREMONY_COPY.closeLine)).toBeGreaterThanOrEqual(0);
    expect(at(CEREMONY_COPY.closeLink)).toBeGreaterThan(at(CEREMONY_COPY.closeLine));
    expect(at(CEREMONY_COPY.closeNote)).toBeGreaterThan(at(CEREMONY_COPY.closeLink));
    expect(at(CEREMONY_COPY.startOver)).toBeGreaterThan(at(CEREMONY_COPY.closeNote));
  });

  it("links the Demo_2_On text to /demo/live as an anchor", () => {
    const html = renderPersona(true);
    expect(DEMO_2_HREF).toBe("/demo/live");
    expect(html).toMatch(
      new RegExp(`<a[^>]*href="/demo/live"[^>]*>${CEREMONY_COPY.closeLink}</a>`),
    );
  });

  it("omits the /demo/live link entirely when demo2On is false", () => {
    const html = renderPersona(false);
    expect(html).not.toContain("/demo/live");
    expect(html).not.toContain(CEREMONY_COPY.closeLink);
  });

  it("keeps the note and Start over when demo2On is false", () => {
    const html = renderPersona(false);
    expect(html).toContain(CEREMONY_COPY.closeNote);
    expect(html).toContain(CEREMONY_COPY.startOver);
    expect(textOf(html)).toBe(
      `${CEREMONY_COPY.closeLine}${CEREMONY_COPY.closeNote}${CEREMONY_COPY.startOver}`,
    );
  });

  it("renders Start over as a plain anchor to the same persona", () => {
    expect(startOverHref(KEY)).toBe(`/demo/personas/${KEY}`);
    const html = renderPersona(true);
    expect(html).toMatch(
      new RegExp(`<a[^>]*href="/demo/personas/${KEY}"[^>]*>${CEREMONY_COPY.startOver}</a>`),
    );
  });

  it("renders no form controls and no button", () => {
    const html = renderPersona(true);
    expect(html).not.toMatch(/<(input|select|textarea|button)\b/);
  });

  it("sets each link at least 44 px tall with a focus ring in the stylesheet", () => {
    const css = readFileSync(
      join(process.cwd(), "src/components/ceremony/close/close.module.css"),
      "utf8",
    );
    expect(css).toMatch(/\.cta\s*\{[^}]*min-height:\s*44px/);
    expect(css).toMatch(/\.quietLink\s*\{[^}]*min-height:\s*44px/);
    expect(css).toMatch(/\.cta:focus-visible\s*\{[^}]*outline/);
    expect(css).toMatch(/\.quietLink:focus-visible\s*\{[^}]*outline/);
  });

  it("sets the close link colours with two-class selectors so the scene's link rule cannot override them", () => {
    const css = readFileSync(
      join(process.cwd(), "src/components/ceremony/close/close.module.css"),
      "utf8",
    );
    // `.scene a` has specificity 0,1,1, so a single-class colour rule loses to it.
    expect(css).toMatch(/\.close\s+\.cta\s*\{[^}]*color:\s*var\(--on-accent\)/);
    expect(css).toMatch(/\.close\s+\.quietLink\s*\{[^}]*color:\s*var\(--ink\)/);
    expect(css).not.toMatch(/^\.cta\s*\{[^}]*(?<![-\w])color:/m);
    expect(css).not.toMatch(/^\.quietLink\s*\{[^}]*(?<![-\w])color:/m);
  });
});

describe("Close, live kind", () => {
  it("renders the R18.6 note and its link with the spec 06 wording unchanged", () => {
    const html = renderToStaticMarkup(createElement(Close, { kind: "live" }));
    expect(html).toContain(LIVE_COPY.lockNote);
    expect(html).toContain(LIVE_COPY.lockNoteLink);
    expect(html).toContain('href="/demo"');
    expect(html).not.toContain(CEREMONY_COPY.closeLine);
    expect(html).not.toContain(CEREMONY_COPY.startOver);
  });
});

describe("Close, real kind", () => {
  it("renders nothing: no LiveLockNote, no persona items, no demo link", () => {
    const html = renderToStaticMarkup(createElement(Close, { kind: "real" }));
    expect(html).toBe("");
    expect(html).not.toContain(LIVE_COPY.lockNote);
    expect(html).not.toContain(CEREMONY_COPY.closeLine);
    expect(html).not.toContain("/demo/live");
  });
});

describe("Close, persona kind with no figures (spec 11 L5.2)", () => {
  it("uses the exact no-figures closing line", () => {
    expect(CEREMONY_COPY.closeLineNoFigures).toBe(
      "Her testimony and her letter are side by side. What they say is yours to read.",
    );
  });

  it("renders the no-figures line in place of the closing line when hasFigures is false", () => {
    const html = renderToStaticMarkup(
      createElement(Close, { kind: "persona", personaKey: KEY, demo2On: false, hasFigures: false }),
    );
    expect(html).toContain(CEREMONY_COPY.closeLineNoFigures);
    expect(html).not.toContain(CEREMONY_COPY.closeLine);
    expect(html).toMatch(/<h2[^>]*data-close-line=""[^>]*>/);
  });

  it("names no number, figure or price in the no-figures line", () => {
    expect(CEREMONY_COPY.closeLineNoFigures).not.toMatch(/\d|figure|number|price|record/i);
  });

  it("keeps the figures line when hasFigures is true or omitted", () => {
    const withFigures = renderToStaticMarkup(
      createElement(Close, { kind: "persona", personaKey: KEY, demo2On: false, hasFigures: true }),
    );
    const omitted = renderToStaticMarkup(
      createElement(Close, { kind: "persona", personaKey: KEY, demo2On: false }),
    );
    expect(withFigures).toContain(CEREMONY_COPY.closeLine);
    expect(omitted).toContain(CEREMONY_COPY.closeLine);
  });
});

describe("Skip_Link copy for a letter with no figures (spec 11 L5.4)", () => {
  it("uses the exact skipToLetter text", () => {
    expect(CEREMONY_COPY.skipToLetter).toBe("Skip to the letter");
    expect(CEREMONY_COPY.skipToReceipts).toBe("Skip to the receipts");
  });
});
