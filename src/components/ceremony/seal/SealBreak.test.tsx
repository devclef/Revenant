// Feature: 05-reveal-ceremony, 07-judge-journey (task 5)
//
// Markup and source tests for SealBreak (design.md "Seal_Break"; Property 2's
// seal clauses, Property 19's seal clause, Property 21). The hold logic moved to
// `useSealBreak` and is tested in `useSealBreak.test.ts`; the pointer target is
// tested in `HeldSeal.test.tsx`. Here SealBreak is rendered to static markup
// with a controller that never moves, so the settled state is checked.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CEREMONY_COPY } from "../copy";
import { LiveRegionProvider } from "../LiveRegion";
import { MotionProvider } from "../motion";
import { SkipProvider } from "../skip";
import { SealBreak, type SealBreakProps } from "./SealBreak";
import { TOTAL_LENGTH, CRACK_COUNT } from "./cracks";
import type { SealController } from "./useSealBreak";

const SOURCE_PATH = new URL("./SealBreak.tsx", import.meta.url);

/** A settled controller: the seal is intact and nothing is moving. */
const SETTLED: SealController = {
  hold: { phase: "idle", progress: 0 },
  broken: false,
  progress: 0,
  press: () => undefined,
  breakNow: () => undefined,
  showAll: () => undefined,
  skip: () => undefined,
  connect: () => undefined,
};

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
            seal: SETTLED,
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
  it("hides the pointer target from assistive tech and keeps it out of the tab order", () => {
    const markup = renderSealBreak();
    const target = markup.match(/<span[^>]*aria-hidden="true"[^>]*>/);
    expect(target).not.toBeNull();
    expect(target?.[0]).not.toMatch(/tabindex/i);
    expect(target?.[0]).not.toMatch(/role="button"/);
    expect(target?.[0]).toContain("data-seal-target");
  });

  it('renders a real <button type="button"> carrying the Break the seal label', () => {
    const markup = renderSealBreak();
    expect(markup).toMatch(
      new RegExp(
        `<button[^>]*type="button"[^>]*>${CEREMONY_COPY.sealButton}</button>`,
      ),
    );
  });

  it("shows the hint line in the same Stage as the button", () => {
    const markup = renderSealBreak();
    expect(markup).toContain(
      CEREMONY_COPY.sealHint.replace(/'/g, "&#x27;"),
    );
  });

  it("renders the Show everything button only when asked", () => {
    expect(renderSealBreak({ showAll: true })).toMatch(/<button[^>]*>[^<]+<\/button>/);
    const without = renderSealBreak();
    const buttons = without.match(/<button/g) ?? [];
    expect(buttons).toHaveLength(1);
  });
});

describe("SealBreak source (Property 21, and the hold has moved out)", () => {
  // Comments are blanked before matching, so the doc comments that name these
  // calls do not count. String literals are blanked too.
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
    const cryptoPrefix = ["@", "lib", "crypto"].join("/");
    const staticImport = new RegExp(
      `(?:from|import)\\s*["']${cryptoPrefix}(?:/[^"']*)?["']`,
    );
    expect(staticImport.test(readFileSync(SOURCE_PATH, "utf8"))).toBe(false);
  });

  it("no longer owns the hold: it reads the controller and imports no hold model", () => {
    expect(code).not.toMatch(/from\s*["']\.\/hold["']/);
    expect(code).not.toMatch(/\bonTick\b|\bonPress\b|\bonRelease\b/);
    expect(code).toMatch(/seal\.connect|connect\(/);
  });
});

describe("SealBreak hint colour", () => {
  it("sets the hint line to the paper ink, not the desk ink", () => {
    const css = readFileSync(join(__dirname, "SealBreak.module.css"), "utf8");
    expect(css).toMatch(/\.hint\s*\{[^}]*color:\s*var\(--ink\)/);
    expect(css).not.toMatch(/\.hint\s*\{[^}]*color:\s*var\(--desk-ink/);
  });
});

describe("SealBreak Top_Bar Skip: registered only from a break until it settles", () => {
  // Effects do not run under renderToStaticMarkup, so the registration is
  // checked on the source with comments and string literals blanked out.
  const code = readFileSync(SOURCE_PATH, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ");

  it("does not register a skip on mount (the seal waits at its marks)", () => {
    expect(code).not.toMatch(/useEffect\(\s*\(\)\s*=>\s*register\(/);
  });

  it("registers the skip only while a break is armed and not yet broken", () => {
    expect(code).toMatch(/const\s+skipArmed\s*=\s*skipRegisteredFor\(\s*breaking\s*,\s*broken\s*\)/);
    expect(code).toMatch(
      /skipArmed\s*\?\s*register\(\s*\(\)\s*=>\s*skip\(\)\s*\)\s*:\s*undefined/,
    );
  });

  it("arms the registration from the button press (breakNow)", () => {
    expect(code).toMatch(/const\s+onButton\s*=\s*\(\)\s*=>\s*\{\s*setBreaking\(true\);\s*breakNow\(/);
  });
});
