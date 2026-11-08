// Feature: 07-judge-journey, R18.1
//
// Every CSS duration and easing in the ceremony's CSS modules equals a value in
// constants.ts, or is on the exemption list below with its reason. design.md
// "Constants": the CSS repeats the CSS-side values, and this test keeps the two
// from drifting apart.
//
// The check reads the CSS modules under src/components/ceremony/ (scene/ and
// envelope/ included) and collects every `<number>ms`, `<number>s` and
// `cubic-bezier(...)` literal. Each one must match a `_MS` constant (in ms) or an
// easing constant (whitespace ignored). Layout sizes in px and vh are not
// checked here: they are repeated in CSS with a name in the CSS, and the
// geometry tests cover them.
//
// Pure file read. No DOM.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import * as C from "./constants";

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Literals that are in the CSS today and have no constant, with the reason. A
 * new entry needs a reason. An entry is removed when the CSS stops using it.
 */
const EXEMPT: ReadonlyArray<{ file: string; value: string; reason: string }> = [
  {
    file: "ceremony.module.css",
    value: "150ms",
    reason:
      "Calm cut or fade cap, at most 150 ms (R19.2). A limit, not a constant; CALM_FADE_MS is 120.",
  },
  {
    file: "envelope/EnvelopeView.module.css",
    value: "150ms",
    reason: "Calm cut or fade cap, at most 150 ms (R19.2). A limit, not a constant.",
  },
  {
    file: "seal/SealBreak.module.css",
    value: "150ms",
    reason: "Calm cut or fade cap, at most 150 ms (R19.2). A limit, not a constant.",
  },
  {
    file: "seal/SealBreak.module.css",
    value: "0ms",
    reason: "No motion: the Calm state sets a zero duration.",
  },
];

/** Normalise an easing or duration literal for comparison. */
const norm = (value: string): string => value.replace(/\s+/g, "");

/** Every CSS module under `dir`, recursively, as absolute paths. */
function cssModules(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return cssModules(full);
    return name.endsWith(".module.css") ? [full] : [];
  });
}

/** Duration values, in ms, of every `_MS` constant. */
const CONSTANT_MS = new Set<string>(
  Object.entries(C)
    .filter(([name, value]) => name.endsWith("_MS") && typeof value === "number")
    .map(([, value]) => String(value)),
);

/** Easing values of every constant that names an easing or a timing function. */
const CONSTANT_EASINGS = new Set<string>(
  Object.entries(C)
    .filter(([, value]) => typeof value === "string")
    .map(([, value]) => norm(value as string))
    .filter((value) => value.startsWith("cubic-bezier(") || value === "linear"),
);

/** Each duration literal in a CSS file, as `<ms>ms`. */
function durations(css: string): string[] {
  const found: string[] = [];
  for (const m of css.matchAll(/(?<![\w.-])(\d+(?:\.\d+)?)(ms|s)\b/g)) {
    const amount = Number(m[1]);
    const ms = m[2] === "s" ? amount * 1000 : amount;
    found.push(`${ms}ms`);
  }
  return found;
}

/** Each cubic-bezier literal in a CSS file, whitespace removed. */
function easings(css: string): string[] {
  return [...css.matchAll(/cubic-bezier\([^)]*\)/g)].map((m) => norm(m[0]));
}

/** Strip CSS comments so a value named in prose is not checked. */
const stripComments = (css: string): string => css.replace(/\/\*[\s\S]*?\*\//g, "");

describe("CSS durations and easings equal their constants (R18.1)", () => {
  const files = cssModules(here);

  it("finds the ceremony CSS modules to check", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("gives every duration in the CSS a constant or an exemption with a reason", () => {
    for (const file of files) {
      const rel = relative(here, file).split("\\").join("/");
      const css = stripComments(readFileSync(file, "utf8"));
      for (const ms of durations(css)) {
        const numeric = ms.replace("ms", "");
        const exempt = EXEMPT.some((e) => e.file === rel && e.value === ms);
        expect(
          CONSTANT_MS.has(numeric) || exempt,
          `${rel} uses ${ms}, which is neither a _MS constant nor exempt (R18.1)`,
        ).toBe(true);
      }
    }
  });

  it("gives every cubic-bezier easing in the CSS a constant", () => {
    for (const file of files) {
      const rel = relative(here, file).split("\\").join("/");
      const css = stripComments(readFileSync(file, "utf8"));
      for (const easing of easings(css)) {
        expect(
          CONSTANT_EASINGS.has(easing),
          `${rel} uses easing ${easing}, which no easing constant has (R18.1)`,
        ).toBe(true);
      }
    }
  });

  it("names only files that exist in the exemption list", () => {
    for (const entry of EXEMPT) {
      expect(
        statSync(resolve(here, entry.file)).isFile(),
        `exemption ${entry.file} must exist`,
      ).toBe(true);
      expect(entry.reason.trim().length).toBeGreaterThan(0);
    }
  });

  it("gives each seal-break CSS fallback its constant (R18.1)", () => {
    const css = readFileSync(resolve(here, "seal/SealBreak.module.css"), "utf8");
    expect(css).toContain(`var(--seal-split-ms, ${C.SEAL_SPLIT_MS}ms)`);
    expect(css).toContain(`var(--flap-lift-ms, ${C.FLAP_LIFT_MS}ms)`);
    expect(css).toContain(`var(--letter-slide-ms, ${C.LETTER_SLIDE_MS}ms)`);
  });

  it("holds the new Emergence and Idle_Bob values at their design.md numbers", () => {
    expect(C.RISE_AT_MS).toBe(900);
    expect(C.RISE_MS).toBe(1500);
    expect(C.EASE_RISE).toBe("cubic-bezier(0.16, 0.84, 0.3, 1)");
    expect(C.BOB_PERIOD_MS).toBe(3600);
    expect(C.BOB_PX).toBe(3);
  });
});

// Spec 08 R3 (reveal layout). The CSS repeats these constants, and the width
// table below reproduces the design's measured Letter_Text widths from the
// same rules, so a change to either side fails here.
describe("reveal layout constants and CSS (spec 08, R3)", () => {
  const css = (rel: string) => stripComments(readFileSync(resolve(here, rel), "utf8"));
  const reveal = css("../reveal/reveal.module.css");
  const letterBlock = css("letter/LetterBlock.module.css");
  const scene = css("scene/scene.module.css");

  it("holds the R3 values at their design.md numbers", () => {
    expect(C.REVEAL_SIDE_BY_SIDE_PX).toBe(1200);
    expect(C.LETTER_TEXT_MAX_EM).toBe(34);
    expect(C.LETTER_NARROW_PX).toBe(600);
  });

  it("puts the letter beside the figures at REVEAL_SIDE_BY_SIDE_PX with the design's grid", () => {
    expect(reveal).toContain(`@media (min-width: ${C.REVEAL_SIDE_BY_SIDE_PX}px)`);
    expect(reveal).toContain("grid-template-columns: minmax(0, 1.4fr) minmax(20rem, 1fr);");
    expect(reveal).not.toContain("minmax(0, 1.05fr) minmax(0, 1fr)");
  });

  it("caps the Letter_Text at LETTER_TEXT_MAX_EM", () => {
    expect(reveal).toMatch(new RegExp(`\\.letter \\{[^}]*max-width: ${C.LETTER_TEXT_MAX_EM}em;`));
  });

  it("tightens the Letter_Block and paper below LETTER_NARROW_PX", () => {
    expect(letterBlock).toContain("@media (max-width: 599.98px)");
    expect(C.LETTER_NARROW_PX).toBe(600);
    expect(letterBlock).toMatch(/\.letterBlock \{\s*padding: 0\.5rem;/);
    expect(letterBlock).toMatch(/\.paper \{\s*--paper-pad: 0\.875rem;/);
  });

  it("lets the long series ID wrap inside the source details", () => {
    expect(reveal).toMatch(/\.source,\s*\.src \{\s*overflow-wrap: anywhere;/);
  });

  it("lifts the persona column cap once the Ghost has left", () => {
    expect(scene).toContain(
      '.personaColumn:has(> :is([data-ceremony="letter"], [data-ceremony="figures"], [data-ceremony="close"])) {',
    );
    expect(reveal).toContain(
      '.flowPersona:is([data-ceremony="letter"], [data-ceremony="figures"], [data-ceremony="close"]) {',
    );
  });
});

// Computed-width table (design.md, spec 08 R3.2 and R3.3). Pure arithmetic
// from the same CSS rules: the grid's fr split, the paddings as clamp() values
// at 16 px root, and the 34em cap at the 17 px letter size.
describe("Letter_Text computed widths (spec 08, R3.2, R3.3)", () => {
  const LETTER_PX = 17;
  const GAP_PX = 40; // 2.5rem
  const clamp = (lo: number, mid: number, hi: number) => Math.min(hi, Math.max(lo, mid));

  /** Side by side: the letter's share of the 1.4fr : 1fr split. */
  const letterColumnPx = (contentPx: number) => ((contentPx - GAP_PX) * 1.4) / 2.4;
  /** The figures column: the 1fr share. */
  const figuresColumnPx = (contentPx: number) => (contentPx - GAP_PX) / 2.4;

  /** Letter_Text width for a letter column at a viewport width. */
  function letterTextPx(columnPx: number, viewportPx: number): number {
    const narrow = viewportPx < C.LETTER_NARROW_PX;
    const blockPad = narrow ? 8 : clamp(14.4, viewportPx * 0.03, 38.4); // 0.5rem | clamp(0.9rem, 3vw, 2.4rem)
    const paperPad = narrow ? 14 : clamp(16, viewportPx * 0.03, 32); // 0.875rem | clamp(1rem, 3vw, 2rem)
    return Math.min(columnPx - 2 * blockPad - 2 * paperPad, C.LETTER_TEXT_MAX_EM * LETTER_PX);
  }

  it("derives the figures column from the 1.4fr : 1fr split (502.5 px at 1366 wide)", () => {
    expect(Math.abs(figuresColumnPx(1245.9) - 502.5)).toBeLessThan(0.1);
    expect(letterColumnPx(1245.9)).toBeGreaterThan(figuresColumnPx(1245.9));
  });

  it.each([
    { viewport: 1366, column: 703.5, text: 562.7, em: 33.1 },
    { viewport: 1280, column: 655.2, text: 514.4, em: 30.3 },
    { viewport: 1200, column: 611.3, text: 475.3, em: 28.0 },
  ])(
    "side by side at $viewport px: Letter_Text $text px, $em em, inside 28 to 40 em",
    ({ viewport, column, text, em }) => {
      expect(viewport).toBeGreaterThanOrEqual(C.REVEAL_SIDE_BY_SIDE_PX);
      const px = letterTextPx(column, viewport);
      expect(Math.abs(px - text)).toBeLessThan(0.1);
      expect(Math.abs(px / LETTER_PX - em)).toBeLessThan(0.1);
      expect(px / LETTER_PX).toBeGreaterThanOrEqual(28 - 0.05);
      expect(px / LETTER_PX).toBeLessThanOrEqual(40);
    },
  );

  it("caps stacked Letter_Text at 34 em on a wide stacked column (1000 px)", () => {
    expect(letterTextPx(1000, 1000)).toBe(C.LETTER_TEXT_MAX_EM * LETTER_PX);
  });

  it("keeps at least 280 px of Letter_Text at 360 px wide (stacked, 328 px column)", () => {
    // 328 px is the 360 px window less 16 px each side. The layout check
    // measures the real column; this test pins the formula.
    const px = letterTextPx(328, 360);
    expect(px).toBeGreaterThanOrEqual(280);
    expect(Math.abs(px - 284)).toBeLessThan(0.1);
  });
});

// Spec 08 R8 (Hero after the First_Step, narrow handed lift). The Hero sizes
// are evaluated from the same clamp() strings the CSS uses, at every 10 px from
// 320 to 2560 (R8.1). The "before" sizes are the stages' own rules in CSS.
describe("Hero after the First_Step and the narrow handed lift (spec 08, R8)", () => {
  const css = (rel: string) => stripComments(readFileSync(resolve(here, rel), "utf8"));
  const scene = css("scene/scene.module.css");

  /** Evaluates a clamp(min, preferred, max) with rem = 16 px and vw = the viewport width. */
  function clampPx(expr: string, viewportPx: number): number {
    const m = expr.match(/^clamp\((.+)\)$/);
    if (m === null) throw new Error(`not a clamp(): ${expr}`);
    const terms = m[1].split(",").map((t) => t.trim());
    const toPx = (term: string): number => {
      const n = parseFloat(term);
      if (term.endsWith("rem")) return n * 16;
      if (term.endsWith("vw")) return (n / 100) * viewportPx;
      if (term.endsWith("px")) return n;
      throw new Error(`unit not handled: ${term}`);
    };
    const [lo, mid, hi] = terms.map(toPx);
    return Math.min(hi, Math.max(lo, mid));
  }

  it("holds the R8 values at their design.md numbers", () => {
    expect(C.HERO_SETTLE_MS).toBe(240);
    expect(C.HERO_SETTLE_MS).toBeLessThanOrEqual(400);
    expect(C.HERO_AFTER_WIDE).toBe("clamp(1.75rem, 2.6vw, 2.25rem)");
    expect(C.HERO_AFTER_NARROW).toBe("clamp(1.375rem, 5vw, 1.75rem)");
    expect(C.NARROW_HANDED_LIFT_VH).toBe(18);
  });

  it("puts the after-size constants in the scene CSS", () => {
    expect(scene).toContain(`font-size: ${C.HERO_AFTER_WIDE};`);
    expect(scene).toContain(`font-size: ${C.HERO_AFTER_NARROW};`);
  });

  it("gates heroSettle behind full motion and runs it for HERO_SETTLE_MS", () => {
    expect(scene).toContain(`animation: heroSettle ${C.HERO_SETTLE_MS}ms ease-out;`);
    expect(scene).toMatch(
      /@media \(prefers-reduced-motion: no-preference\) \{\s*\[data-ceremony-motion="full"\] \.personaColumn:has\(>[^{]*\.headline \{\s*animation: heroSettle/,
    );
  });

  it("applies the narrow handed lift at NARROW_HANDED_LIFT_VH below 900 px only", () => {
    expect(scene).toContain("@media (max-width: 899.98px)");
    expect(scene).toContain(`transform: translateY(-${C.NARROW_HANDED_LIFT_VH}vh);`);
    expect(scene).toContain(`- 6rem - ${C.NARROW_HANDED_LIFT_VH}vh);`);
  });

  it("keeps the Hero after-size strictly smaller than the before-sizes at every 10 px from 600 to 2560 (R8.1)", () => {
    // The before-sizes are the rules the stages use in CSS. Narrow stages share
    // the base rule; wide stages use the base wide rule (spec 10 C1.3 removed
    // the intact Stage's own wide headline rule).
    // Below 600 px the Hero is hidden after the First_Step (spec 09 P4.2), so the
    // size check starts at PHONE_BELOW_PX; the phone hide rule is tested below.
    expect(scene).toContain("font-size: clamp(2rem, 6.6vw, 3rem);");
    expect(scene).toContain("font-size: clamp(2.35rem, 6vw, 5.4rem);");

    for (let w = C.PHONE_BELOW_PX; w <= 2560; w += 10) {
      const narrow = w < C.SCENE_BREAKPOINT_PX;
      const after = narrow ? clampPx(C.HERO_AFTER_NARROW, w) : clampPx(C.HERO_AFTER_WIDE, w);
      const before = narrow
        ? [clampPx("clamp(2rem, 6.6vw, 3rem)", w)]
        : [clampPx("clamp(2.35rem, 6vw, 5.4rem)", w)];
      for (const b of before) {
        expect(after, `Hero after-size at ${w} px must be below ${b} px (R8.1)`).toBeLessThan(b);
      }
    }
  });

  it("hides the Hero visually, not with display none, below 600 px after the First_Step (spec 09 P4.2)", () => {
    const rules = [
      ...scene.matchAll(/\.personaColumn:has\(> :is\(\[data-ceremony="recall"\][^{]*\) \.headline \{([^}]*)\}/g),
    ].map((match) => match[1] ?? "");
    const phone = rules.find((rule) => rule.includes("clip-path")) ?? "";
    expect(phone).not.toBe("");
    expect(phone).toMatch(/clip-path: inset\(50%\)/);
    expect(phone).toMatch(/position: absolute/);
    expect(phone).not.toMatch(/display:\s*none/);
  });

  it("matches the design's worked sizes: 35.5 px after at 1366 px, 22 px at 360 px", () => {
    expect(Math.abs(clampPx(C.HERO_AFTER_WIDE, 1366) - 35.5)).toBeLessThan(0.1);
    expect(Math.abs(clampPx(C.HERO_AFTER_NARROW, 360) - 22)).toBeLessThan(0.1);
  });
});

// Spec 09 A8.3 (recall field stacks below 640 px). The media query in the recall
// CSS repeats RECALL_STACK_BELOW_PX, and the stacked rules sit inside it.
describe("recall field stacks below RECALL_STACK_BELOW_PX (spec 09, A8.3)", () => {
  const recallCss = stripComments(
    readFileSync(resolve(here, "recall/RecallPager.module.css"), "utf8"),
  );

  it("holds RECALL_STACK_BELOW_PX at 640", () => {
    expect(C.RECALL_STACK_BELOW_PX).toBe(640);
  });

  it("stacks the field and its control in a media query ending just below the constant", () => {
    // max-width 639.98px is the largest width below 640 px, so 640 px itself shares a row.
    expect(recallCss).toContain("@media (max-width: 639.98px) {");
    const block = recallCss.match(/@media \(max-width: 639\.98px\) \{([\s\S]*?)\n\}/)?.[1] ?? "";
    expect(block).toMatch(/\.answerRow \{[^}]*flex-direction:\s*column;/);
    expect(block).toMatch(/\.input \{[^}]*width:\s*100%;/);
    expect(block).toMatch(/\.cta \{[^}]*width:\s*100%;/);
  });

  it("lets the answer row wrap at and above the constant", () => {
    expect(recallCss).toMatch(/\.answerRow \{[^}]*flex-wrap:\s*wrap;/);
    expect(recallCss).not.toMatch(/\.answerRow \{[^}]*flex-wrap:\s*nowrap;/);
  });
});

describe("Number_Line tick gap (spec 10 X1.1)", () => {
  it("holds TICK_LABEL_GAP_PX at 4 px", () => {
    expect(C.TICK_LABEL_GAP_PX).toBe(4);
  });
});
