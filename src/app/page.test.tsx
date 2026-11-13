import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Home from "./page";
import { Footer } from "@/components/ui/Footer";
import { BRAND_COPY } from "@/components/brand/copy";
import { LANDING_COPY } from "@/components/landing/copy";
import { COVEN_LINKS } from "@/components/landing/CovenStrip";
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

/** Markup of the page alone, without the footer the root layout adds. */
function renderPage(): string {
  return renderToStaticMarkup(createElement(Home));
}

describe("landing page render on / (H1)", () => {
  beforeEach(() => {
    vi.stubEnv("RP_ID", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders the sections in order: hero, ritual, resurrection, no-seal, coven", () => {
    const html = renderPage();
    const positions = [
      html.indexOf("data-landing-hero"),
      html.indexOf('id="ritual-title"'),
      html.indexOf('id="resurrected-title"'),
      html.indexOf('id="no-seal-title"'),
      html.indexOf('id="coven-title"'),
    ];
    for (const position of positions) {
      expect(position).toBeGreaterThan(-1);
    }
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it("renders each landing section exactly once", () => {
    const html = renderPage();
    for (const id of [
      "ritual-title",
      "resurrected-title",
      "no-seal-title",
      "coven-title",
    ]) {
      expect(countOf(html, `id="${id}"`)).toBe(1);
    }
    expect(countOf(html, "data-landing-hero")).toBe(1);
  });

  it("keeps the How_Page and GitHub repository links out of the page body", () => {
    const html = renderPage();
    expect(countOf(html, `href="${HOW_HREF}"`)).toBe(0);
    expect(countOf(html, `href="${GITHUB_HREF}"`)).toBe(0);
  });

  it("renders the How_Page and GitHub repository links exactly once, in the footer", () => {
    const footer = renderToStaticMarkup(createElement(Footer));
    expect(countOf(footer, `href="${HOW_HREF}"`)).toBe(1);
    expect(countOf(footer, `href="${GITHUB_HREF}"`)).toBe(1);
  });

  it("places the Coven_Strip links only inside the strip", () => {
    const html = renderPage();
    const stripStart = html.indexOf('id="coven-title"');
    expect(stripStart).toBeGreaterThan(-1);
    const beforeStrip = html.slice(0, stripStart);

    for (const href of [COVEN_LINKS.kiro, COVEN_LINKS.loop]) {
      expect(countOf(html, `href="${href}"`)).toBe(1);
      expect(countOf(beforeStrip, `href="${href}"`)).toBe(0);
      expect(html.indexOf(`href="${href}"`)).toBeGreaterThan(stripStart);
    }

    // The footer carries no Coven link either.
    const footer = renderToStaticMarkup(createElement(Footer));
    expect(footer).not.toContain(COVEN_LINKS.kiro);
    expect(footer).not.toContain(COVEN_LINKS.loop);
  });
});

// H1 step 3: the describe was called "wrapper" when the sections sat in a
// `landingBelow` div. They now go through SceneShell `below`, so it is renamed.
describe("landing sections below the hero and heading colour (H1)", () => {
  beforeEach(() => {
    vi.stubEnv("RP_ID", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders the four sections after the hero, with no landingBelow wrapper", () => {
    const html = renderPage();
    // The sections are passed as SceneShell `below`, not wrapped in a page div.
    expect(countOf(html, 'class="landingBelow"')).toBe(0);

    const heroStart = html.indexOf("data-landing-hero");
    expect(heroStart).toBeGreaterThan(-1);
    for (const id of [
      "ritual-title",
      "resurrected-title",
      "no-seal-title",
      "coven-title",
    ]) {
      const position = html.indexOf(`id="${id}"`);
      expect(position).toBeGreaterThan(heroStart);
    }
  });

  it("keeps the section order", () => {
    const html = renderPage();
    const positions = [
      html.indexOf('id="ritual-title"'),
      html.indexOf('id="resurrected-title"'),
      html.indexOf('id="no-seal-title"'),
      html.indexOf('id="coven-title"'),
    ];
    for (const position of positions) {
      expect(position).toBeGreaterThan(-1);
    }
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });
});

describe("landing heading colour in globals.css (H1)", () => {
  it("scopes the h2 and h3 colour to landingBelow and uses var(--text)", () => {
    const css = readFileSync(
      fileURLToPath(new URL("./globals.css", import.meta.url)),
      "utf8",
    );
    const rule =
      /\.landingBelow h2,\s*\.landingBelow h3\s*\{\s*color:\s*var\(--text\);?\s*\}/;
    expect(css).toMatch(rule);
  });
});
