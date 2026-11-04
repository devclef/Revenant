import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Persona } from "@/lib/personas";

// The persona list is read at render time, so a mutable state object lets one
// file cover both the one-persona and the empty-list cases.
const state = vi.hoisted(() => ({
  personas: [] as Array<{ key: string; display_name: string }>,
}));

vi.mock("@/lib/personas", () => ({
  get PERSONAS() {
    return state.personas;
  },
}));

import Home from "@/app/page";

const MAYA: Persona = {
  key: "us-maya",
  display_name: "Maya",
} as unknown as Persona;

/** Renders the landing page with the given persona list. */
function render(personas: Array<{ key: string; display_name: string }>) {
  state.personas = personas;
  return renderToStaticMarkup(createElement(Home));
}

/** Text content of the markup, tags removed and whitespace collapsed. */
function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Decodes the apostrophe that renderToStaticMarkup escapes in text. */
function decode(html: string): string {
  return html.replace(/&#x27;/g, "'");
}

describe("landing page `/`", () => {
  beforeEach(() => {
    state.personas = [];
  });

  it("renders no Ghost element and no data-ghost marker (Property 20, landing part)", () => {
    const html = render([MAYA]);
    expect(html).not.toContain("data-ghost");
    expect(html.toLowerCase()).not.toContain("ghost");
  });

  it("renders exactly one h1 with the exact headline text", () => {
    const html = render([MAYA]);
    const h1s = html.match(/<h1[\s>]/g) ?? [];
    expect(h1s).toHaveLength(1);
    const headline = /<h1[^>]*>(.*?)<\/h1>/s.exec(html);
    expect(headline).not.toBeNull();
    expect(textOf(headline?.[1] ?? "")).toBe(
      "Your past self returns with the receipts.",
    );
  });

  it("renders the Scene root with data-ceremony=\"scene\"", () => {
    const html = render([MAYA]);
    expect(html.match(/data-ceremony="scene"/g)).toHaveLength(1);
  });

  it("renders one Accent button to the first persona, labelled with its name", () => {
    const html = decode(render([MAYA]));
    const links = html.match(/<a [^>]*href="\/demo\/personas\/[^"]*"[^>]*>/g) ?? [];
    expect(links).toHaveLength(1);
    expect(links[0]).toContain('href="/demo/personas/us-maya"');

    const anchor = /<a [^>]*href="\/demo\/personas\/us-maya"[^>]*>(.*?)<\/a>/s.exec(
      html,
    );
    expect(textOf(anchor?.[1] ?? "")).toBe("Open Maya's letter");
  });

  it("renders no persona button for an empty list, but keeps the headline and the demo link", () => {
    const html = render([]);
    expect(html).not.toContain("/demo/personas/");
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toContain('href="/demo"');
  });

  it("renders the three explanation paragraphs after the Scene, verbatim", () => {
    const html = render([MAYA]);
    const sceneAt = html.indexOf('data-ceremony="scene"');
    const explainStart = html.indexOf("Revenant is a sealed letter");
    expect(sceneAt).toBeGreaterThanOrEqual(0);
    expect(explainStart).toBeGreaterThan(sceneAt);
    const text = decode(html);
    expect(text).toContain(
      "Revenant is a sealed letter to your future self. You write what is on your mind today, and you choose the numbers that matter to you — the price of fuel, groceries, rent — each one a real figure from an official source, kept with its date and where it came from.",
    );
    expect(text).toContain(
      "You pick a date to open it. Then you seal the letter. Once sealed, it cannot be changed, not even by you, and no one else can read it.",
    );
    expect(text).toContain(
      "When that date arrives, the letter opens. First it asks how you remember things. Then it shows what you wrote, and the numbers then beside the numbers now. The space between the two is yours to read.",
    );
  });

  it("links to /demo with the demo link text after the Scene", () => {
    const html = render([MAYA]);
    const anchor = /<a[^>]*href="\/demo"[^>]*>(.*?)<\/a>/s.exec(html);
    expect(anchor).not.toBeNull();
    expect(textOf(anchor?.[1] ?? "")).toBe("Open the demo letters");
    const sceneAt = html.indexOf('data-ceremony="scene"');
    expect(anchor?.index ?? -1).toBeGreaterThan(sceneAt);
  });

  it("includes the no-script light style as a noscript block", () => {
    const html = render([MAYA]);
    expect(html).toContain("<noscript>");
    expect(html).toContain('[aria-hidden="true"]>div:first-child{animation:none}');
  });

  it("references only a selector that the rendered markup actually matches", () => {
    const html = render([MAYA]);
    const noscript = /<noscript>\s*<style>(.*?)<\/style>\s*<\/noscript>/s.exec(html);
    expect(noscript).not.toBeNull();
    const css = decode(noscript?.[1] ?? "");
    const selectors = [...css.matchAll(/([^{}]+)\{[^}]*\}/g)].map((m) =>
      m[1].trim(),
    );
    expect(selectors).toEqual(['[aria-hidden="true"]>div:first-child']);
    // The backdrop is the one aria-hidden layer; its first child is the light.
    const backdrop = /aria-hidden="true"[^>]*><div[^>]*><\/div>/.exec(html);
    expect(backdrop).not.toBeNull();
    expect(html).not.toContain("data-scene-light");
  });

  it("stacks the Accent button above the backdrop layer", () => {
    const html = decode(render([MAYA]));
    // Attribute order is not fixed, so find the anchor tag and read its style.
    const tag = (html.match(/<a [^>]*>/g) ?? []).find((t) =>
      t.includes('href="/demo/personas/us-maya"'),
    );
    expect(tag).toBeDefined();
    const style = /style="([^"]*)"/.exec(tag ?? "")?.[1] ?? "";
    expect(style).toMatch(/(^|;)position:relative(;|$)/);
    const buttonZ = /(?:^|;)z-index:(\d+)/.exec(style);
    expect(buttonZ).not.toBeNull();

    // The backdrop's z-index is in the CSS module, not inline, so read it there.
    const moduleCss = readFileSync(
      new URL("../components/ceremony/scene/scene.module.css", import.meta.url),
      "utf8",
    );
    const backdropRule = /\.backdrop\s*\{([^}]*)\}/.exec(moduleCss);
    expect(backdropRule).not.toBeNull();
    const backdropZ = /z-index:\s*(\d+)/.exec(backdropRule?.[1] ?? "");
    expect(backdropZ).not.toBeNull();

    expect(Number(buttonZ?.[1])).toBeGreaterThan(Number(backdropZ?.[1]));
  });

  it("imports nothing from crypto, the opening flow, the API, or the database", () => {
    const files = [
      new URL("../app/page.tsx", import.meta.url),
      new URL("../lib/landing-backdrop.ts", import.meta.url),
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const specifiers = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map(
        (match) => match[1],
      );
      expect(specifiers.length).toBeGreaterThan(0);
      for (const specifier of specifiers) {
        expect(specifier).not.toMatch(/crypto/);
        expect(specifier).not.toMatch(/useOpeningFlow/);
        expect(specifier).not.toMatch(/\/api\//);
        expect(specifier).not.toMatch(/\bdb\b|drizzle|letter-store/);
        expect(specifier).not.toMatch(/ghost/i);
      }
    }
    const page = readFileSync(new URL("../app/page.tsx", import.meta.url), "utf8");
    expect(page).not.toMatch(/^["']use client["'];?\s*$/m);
    const wrapper = readFileSync(
      new URL("../lib/landing-backdrop.ts", import.meta.url),
      "utf8",
    );
    expect(wrapper.trimStart().startsWith('"use client";')).toBe(true);
  });
});
