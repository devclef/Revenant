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
  {
    file: "desk/DeskScene.module.css",
    value: "1800ms",
    reason: "Spec 05 desk stage, retired in spec 07 task 8.",
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
