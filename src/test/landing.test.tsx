import { existsSync, readFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LANDING_COPY } from "@/components/landing/copy";
import type { Persona } from "@/lib/personas";

// feature-flags.ts imports `server-only`, which throws outside a server bundle.
vi.mock("server-only", () => ({}));

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

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders exactly one h1 with the Tagline text", () => {
    const html = render([MAYA]);
    const h1s = html.match(/<h1[\s>]/g) ?? [];
    expect(h1s).toHaveLength(1);
    const headline = /<h1[^>]*>(.*?)<\/h1>/s.exec(html);
    expect(headline).not.toBeNull();
    // The Tagline from Brand_Copy (F2). textOf folds the non-breaking space in
    // "Revenant doesn't." into a plain space.
    expect(textOf(headline?.[1] ?? "")).toBe("Memory rewrites itself. Revenant doesn't.");
  });

  it("renders the Scene root with data-ceremony=\"scene\"", () => {
    const html = render([MAYA]);
    expect(html.match(/data-ceremony="scene"/g)).toHaveLength(1);
  });

  it("renders the hero inside the Scene", () => {
    const html = render([MAYA]);
    const sceneAt = html.indexOf('data-ceremony="scene"');
    const heroAt = html.indexOf("data-landing-hero");
    expect(heroAt).toBeGreaterThan(sceneAt);
  });

  it("renders one Accent button to /demo, labelled with the one-letter text, and no persona link", () => {
    const html = decode(render([MAYA]));
    const links = html.match(/<a [^>]*href="\/demo"[^>]*>/g) ?? [];
    expect(links).toHaveLength(1);
    expect(links[0]).toContain('data-cta="primary"');

    const anchor = /<a [^>]*href="\/demo"[^>]*>(.*?)<\/a>/s.exec(html);
    expect(textOf(anchor?.[1] ?? "")).toBe(LANDING_COPY.primaryCtaOne);
    expect(html).not.toContain("/demo/personas/");
    expect(html).not.toContain("Maya");
  });

  it("renders no primary button for an empty list, and keeps the headline", () => {
    const html = render([]);
    expect(html).not.toContain("/demo/personas/");
    expect(html).not.toContain('data-cta="primary"');
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
  });

  it("includes the no-script light style as a noscript block", () => {
    const html = render([MAYA]);
    expect(html).toContain("<noscript>");
    expect(html).toContain("[data-ghost-rise],[data-ghost-bob]{animation:none}");
  });

  it("leaves How and GitHub to the footer, and links no /seal", () => {
    vi.stubEnv("REAL_SEALING", "on");
    const html = decode(render([MAYA]));
    expect(html).not.toContain('href="/how-it-is-sealed"');
    expect(html).not.toContain('href="https://github.com/devclef/Revenant"');
    expect(html).not.toMatch(/href="\/seal[";/]/);
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

// R9.15: the Landing_Ghost is server-rendered in the backdrop, holds no
// Envelope, and the landing page's import graph stays clear of the Persona
// Ghost and the eye module.
const SRC_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SCENE_DIR = join(SRC_DIR, "components", "ceremony", "scene");

// `import ... from "x"`, `import "x"` and `import("x")`.
const IMPORT_PATTERN =
  /\bfrom\s+["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']\s*\)|\bimport\s+["']([^"']+)["']/g;

/**
 * Resolves a specifier to a source file under src/. Returns null for packages,
 * CSS and anything that does not resolve to a .ts or .tsx file.
 */
function resolveSpecifier(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) {
    base = join(SRC_DIR, specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    base = resolve(dirname(from), specifier);
  } else {
    return null;
  }
  const candidates = [
    `${base}.ts`,
    `${base}.tsx`,
    join(base, "index.ts"),
    join(base, "index.tsx"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

/** Every source file reachable from `entry` by static or dynamic import. */
function importGraph(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];
  for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
    if (seen.has(file)) continue;
    seen.add(file);
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(IMPORT_PATTERN)) {
      const specifier = match[1] ?? match[2] ?? match[3] ?? "";
      const target = resolveSpecifier(file, specifier);
      if (target !== null) queue.push(target);
    }
  }
  return seen;
}

/**
 * The markup of the element that carries `marker`, from its opening tag to its
 * matching closing tag. Counts nested divs so the Accent link is judged against
 * the real pit boundary, not a guessed end string.
 */
function elementAround(html: string, marker: string): string {
  const markerAt = html.indexOf(marker);
  expect(markerAt).toBeGreaterThanOrEqual(0);
  const start = html.lastIndexOf("<div", markerAt);
  let depth = 0;
  let cursor = start;
  while (cursor < html.length) {
    const open = html.indexOf("<div", cursor);
    const close = html.indexOf("</div>", cursor);
    if (close < 0) break;
    if (open >= 0 && open < close) {
      depth += 1;
      cursor = open + 4;
    } else {
      depth -= 1;
      cursor = close + 6;
      if (depth === 0) return html.slice(start, cursor);
    }
  }
  throw new Error(`no closing tag for the element with ${marker}`);
}

describe("landing Ghost in the server HTML (R9.15)", () => {
  beforeEach(() => {
    state.personas = [MAYA];
  });

  it("server-renders the Landing_Ghost pit in the static HTML", () => {
    const html = renderToStaticMarkup(createElement(Home));
    expect(html.match(/data-ghost-pit/g)).toHaveLength(1);
  });

  it("holds no Envelope: no data-envelope in the pit, and the Accent link sits outside it", () => {
    const html = decode(renderToStaticMarkup(createElement(Home)));
    const pit = elementAround(html, "data-ghost-pit");
    expect(pit).not.toContain("data-envelope");
    expect(pit).not.toContain('href="/demo"');
    const pitStart = html.indexOf(pit);
    const pitEnd = pitStart + pit.length;
    const linkAt = html.indexOf('href="/demo"');
    expect(linkAt).toBeGreaterThanOrEqual(0);
    expect(linkAt < pitStart || linkAt >= pitEnd).toBe(true);
  });

  it("reaches neither eyes.ts nor PersonaGhost.tsx from src/app/page.tsx", () => {
    const graph = importGraph(join(SRC_DIR, "app", "page.tsx"));
    // Guard against a walker that finds nothing: the Ghost is a real import.
    expect(graph.has(join(SCENE_DIR, "Ghost.tsx"))).toBe(true);
    const reached = [...graph].map((file) => relative(SRC_DIR, file));
    expect(reached).not.toContain(join("components", "ceremony", "scene", "eyes.ts"));
    expect(reached).not.toContain(
      join("components", "ceremony", "scene", "PersonaGhost.tsx"),
    );
  });

  it("names data-ghost-rise in the noscript rule", () => {
    const html = renderToStaticMarkup(createElement(Home));
    const noscript = /<noscript>(.*?)<\/noscript>/s.exec(html)?.[1] ?? "";
    expect(noscript).toContain("[data-ghost-rise]");
  });
});

// R10.1 and R10.2 (spec 09 B1): the primary call to action links to /demo
// with the singular or plural text by Persona_List length, and the live-demo
// call to action shows only while Demo_2_On (RP_ID is set).

/** The text of one anchor, found by its exact href. */
function anchorText(html: string, href: string): string | null {
  const escaped = href.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const match = new RegExp(`<a[^>]*href="${escaped}"[^>]*>(.*?)</a>`, "s").exec(
    html,
  );
  return match === null ? null : match[1].replace(/<[^>]+>/g, "").trim();
}

describe("landing page call-to-action text and targets (R10.1 and R10.2)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the singular primary text for one persona", () => {
    const html = decode(render([MAYA]));
    expect(anchorText(html, "/demo")).toBe(LANDING_COPY.primaryCtaOne);
  });

  it("uses the plural primary text for two personas", () => {
    const html = decode(
      render([MAYA, { key: "eu-anna", display_name: "Anna" }]),
    );
    expect(anchorText(html, "/demo")).toBe(LANDING_COPY.primaryCtaMany);
    expect(LANDING_COPY.primaryCtaMany).not.toBe(LANDING_COPY.primaryCtaOne);
  });

  it("shows no primary link for no personas", () => {
    const html = decode(render([]));
    expect(anchorText(html, "/demo")).toBeNull();
  });

  it("shows the live-demo call to action only while RP_ID is set", () => {
    vi.stubEnv("RP_ID", "revenant.devclef.se");
    const on = decode(render([MAYA]));
    expect(anchorText(on, "/demo/live")).toBe(LANDING_COPY.secondaryCta);

    vi.stubEnv("RP_ID", "   ");
    const off = decode(render([MAYA]));
    expect(off).not.toContain('href="/demo/live"');
  });
});
