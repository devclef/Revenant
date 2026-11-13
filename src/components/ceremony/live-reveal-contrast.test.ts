// Feature: 12 (spec X1 "Full-width dark reveal styles, Fingerprint grid and the
// contrast test")
//
// WCAG 2.2 AA contrast for every text class the live reveal draws with. The
// test renders the live Reveal at stage 1 (marks), stage 2 (letter) and stage
// 3 (figures, then the close), reads the class names out of that markup, and
// maps each one back to the CSS rule that declares its colour. Colours are
// resolved to hex from the token files (scene/tokens.css and app/globals.css),
// so the test follows the real values, not a copy of them.
//
// Each rendered class must be classified in SURFACE below as text on the desk
// (--bg), text on paper, or not text. A class that appears in the markup but is
// not classified fails, so a new text class cannot skip the check. A class with
// no declared colour inherits its surface's text colour: --text on the desk and
// --ink on paper. The paper panels set --ink themselves (reveal.module.css,
// LetterBlock.module.css), so that default matches the markup.
//
// Every ratio is computed here and printed. No ratio is written into a comment.
// The test does not judge a figure or the letter, only the colour pairs.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Reveal, type RevealProps } from "@/components/reveal/Reveal";
import type { Opened } from "@/components/reveal/opening-machine";
import type { RecallRecordV1 } from "@/lib/recall";
import type { FigureV1, PayloadV1 } from "@/lib/seal-format";
import { MotionProvider } from "@/components/ceremony/motion";
import { SkipProvider } from "@/components/ceremony/skip";
import { LiveRegionProvider } from "@/components/ceremony/LiveRegion";
import { LocalViewProvider } from "@/components/ceremony/local-view";
import revealStyles from "@/components/reveal/reveal.module.css";
import letterStyles from "@/components/ceremony/letter/LetterBlock.module.css";

const here = dirname(fileURLToPath(import.meta.url));
const TOKEN_FILES = [
  resolve(here, "scene", "tokens.css"),
  resolve(here, "..", "..", "app", "globals.css"),
];
const CSS_FILES = {
  reveal: resolve(here, "..", "reveal", "reveal.module.css"),
  letter: resolve(here, "letter", "LetterBlock.module.css"),
} as const;

const WCAG_AA_NORMAL = 4.5;

/** Where each rendered class's text sits. `none` marks a class with no text. */
type Surface = "desk" | "paper" | "accent" | "none";

/**
 * Every class the live reveal renders, by its CSS key, with the surface its
 * text sits on. Keys come from reveal.module.css and LetterBlock.module.css.
 */
const SURFACE: Record<string, Surface> = {
  // Desk: the stage chrome, the marks card, the caption, the testimony and the
  // figures column all sit on --bg (scene/tokens.css).
  reveal: "none",
  stage: "none",
  fade: "none",
  marksOnDesk: "desk",
  marks: "desk",
  marksHeading: "desk",
  marksAnswers: "desk",
  marksRow: "desk",
  marksQuestion: "desk",
  marksAnswer: "desk",
  marksBreak: "none",
  marksSound: "none",
  marksSoundNote: "desk",
  remembered: "desk",
  rememberedItem: "desk",
  rememberedQuestion: "desk",
  rememberedAnswer: "desk",
  letterFigures: "none",
  letterCol: "none",
  figuresCol: "desk",
  fig: "desk",
  figName: "desk",
  figRow: "desk",
  rowLabel: "desk",
  figValue: "desk",
  figAnswer: "desk",
  // Base paper ink, with desk overrides under DESK_SCOPES. Both are checked.
  period: "paper",
  region: "paper",
  formula: "desk",
  src: "desk",
  source: "desk",
  letter: "paper",
  paper: "paper",
  sheet: "none",
  letterBlock: "none",
  caption: "desk",
  lightShaft: "none",
  crease: "none",
  letterDisclosure: "desk",
  // The Reveal's own buttons carry their paper background (--paper-deep), so
  // their ink is checked on paper.
  button: "paper",
  // The judge's own answer chip is drawn on the orange Accent (--accent).
  marksValue: "accent",
  figureGroup: "desk",
  figuresThenNow: "desk",
  metaLine: "desk",
  stageControls: "desk",
  unit: "desk",
  valueLine: "desk",
  // Fingerprint and the seal verdict sit on the desk, below the paper.
  sealRow: "desk",
  fingerprint: "desk",
  fingerprintTitle: "desk",
  fingerprintGrid: "desk",
  fingerprintGroup: "desk",
  fingerprintGroups: "desk",
  fingerprintLine: "desk",
  fingerprintStatement: "desk",
  fingerprintLink: "desk",
  fingerprintDisclosure: "desk",
  sealVerdict: "desk",
  fixtureLabel: "paper",
  // Testimony: the heading, questions and answers sit on the desk.
  authorTestimony: "desk",
  authorTestimonyHeading: "desk",
  authorTestimonyItem: "desk",
  authorTestimonyQuestion: "desk",
  authorTestimonyLabel: "desk",
  authorTestimonyAnswer: "desk",
  yourAnswer: "desk",
  yourAnswerLabel: "desk",
  yourAnswerValue: "desk",
  answerList: "desk",
  answerItem: "desk",
  answerName: "desk",
  answerValue: "desk",
  answerTextItem: "desk",
  answerQuestion: "desk",
  answerLabel: "desk",
  answerText: "desk",
  answerClamped: "desk",
  answerToggle: "desk",
  answerTextItemLabel: "desk",
  testimony: "desk",
  // The sealed letter's own paper.
  sealedLetter: "paper",
  stagePanel: "paper",
};

/** Hex values declared for each token, across every token file. */
function readTokens(): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const file of TOKEN_FILES) {
    const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const match of css.matchAll(
      /(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\b/g,
    )) {
      const list = map.get(match[1]) ?? [];
      list.push(match[2].toLowerCase());
      map.set(match[1], list);
    }
  }
  return map;
}

/** sRGB hex -> relative luminance (WCAG 2.2). */
function luminance(hex: string): number {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255);
  const lin = (c: number) =>
    c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Resolve a CSS colour value (a token, a var() with fallback, or hex). */
function resolveColour(value: string, tokens: Map<string, string[]>): string[] {
  const v = value.trim();
  const hex = v.match(/^#[0-9a-fA-F]{6}$/);
  if (hex) return [v.toLowerCase()];
  const token = v.match(/^var\((--[a-z0-9-]+)(?:\s*,\s*(#[0-9a-fA-F]{6}))?\)$/);
  if (token === null) throw new Error(`unsupported colour value: ${v}`);
  const found = tokens.get(token[1]);
  if (found !== undefined) return found;
  if (token[2] !== undefined) return [token[2].toLowerCase()];
  throw new Error(`token ${token[1]} has no hex value`);
}

/** Ancestors that put their children on the desk (--bg), not on paper. */
const DESK_SCOPES = [
  ".figuresThenNow",
  ".fingerprint",
  ".sealRow",
  ".marksOnDesk",
  ".figuresCol",
  ".caption",
  ".authorTestimony",
];

type Context = "base" | "desk" | "stagePanel";

/**
 * The colour a class declares for its own element, in one context:
 *  - `base`: the rule is exactly `.key`, which applies wherever the class sits.
 *    Its surface is the one SURFACE gives the class.
 *  - `desk`: the rule is `.<DESK_SCOPES entry> .key`, a desk override.
 *  - `stagePanel`: the rule is `.stagePanel .key`, the paper panel's own ink.
 * Any other scoped rule is not read. The last matching declaration wins, which
 * is source order at equal specificity. Returns null when none is declared.
 */
function declaredColour(
  css: string,
  key: string,
  context: Context,
): string | null {
  const bare = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const matchesContext = (part: string): boolean => {
    const text = part.trim().replace(/\s+/g, " ");
    if (context === "base") return text === `.${key}`;
    if (context === "stagePanel") return text === `.stagePanel .${key}`;
    return DESK_SCOPES.some((scope) => text === `${scope} .${key}`);
  };
  let colour: string | null = null;
  for (const [, selector, body] of bare.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (!selector.split(",").some(matchesContext)) continue;
    for (const decl of body.matchAll(/(?<![-\w])color\s*:\s*([^;]+);/g)) {
      colour = decl[1].trim();
    }
  }
  return colour;
}

/** Class names the live reveal renders, mapped to their CSS module key. */
function renderedKeys(html: string): Map<string, Set<string>> {
  // CSS modules are hashed per file: `_key_<hash>`. The hash identifies the file.
  const suffixOf = (sample: string) =>
    sample.slice(sample.lastIndexOf("_") + 1);
  const revealHash = suffixOf(revealStyles.flowLive);
  const letterHash = suffixOf(letterStyles.letterBlock);
  const byFile = new Map<string, Set<string>>([
    ["reveal", new Set()],
    ["letter", new Set()],
  ]);
  const classes = new Set<string>();
  for (const match of html.matchAll(/class="([^"]+)"/g)) {
    for (const name of match[1].split(" ")) classes.add(name);
  }
  for (const name of classes) {
    const parsed = name.match(/^_(.+)_([0-9a-f]{6})$/);
    if (parsed === null) continue;
    const [, key, hash] = parsed;
    if (hash === revealHash) byFile.get("reveal")!.add(key);
    else if (hash === letterHash) byFile.get("letter")!.add(key);
  }
  return byFile;
}

/** The live reveal at one stage, rendered to static markup. */
function renderStage(stage: 1 | 2 | 3): string {
  const payload: PayloadV1 = {
    format_version: 1,
    letter_text: "A short letter for the contrast test.",
    metrics: [
      {
        id: "fuel",
        display_name: "Regular gasoline",
        unit: "USD per gallon",
        region: "U.S. city average",
        source: "U.S. EIA",
        series_id: "EMM_EPMR_PTE_NUS_DPG",
      },
    ],
    figures: [
      {
        kind: "official",
        metric_id: "fuel",
        value: "3.412",
        unit: "USD per gallon",
        region: "U.S. city average",
        period: "2024-10",
        source: "U.S. EIA",
        series_id: "EMM_EPMR_PTE_NUS_DPG",
        retrieved_at: "2024-10-02T12:00:00.000Z",
        source_url: "https://www.eia.gov/",
      } satisfies FigureV1,
    ],
    recall_questions: [
      {
        id: "q-fuel",
        answer_type: "number",
        text: "What do you think a gallon of regular gasoline cost then?",
        metric_id: "fuel",
      },
      {
        id: "q-note",
        answer_type: "text",
        text: "What were you spending most on then?",
      },
    ],
  };
  const opened: Opened = {
    letterId: "contrast-letter",
    header: {
      sealedAt: "2024-10-01T00:00:00.000Z",
      opensAt: "2024-11-05T00:00:00.000Z",
    },
    openingKey: {} as unknown as CryptoKey,
    envelopeHash:
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    payload,
  };
  const record: RecallRecordV1 = {
    version: 1,
    answers: [
      { question_id: "q-fuel", kind: "number", value: "2.50" },
      { question_id: "q-note", kind: "no_answer" },
    ],
  };
  const props: RevealProps = {
    opened,
    record,
    personaName: "Maya",
    letterId: "contrast-letter",
    stage,
    onAdvance: () => {},
    onShowAll: () => {},
    variant: "live",
  };
  return renderToStaticMarkup(
    createElement(
      MotionProvider,
      null,
      createElement(
        SkipProvider,
        null,
        createElement(
          LiveRegionProvider,
          null,
          createElement(LocalViewProvider, null, createElement(Reveal, props)),
        ),
      ),
    ),
  );
}

describe("live reveal: AA contrast on the desk and paper surfaces", () => {
  const tokens = readTokens();
  const cssText: Record<keyof typeof CSS_FILES, string> = {
    reveal: readFileSync(CSS_FILES.reveal, "utf8"),
    letter: readFileSync(CSS_FILES.letter, "utf8"),
  };

  // Every stage's markup, read once. Stage 3 covers the figures and the close.
  const markup = [1, 2, 3].map((stage) => renderStage(stage as 1 | 2 | 3));

  it("renders marks, letter, figures and close", () => {
    expect(markup[0]).toContain('data-card="marks"');
    expect(markup[1]).toContain("A short letter for the contrast test.");
    expect(markup[2]).toContain("3.412");
  });

  it("classifies every rendered text class in the live reveal", () => {
    const seen = new Map<string, Set<string>>();
    for (const html of markup) {
      for (const [file, keys] of renderedKeys(html)) {
        const into = seen.get(file) ?? new Set<string>();
        for (const key of keys) into.add(key);
        seen.set(file, into);
      }
    }
    const unclassified = [...(seen.get("reveal") ?? [])]
      .filter((key) => !(key in SURFACE))
      .sort();
    expect(unclassified, "add each new class to SURFACE").toEqual([]);
  });

  it("every text class meets 4.5:1 on its surface, and every ratio is printed", () => {
    const desk = tokens.get("--bg") ?? [];
    const paper = [
      ...(tokens.get("--paper") ?? []),
      ...(tokens.get("--paper-deep") ?? []),
    ];
    const inks = tokens.get("--ink") ?? [];
    const deskText = tokens.get("--text") ?? [];
    expect(desk.length).toBeGreaterThan(0);
    expect(paper.length).toBeGreaterThan(0);
    expect(inks.length).toBeGreaterThan(0);
    expect(deskText.length).toBeGreaterThan(0);

    const rendered = new Map<string, Set<string>>();
    for (const html of markup) {
      for (const [file, keys] of renderedKeys(html)) {
        const into = rendered.get(file) ?? new Set<string>();
        for (const key of keys) into.add(key);
        rendered.set(file, into);
      }
    }

    const failures: string[] = [];
    const lines: string[] = [];
    const check = (label: string, text: string, bg: string): void => {
      const value = ratio(text, bg);
      const ok = value >= WCAG_AA_NORMAL;
      const row = `${value.toFixed(2)}:1 ${ok ? "PASS" : "FAIL"} ${label} ${text} on ${bg}`;
      lines.push(row);
      if (!ok) failures.push(row);
    };
    const onPaper = [...paper];
    const bgFor: Record<Exclude<Surface, "none">, string[]> = {
      desk,
      paper: onPaper,
      accent: tokens.get("--accent") ?? [],
    };
    const defaultText: Record<Exclude<Surface, "none">, string[]> = {
      desk: deskText,
      paper: inks,
      accent: tokens.get("--on-accent") ?? [],
    };
    for (const [file, keys] of rendered) {
      const css = file === "reveal" ? cssText.reveal : cssText.letter;
      for (const key of [...keys].sort()) {
        const surface = SURFACE[key];
        if (surface === undefined || surface === "none") continue;
        // The base colour, on the surface the key is classified for.
        const base = declaredColour(css, key, "base");
        // `inherit` (or no declaration) takes the surface's default text colour.
        const inherits = base === null || base === "inherit";
        const texts = inherits
          ? defaultText[surface]
          : resolveColour(base, tokens);
        for (const text of texts) {
          for (const bg of bgFor[surface]) {
            check(
              `${surface} ${key} ${inherits ? "(inherits)" : base}`,
              text,
              bg,
            );
          }
        }
        // A desk override (for example `.figuresThenNow .period`) is the same
        // class on the desk. A `.stagePanel .key` rule is it on paper.
        const overrides: Array<[Context, string[]]> = [
          ["desk", desk],
          ["stagePanel", onPaper],
        ];
        for (const [context, bgs] of overrides) {
          const colour = declaredColour(css, key, context);
          if (colour === null) continue;
          for (const text of resolveColour(colour, tokens)) {
            for (const bg of bgs) {
              check(`${context} ${key} ${colour}`, text, bg);
            }
          }
        }
      }
    }
    console.log(
      `live reveal contrast (${lines.length} pairs, threshold ${WCAG_AA_NORMAL}:1)\n` +
        lines.join("\n"),
    );
    expect(failures).toEqual([]);
  });
});
