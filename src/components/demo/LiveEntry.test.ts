// LiveEntry heading typography: the heading is a sans headline, not the serif.
// The serif is for the letter text only (tone.md). This reads the stylesheet
// rule directly, so a change to the font falls back to the serif and fails.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DEMO_COPY } from "./copy";
import { LiveEntry } from "./LiveEntry";

// The card's link is a next/link, which reads the app router. The router is
// stubbed here, as on the Demo_Index page tests.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ prefetch: () => undefined, push: () => undefined }),
}));

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, "LiveEntry.module.css"), "utf8");

/** The declarations of the first rule whose selector is exactly `.name`. */
function ruleBody(name: string): string {
  const match = new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`).exec(css);
  if (match === null) throw new Error(`no .${name} rule in LiveEntry.module.css`);
  return match[1] ?? "";
}

describe("LiveEntry headings", () => {
  it("uses no serif font in any rule of the stylesheet", () => {
    // The file has no .title rule; this also covers one if it is added later.
    expect(css).not.toMatch(/--font-serif/);
  });

  it("uses the sans font for the heading", () => {
    expect(ruleBody("heading")).toMatch(/font-family:\s*var\(--font-sans\)/);
  });

  it("does not use the serif for the heading", () => {
    expect(ruleBody("heading")).not.toMatch(/--font-serif/);
  });

  it("keeps the heading weight", () => {
    expect(ruleBody("heading")).toMatch(/font-weight:\s*600/);
  });
});

/**
 * D1.2: the live entry is a paper card, the last `li` of the Persona_List. It
 * holds a heading, a body and one link to `/demo/live`, in that order. It
 * carries no WaxSeal and no envelope.
 */
describe("LiveEntry card markup (D1.2)", () => {
  const html = renderToStaticMarkup(createElement(LiveEntry));

  it("renders one li marked as the live entry card", () => {
    expect(html.startsWith("<li")).toBe(true);
    expect(html.endsWith("</li>")).toBe(true);
    expect(html).toContain('data-live-entry-card=""');
    expect(html.match(/<li/g)).toHaveLength(1);
  });

  it("renders the link as an a element to /demo/live with the link copy", () => {
    const link = new RegExp(
      `<a [^>]*href="/demo/live"[^>]*>${DEMO_COPY.liveEntryLink}</a>`,
    );
    expect(html).toMatch(link);
    expect(html.match(/<a /g)).toHaveLength(1);
  });

  it("holds no WaxSeal and no envelope", () => {
    expect(html).not.toContain("<svg");
    expect(html).not.toContain("data-persona-seal");
    expect(html.toLowerCase()).not.toContain("envelope");
  });

  it("puts the heading, then the body, then the link (D1.2)", () => {
    const headingAt = html.indexOf(DEMO_COPY.liveEntryHeading);
    const bodyAt = html.indexOf(DEMO_COPY.liveEntryBody);
    const linkAt = html.indexOf('href="/demo/live"');
    expect(headingAt).toBeGreaterThanOrEqual(0);
    expect(bodyAt).toBeGreaterThan(headingAt);
    expect(linkAt).toBeGreaterThan(bodyAt);
    expect(html.indexOf("<h2")).toBeLessThan(html.indexOf("<p"));
    expect(html.indexOf("<p")).toBeLessThan(html.indexOf("<a "));
  });
});
