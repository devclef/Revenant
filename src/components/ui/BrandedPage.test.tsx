// Feature: 09-demo-polish, A14 (branded not-found and error pages)
//
// Render tests for BrandedPage. They use renderToStaticMarkup in the node
// environment, like the other markup tests. The motion and skip providers are
// mocked so the Top_Bar renders its Calm control without a browser.
//
// The contrast check reads the real token values out of tokens.css and
// BrandedPage.module.css, so it tracks the tokens rather than a copy of them.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CEREMONY_COPY } from "@/components/ceremony/copy";
import { SCENE_COPY } from "@/components/ceremony/scene/copy";

vi.mock("@/components/ceremony/motion", () => ({
  useMotion: () => ({ mode: "full", setCalm: () => {} }),
  MotionProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/ceremony/skip", () => ({
  useSequence: () => ({ hasActive: false, register: () => () => {}, skipAll: () => {} }),
  SkipProvider: ({ children }: { children: ReactNode }) => children,
}));

// Imported after the mocks (vi.mock is hoisted).
import { BrandedPage } from "./BrandedPage";
import { UI_COPY } from "./copy";

const HEADING = "A heading for the test.";
const BODY = "One line of copy for the test.";

const html = renderToStaticMarkup(createElement(BrandedPage, { heading: HEADING, body: BODY }));

const here = dirname(fileURLToPath(import.meta.url));
const read = (path: string): string => readFileSync(path, "utf8");

describe("BrandedPage structure", () => {
  it("renders exactly one h1 with the heading", () => {
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toContain(`<h1 class="`);
    expect(html).toMatch(new RegExp(`<h1[^>]*>${HEADING}</h1>`));
  });

  it("renders the copy as one paragraph", () => {
    expect(html).toMatch(new RegExp(`<p[^>]*>${BODY}</p>`));
  });

  it("links to /demo with the demo link label", () => {
    expect(html).toContain(`href="/demo"`);
    expect(html).toContain(UI_COPY.branded.demoLink);
  });

  it("renders the Top_Bar with the wordmark and the Calm control", () => {
    expect(html).toContain("data-topbar");
    expect(html).toContain("data-wordmark");
    expect(html).toContain(CEREMONY_COPY.calmOn);
  });

  it("hides the Demo chip, because these pages are not demo letters", () => {
    expect(html).not.toContain(`>${SCENE_COPY.demoChip}<`);
  });

  it("renders the Soil_Fallback strip", () => {
    expect(html).toContain("data-soil-strip");
  });

  it("does not render a footer, because the root layout owns it", () => {
    expect(html).not.toContain("<footer");
  });

  it("renders no Soil_Canvas, crypto or Opening_Flow markup", () => {
    expect(html).not.toContain("data-soil-canvas");
    expect(html).not.toContain("data-ceremony=");
  });
});

describe("BrandedPage action slot", () => {
  it("renders the action below the copy when one is given", () => {
    const withAction = renderToStaticMarkup(
      createElement(BrandedPage, {
        heading: HEADING,
        body: BODY,
        action: createElement("button", { type: "button" }, UI_COPY.error.retry),
      }),
    );
    expect(withAction).toContain(`<button type="button"`);
    expect(withAction).toContain(UI_COPY.error.retry);
    expect(withAction.indexOf(BODY)).toBeLessThan(withAction.indexOf(UI_COPY.error.retry));
  });

  it("renders no action wrapper when none is given", () => {
    expect(html).not.toMatch(/class="[^"]*action/);
  });
});

describe("BrandedPage imports", () => {
  it("loads no Soil_Canvas, crypto, card, calendar or Opening_Flow module", () => {
    const source = read(resolve(here, "BrandedPage.tsx"));
    const imports = [...source.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    for (const path of imports) {
      expect(path).not.toMatch(/soil-canvas|lib\/crypto|lib\/cards|lib\/ics|Opening/);
    }
  });
});

describe("BrandedPage copy", () => {
  const strings: Array<[string, string]> = [
    ["notFound.heading", UI_COPY.notFound.heading],
    ["notFound.body", UI_COPY.notFound.body],
    ["error.heading", UI_COPY.error.heading],
    ["error.body", UI_COPY.error.body],
    ["error.retry", UI_COPY.error.retry],
    ["branded.demoLink", UI_COPY.branded.demoLink],
  ];

  it.each(strings)("%s has no exclamation mark and no grading word", (_name, text) => {
    expect(text).not.toContain("!");
    for (const word of ["wrong", "caught", "mistake", "error:", "oops", "sorry"]) {
      expect(text.toLowerCase()).not.toContain(word);
    }
  });

  it("uses the not-found copy from design.md", () => {
    expect(UI_COPY.notFound.heading).toBe("This page is not here.");
  });
});

describe("BrandedPage contrast (WCAG 2.2 AA, >= 4.5:1)", () => {
  const tokensCss = read(resolve(here, "..", "ceremony", "scene", "tokens.css"));
  const pageCss = read(resolve(here, "BrandedPage.module.css"));

  /** A `--token: #rrggbb;` value from tokens.css. */
  function token(name: string): string {
    const match = new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})\\b`).exec(tokensCss);
    if (match === null) throw new Error(`token ${name} not found`);
    return match[1];
  }

  /** WCAG relative luminance of a 6-digit hex colour. */
  function luminance(hex: string): number {
    const channel = (i: number): number => {
      const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
  }

  function ratio(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  }

  it("sets the page text to --text, which the page's colour variable points at", () => {
    expect(pageCss).toMatch(/--text-on-desk:\s*var\(--text\)/);
  });

  it("clears AA for heading, copy and link text on --bg", () => {
    expect(ratio(token("--text"), token("--bg"))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the link off the global wax-seal colour", () => {
    expect(pageCss).toMatch(/\.link\s*\{[^}]*color:\s*var\(--text-on-desk\)/);
  });
});
