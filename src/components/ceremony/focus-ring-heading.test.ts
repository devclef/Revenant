// Feature: spec 17, issue #576 (D6): no focus box on a script-focused heading
//
// CeremonyRoot.focusHeading moves focus to a heading with tabindex -1 so that a
// screen reader announces it. A mouse or script focus must not draw a box round
// that heading. The keyboard rings (`.desk :focus-visible`, `.onPaper
// :focus-visible`) stay, so keyboard users still see where focus is.
//
// Pure file read. No DOM.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const ceremonyCss = readFileSync(join(here, "ceremony.module.css"), "utf8");
const recallCss = readFileSync(join(here, "recall", "RecallReader.module.css"), "utf8");
const rootSource = readFileSync(join(here, "CeremonyRoot.tsx"), "utf8");

const HEADING_SELECTORS = [
  'h1[tabindex="-1"]:focus',
  'h2[tabindex="-1"]:focus',
  "[data-step-heading]:focus",
];

interface CssRule {
  selectors: string[];
  body: string;
}

// Flat rule parser: every `selectors { body }` pair. The CSS in these modules
// has no nested blocks, so a brace-free match is enough.
function parseRules(css: string): CssRule[] {
  const rules: CssRule[] = [];
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const pattern = /([^{}]+)\{([^{}]*)\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(withoutComments)) !== null) {
    rules.push({
      selectors: match[1]!
        .split(",")
        .map((selector) => selector.replace(/\s+/g, " ").trim())
        .filter((selector) => selector.length > 0),
      body: match[2]!,
    });
  }
  return rules;
}

function hasOutlineNoneRule(css: string, selector: string): boolean {
  return parseRules(css).some(
    (rule) => rule.selectors.includes(selector) && /outline:\s*none\s*;/.test(rule.body),
  );
}

// The body of focusHeading as it stands on main. If it changes, this test
// fails so the change is reviewed on purpose.
const FOCUS_HEADING_BODY = `function focusHeading(
  region: HTMLElement,
  target: { selector: string; fallback?: string; scroll: boolean },
  mode: MotionMode,
): (() => void) | undefined {
  const heading =
    region.querySelector<HTMLElement>(target.selector) ??
    (target.fallback === undefined
      ? null
      : region.querySelector<HTMLElement>(target.fallback));
  if (heading === null) {
    // The fallback follows the same scroll rule as the heading it replaces: a
    // Load_Entry (scroll false) must not scroll the page to the field.
    focusStageDefault(region, { preventScroll: !target.scroll });
    return undefined;
  }
  if (!heading.hasAttribute("tabindex")) heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
  if (!target.scroll) return undefined;
  const reduced =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  heading.scrollIntoView({
    block: "start",
    behavior: mode === "full" && !reduced ? "smooth" : "auto",
  });
  const timer = setTimeout(() => {
    if (!heading.isConnected) return;
    const topBar = document.querySelector<HTMLElement>("[data-topbar]");
    const topBarBottom = topBar === null ? 0 : topBar.getBoundingClientRect().bottom;
    const top = heading.getBoundingClientRect().top;
    if (top < topBarBottom || top >= window.innerHeight) {
      heading.scrollIntoView({ block: "start", behavior: "auto" });
    }
  }, FOCUS_SCROLL_CHECK_MS);
  return () => clearTimeout(timer);
}`;

describe("script-focused heading outline (#576)", () => {
  it.each([
    ["ceremony.module.css", ceremonyCss],
    ["recall/RecallReader.module.css", recallCss],
  ])("%s removes the outline on each heading selector", (_name, css) => {
    for (const selector of HEADING_SELECTORS) {
      expect(hasOutlineNoneRule(css, selector), selector).toBe(true);
    }
  });

  it("ceremony.module.css keeps the desk and paper keyboard focus rings", () => {
    const selectors = parseRules(ceremonyCss).flatMap((rule) => rule.selectors);
    expect(selectors).toContain(".desk :focus-visible");
    expect(selectors).toContain(".onPaper :focus-visible");
  });

  it("focusHeading in CeremonyRoot.tsx is unchanged", () => {
    const start = rootSource.indexOf("function focusHeading(");
    expect(start).toBeGreaterThanOrEqual(0);
    const end = rootSource.indexOf("\n}\n", start) + 2;
    expect(rootSource.slice(start, end)).toBe(FOCUS_HEADING_BODY);
  });
});
