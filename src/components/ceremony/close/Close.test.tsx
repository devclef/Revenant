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
import { LIVE_COPY } from "@/components/reveal/copy";
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
      "The space between the two is yours to read.",
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
