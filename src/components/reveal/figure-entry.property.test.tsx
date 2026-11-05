// Feature: 07-judge-journey, task 6 (issue #168): FigureEntry properties.
//
// Properties 2, 5, 8, 15 and 16 of spec 07 design.md, checked over generated
// figures and answers. Rendered with `renderToStaticMarkup` and `createElement`,
// no DOM library and no JSX. The rise and fall pairs share every provenance
// field, as in change-neutral.property.test.tsx.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { FigureEntry, type FigureEntryProps } from "./FigureEntry";
import { REVEAL_COPY } from "./copy";
import {
  computeChange,
  formatChange,
  formatPeriod,
  type ChangeResult,
} from "@/lib/figures";
import type { FigureV1 } from "@/lib/seal-format";

const BASE: Readonly<FigureV1> = {
  kind: "official",
  metric_id: "fuel",
  value: "0.000",
  unit: "USD per gallon",
  region: "U.S. city average",
  period: "2024-09",
  source: "U.S. EIA",
  series_id: "EMM_EPMR_PTE_NUS_DPG",
  retrieved_at: "2024-10-30T14:02:11Z",
  source_url: "https://www.eia.gov/series",
};

const THEN_PERIOD = "2024-09";
const NOW_PERIOD = "2026-09";

function figure(value: string, period: string): Readonly<FigureV1> {
  return { ...BASE, value, period };
}

function comparable(
  result: ChangeResult,
): Extract<ChangeResult, { comparable: true }> {
  if (!result.comparable) throw new Error(`test setup: not comparable (${result.reason})`);
  return result;
}

function renderEntry(
  then: Readonly<FigureV1>,
  now: Readonly<FigureV1>,
  markValue?: string,
): string {
  const props: FigureEntryProps = {
    name: "Regular gasoline",
    then,
    now,
    change: comparable(computeChange(then, now)),
    ...(markValue === undefined ? {} : { markValue }),
  };
  return renderToStaticMarkup(createElement(FigureEntry, props));
}

// React separates adjacent text nodes with comments; drop them for text checks.
const plain = (html: string): string => html.replace(/<!-- -->/g, "");

/** Decimal string with three fraction digits from a count of thousandths. */
function thousandths(scaled: number): string {
  return `${Math.floor(scaled / 1000)}.${String(scaled % 1000).padStart(3, "0")}`;
}

/** Every `--pos-*` value in document order. */
function positionsIn(html: string): number[] {
  return [...html.matchAll(/--pos-(?:then|now|mark):([^;"]+)/g)].map((m) =>
    Number(m[1]),
  );
}

/**
 * The direction-independent skeleton: positions become a token, numbers in text
 * become `#`, and the words rose and fell become `§`. Tags and classes remain.
 */
function skeletonOf(html: string): string {
  const withoutPositions = html.replace(/--pos-(then|now|mark):[^;"]+/g, "--pos-$1:§");
  return withoutPositions.replace(/>([^<]*)</g, (_match, text: string) => {
    const normalised = text
      .replace(/[+−-]?[0-9][0-9.,\u00a0\u202f]*/g, "#")
      .replace(/rose|fell/g, "§");
    return `>${normalised}<`;
  });
}

// --- Property 2 --------------------------------------------------------------

describe("Property 2: nothing depends on the distance between an answer and a figure (R14.3, R12.2)", () => {
  it("the figure items are identical whatever the answer is, apart from the answer line and the Mark", () => {
    fc.assert(
      fc.property(
        fc.record({
          thenScaled: fc.integer({ min: 1000, max: 9999999 }),
          deltaScaled: fc.integer({ min: 1, max: 4999000 }),
          answerScaled: fc.integer({ min: 0, max: 20000000 }),
        }),
        ({ thenScaled, deltaScaled, answerScaled }) => {
          const then = figure(thousandths(thenScaled), THEN_PERIOD);
          const now = figure(thousandths(thenScaled + deltaScaled), NOW_PERIOD);
          const answer = thousandths(answerScaled);

          // Strip the answer line, the Mark and its position: what remains must
          // be the same whichever answer the judge gave.
          const strip = (html: string): string =>
            plain(html)
              .replace(/<p class="[^"]*figAnswer[^"]*">[\s\S]*?<\/p>/, "")
              .replace(/<span class="[^"]*markLabel[^"]*"[^>]*>[\s\S]*?<\/span>/, "")
              .replace(/<span class="[^"]*markWrap[^"]*">[\s\S]*?<\/span><\/span>/, "")
              .replace(/--pos-mark:[^;"]+;?/, "")
              .replace(/;"/g, '"');

          const withAnswer = renderEntry(then, now, answer);
          const withoutAnswer = renderEntry(then, now, undefined);
          expect(strip(withAnswer)).toBe(strip(withoutAnswer));
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- Property 5 --------------------------------------------------------------

describe("Property 5: a rise and its mirror fall render the same markup (R14.12, R20.2)", () => {
  it("differs only in numbers, the direction word and the position values, with the Mark mirrored", () => {
    fc.assert(
      fc.property(
        fc.record({
          thenScaled: fc.integer({ min: 1000, max: 9999999 }),
          deltaScaled: fc.integer({ min: 1, max: 4999000 }),
          hasMark: fc.boolean(),
          markPermille: fc.integer({ min: 0, max: 1000 }),
        }),
        ({ thenScaled, deltaScaled, hasMark, markPermille }) => {
          fc.pre(thenScaled - deltaScaled >= 0);

          const then = figure(thousandths(thenScaled), THEN_PERIOD);
          const rise = figure(thousandths(thenScaled + deltaScaled), NOW_PERIOD);
          const fall = figure(thousandths(thenScaled - deltaScaled), NOW_PERIOD);

          // The Mark m lies in [0, 2t]; the fall reflects it to 2t - m.
          const markScaled = Math.floor((2 * thenScaled * markPermille) / 1000);
          const riseMark = hasMark ? thousandths(markScaled) : undefined;
          const fallMark = hasMark ? thousandths(2 * thenScaled - markScaled) : undefined;

          const riseHtml = renderEntry(then, rise, riseMark);
          const fallHtml = renderEntry(then, fall, fallMark);

          // No class token names a direction.
          for (const html of [riseHtml, fallHtml]) {
            for (const attr of html.match(/class="[^"]*"/g) ?? []) {
              expect(attr).not.toMatch(/rose|fell/);
            }
          }

          // Every position p on the rise is 1 - p on the fall.
          const risePositions = positionsIn(riseHtml);
          const fallPositions = positionsIn(fallHtml);
          expect(fallPositions).toHaveLength(risePositions.length);
          risePositions.forEach((p, i) => {
            expect(Math.abs(p + (fallPositions[i] ?? Number.NaN) - 1)).toBeLessThan(1e-9);
          });

          // With the numbers, direction word and positions normalised, the
          // markup is the same.
          expect(skeletonOf(riseHtml)).toBe(skeletonOf(fallHtml));
        },
      ),
      { numRuns: 100 },
    );
  }, 30000);
});

// --- Property 8 --------------------------------------------------------------

describe("Property 8: Accent is never on a figure, change or direction element (R3.9, R3.10, R3.12)", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const revealCss = readFileSync(resolve(here, "reveal.module.css"), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
  const figuresCss = readFileSync(
    resolve(here, "..", "ceremony", "figures", "figures.module.css"),
    "utf8",
  ).replace(/\/\*[\s\S]*?\*\//g, "");

  // Class names whose rule references --accent, --wax or any Accent-derived token.
  function accentClassNames(css: string): Set<string> {
    const names = new Set<string>();
    for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      if (!/--accent|--wax/.test(body)) continue;
      for (const selector of selectors.split(",")) {
        for (const name of selector.matchAll(/\.([a-zA-Z][\w-]*)/g)) {
          names.add(name[1] ?? "");
        }
      }
    }
    return names;
  }

  it("only the answer value and the Mark reference the Accent in the figure stylesheets", () => {
    const names = [...accentClassNames(revealCss), ...accentClassNames(figuresCss)];
    // marksValue is the marks stage's own answer chip (reveal.module.css), not
    // a figure element, so it is outside this figure check.
    // numberLine sets --figure-mark to the Accent; markStroke reads that
    // variable. Both belong to the Mark, not to a figure element.
    // The Accent names exactly one figure class: numberLine, which sets the
    // Mark's colour. The answer value is no longer Accent (spec 07 R14.12).
    const figureNames = names.filter((name) => name !== "marksValue");
    expect(new Set(figureNames)).toEqual(new Set(["numberLine"]));
  });

  it("the Accent appears in the markup only on the Mark", () => {
    fc.assert(
      fc.property(
        fc.record({
          thenScaled: fc.integer({ min: 1000, max: 9999999 }),
          deltaScaled: fc.integer({ min: 0, max: 4999000 }),
          answered: fc.boolean(),
        }),
        ({ thenScaled, deltaScaled, answered }) => {
          const then = figure(thousandths(thenScaled), THEN_PERIOD);
          const now = figure(thousandths(thenScaled + deltaScaled), NOW_PERIOD);
          const html = renderEntry(then, now, answered ? thousandths(thenScaled) : undefined);
          const accentHits = (html.match(/class="[^"]*markStroke[^"]*"/g) ?? []).length;
          expect(accentHits).toBe(answered ? 1 : 0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- Property 15 -------------------------------------------------------------

describe("Property 15: a Figure_Entry keeps the R14.3 item order (R14.3, R14.11)", () => {
  it("the nine items appear in order, and every figure number has its period in its item", () => {
    fc.assert(
      fc.property(
        fc.record({
          thenScaled: fc.integer({ min: 1000, max: 9999999 }),
          deltaScaled: fc.integer({ min: 0, max: 4999000 }),
          answered: fc.boolean(),
        }),
        ({ thenScaled, deltaScaled, answered }) => {
          const then = figure(thousandths(thenScaled), THEN_PERIOD);
          const now = figure(thousandths(thenScaled + deltaScaled), NOW_PERIOD);
          const html = plain(
            renderEntry(then, now, answered ? thousandths(thenScaled) : undefined),
          );
          const at = (needle: string): number => html.indexOf(needle);
          const order = [
            at("Regular gasoline · U.S. city average"),
            at(REVEAL_COPY.then),
            at('data-role="then"'),
            at(REVEAL_COPY.labelHistoricalRecord.replace("{date}", "30 October 2024")),
            at('data-role="now"'),
            at(answered ? "Your answer: " : REVEAL_COPY.yourAnswer),
            at(REVEAL_COPY.periodRange),
            at(REVEAL_COPY.formulaLabel),
            at(REVEAL_COPY.sourceSummary),
          ];
          for (const index of order) expect(index).toBeGreaterThan(-1);
          expect(order).toEqual([...order].sort((a, b) => a - b));

          // Each figure number shows its own period in the same item: the then
          // period on the meta line, the now period on the now line, and both on
          // the change line.
          expect(html).toContain(`<span>${formatPeriod(THEN_PERIOD, BASE.region)}</span>`);
          expect(html).toContain(formatPeriod(NOW_PERIOD, BASE.region));
          const change = computeChange(then, now);
          if (!change.comparable) throw new Error("test setup: comparable");
          expect(html).toContain(formatChange(change, then.region).thenPeriod);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- Property 16 -------------------------------------------------------------

describe("Property 16: the static render is the final state (R14.9)", () => {
  it("holds every value, label and the formula, with no start-state opacity", () => {
    fc.assert(
      fc.property(
        fc.record({
          thenScaled: fc.integer({ min: 1000, max: 9999999 }),
          deltaScaled: fc.integer({ min: 0, max: 4999000 }),
          answered: fc.boolean(),
        }),
        ({ thenScaled, deltaScaled, answered }) => {
          const then = figure(thousandths(thenScaled), THEN_PERIOD);
          const now = figure(thousandths(thenScaled + deltaScaled), NOW_PERIOD);
          const html = renderEntry(then, now, answered ? thousandths(thenScaled) : undefined);
          expect(plain(html)).toContain(`${REVEAL_COPY.formulaLabel}: `);
          expect(plain(html)).toContain("historical record, retrieved 30 October 2024");
          expect(plain(html)).toContain("retrieved 30 October 2024");
          expect(html).not.toMatch(/opacity|translateY/);
        },
      ),
      { numRuns: 100 },
    );
  });
});
