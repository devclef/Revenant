import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Home from "./page";
import { Footer } from "@/components/ui/Footer";
import { BRAND_COPY } from "@/components/brand/copy";
import { LANDING_COPY } from "@/components/landing/copy";
import { PERSONAS } from "@/lib/personas";

// page.tsx imports feature-flags.ts, which imports `server-only`.
vi.mock("server-only", () => ({}));

/**
 * Markup tests for the B1 landing hero (spec 09, issue #256). Renders with
 * `renderToStaticMarkup` and `createElement`, no DOM library and no JSX.
 *
 * The How_Page and GitHub links live in the site footer, which the root layout
 * renders after the page. To check them "exactly once" on `/`, the page markup
 * is joined with the footer markup, as the layout would output them.
 */

const HOW_HREF = "/how-it-is-sealed";
const GITHUB_HREF = "https://github.com/devclef/Revenant";

/** Page markup followed by the footer the root layout adds to it. */
function render(): string {
  return (
    renderToStaticMarkup(createElement(Home)) +
    renderToStaticMarkup(createElement(Footer))
  );
}

/** Text content of the markup, tags removed and whitespace collapsed. */
function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Number of non-overlapping occurrences of `needle` in `haystack`. */
function countOf(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

describe("landing page hero markup (B1)", () => {
  beforeEach(() => {
    // Keep Demo_2_On off so the only call to action is the primary one.
    vi.stubEnv("RP_ID", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders the eyebrow, the Tagline as the one h1, and the hero sentence", () => {
    const html = render();
    expect(textOf(html)).toContain(BRAND_COPY.eyebrow);
    expect(countOf(html, "<h1")).toBe(1);

    const headline = /<h1[^>]*>(.*?)<\/h1>/s.exec(html);
    expect(textOf(headline?.[1] ?? "")).toBe(BRAND_COPY.tagline);
    expect(textOf(html)).toContain(BRAND_COPY.heroSentence);
  });

  it("renders exactly one Accent button, and it links to /demo", () => {
    const html = render();
    const accents = html.match(/class="[^"]*accent[^"]*"/g) ?? [];
    expect(accents).toHaveLength(1);

    const links = html.match(/<a [^>]*href="\/demo"[^>]*>/g) ?? [];
    expect(links).toHaveLength(1);
    expect(links[0]).toContain('data-cta="primary"');
    expect(links[0]).toContain("accent");

    const anchor = /<a [^>]*href="\/demo"[^>]*>(.*?)<\/a>/s.exec(html);
    expect(textOf(anchor?.[1] ?? "")).toBe(LANDING_COPY.primaryCtaMany);
  });

  it("links to no persona letter", () => {
    const html = render();
    expect(html).not.toContain("/demo/personas/");
  });

  it("names no persona display name", () => {
    expect(PERSONAS.length).toBeGreaterThan(0);
    const html = render();
    for (const persona of PERSONAS) {
      expect(html).not.toContain(persona.display_name);
    }
  });

  it("renders no Ghost Envelope and no envelope marker", () => {
    const html = render();
    expect(html).not.toContain("data-envelope");
    expect(html).not.toMatch(/ghost[- ]envelope/i);
  });

  it("links the How_Page exactly once", () => {
    expect(countOf(render(), `href="${HOW_HREF}"`)).toBe(1);
  });

  it("links the GitHub repository exactly once", () => {
    expect(countOf(render(), `href="${GITHUB_HREF}"`)).toBe(1);
  });
});
