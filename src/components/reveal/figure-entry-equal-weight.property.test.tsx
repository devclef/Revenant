// Feature: 07-judge-journey, figure entry equal weight (issue #189).
//
// Property 6 and Property 11 of spec 07 design.md, checked over generated
// figures and answers. Rendered with `renderToStaticMarkup` and `createElement`,
// no DOM library and no JSX, as in figure-entry.property.test.tsx. The fixed
// example tests in FigureEntry.test.tsx are not changed.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { FigureEntry, type FigureEntryProps } from "./FigureEntry";
import { REVEAL_COPY } from "./copy";
import { CEREMONY_COPY } from "@/components/ceremony/copy";
import { FIG_VALUE_SIZE } from "@/components/ceremony/constants";
import {
  computeChange,
  formatValue,
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
 * The value spans: class, inline style, data-role and text, in document order.
 * Attribute order follows FigureEntry's JSX: className, style, data-role.
 */
const VALUE_SPAN = /<span class="([^"]*)" style="([^"]*)" data-role="(then|now)">([^<]*)<\/span>/g;

/**
 * The markup with every text node, inline style and aria-label removed. What
 * remains is the element tree, its classes, attributes and data roles. Two
 * entries with equal structures differ only in their text, positions and
 * labels.
 */
function structureOf(html: string): string {
  return plain(html)
    .replace(/>([^<]*)</g, "><")
    .replace(/ style="[^"]*"/g, "")
    .replace(/ aria-label="[^"]*"/g, "");
}

/**
 * The text a sighted reader sees: tags and attributes removed, and the
 * screen-reader-only Mark text (the srOnly span) removed too. The Number_Line
 * root's aria-label is an attribute, so it is not counted either.
 */
function visibleTextOf(html: string): string {
  return plain(html)
    .replace(/<span class="[^"]*srOnly[^"]*">[\s\S]*?<\/span>/g, "")
    .replace(/<[^>]+>/g, " ");
}

function countOf(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

// --- Property 6 --------------------------------------------------------------

describe("Property 6: the then and now values have equal weight and no Accent (R14.12)", () => {
  it("the then and now value spans share one class list and style, with no Accent class", () => {
    fc.assert(
      fc.property(
        fc.record({
          thenScaled: fc.integer({ min: 1000, max: 9999999 }),
          deltaScaled: fc.integer({ min: 1, max: 4999000 }),
          hasMark: fc.boolean(),
          markPermille: fc.integer({ min: 0, max: 1000 }),
        }),
        ({ thenScaled, deltaScaled, hasMark, markPermille }) => {
          const then = figure(thousandths(thenScaled), THEN_PERIOD);
          const now = figure(thousandths(thenScaled + deltaScaled), NOW_PERIOD);
          const mark = hasMark
            ? thousandths(Math.floor((2 * thenScaled * markPermille) / 1000))
            : undefined;
          const html = renderEntry(then, now, mark);

          const spans = [...html.matchAll(VALUE_SPAN)];
          expect(spans.map((m) => m[3])).toEqual(["then", "now"]);

          const [thenSpan, nowSpan] = spans;
          if (thenSpan === undefined || nowSpan === undefined) {
            throw new Error("test setup: both value spans must be rendered");
          }

          // Same class list and the same inline style: nothing sets one value
          // apart from the other.
          expect(thenSpan[1]).toBe(nowSpan[1]);
          expect(thenSpan[2]).toBe(nowSpan[2]);
          expect(thenSpan[1]).toMatch(/figValue/);
          expect(thenSpan[2]).toContain(`font-size:${FIG_VALUE_SIZE}`);

          // No Accent, wax or direction token on either value.
          for (const span of [thenSpan, nowSpan]) {
            expect(span[1]).not.toMatch(/accent|wax|rose|fell/i);
          }

          // Each value is the figure's value as formatted for its region.
          expect(thenSpan[4]).toBe(formatValue(then.value, then.region));
          expect(nowSpan[4]).toBe(formatValue(now.value, now.region));
        },
      ),
      { numRuns: 100 },
    );
  });

  it("a rise and its mirror-image fall differ only in values, sign and position", () => {
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

          // Same element tree, classes and attributes; text, inline styles and
          // aria-labels are the only parts that may differ.
          expect(structureOf(fallHtml)).toBe(structureOf(riseHtml));

          // Every position p on the rise is 1 - p on the fall.
          const risePositions = positionsIn(riseHtml);
          const fallPositions = positionsIn(fallHtml);
          expect(fallPositions).toHaveLength(risePositions.length);
          risePositions.forEach((p, i) => {
            expect(Math.abs(p + (fallPositions[i] ?? Number.NaN) - 1)).toBeLessThan(1e-9);
          });

          // The value spans keep the same class list on both sides of the pair.
          const riseClasses = [...riseHtml.matchAll(VALUE_SPAN)].map((m) => m[1]);
          const fallClasses = [...fallHtml.matchAll(VALUE_SPAN)].map((m) => m[1]);
          expect(fallClasses).toEqual(riseClasses);
        },
      ),
      { numRuns: 100 },
    );
  }, 30000);
});

// --- Property 11 -------------------------------------------------------------

describe("Property 11: one visible Your answer per comparable entry, in R4.2 order (R14.3, R12.1)", () => {
  it("the visible text has Your answer exactly once, with the value or No answer, and the items keep their order", () => {
    fc.assert(
      fc.property(
        fc.record({
          thenScaled: fc.integer({ min: 1000, max: 9999999 }),
          deltaScaled: fc.integer({ min: 0, max: 4999000 }),
          answered: fc.boolean(),
          answerScaled: fc.integer({ min: 0, max: 20000000 }),
        }),
        ({ thenScaled, deltaScaled, answered, answerScaled }) => {
          const then = figure(thousandths(thenScaled), THEN_PERIOD);
          const now = figure(thousandths(thenScaled + deltaScaled), NOW_PERIOD);
          const answer = answered ? thousandths(answerScaled) : undefined;
          const html = renderEntry(then, now, answer);
          const visible = visibleTextOf(html);

          // "Your answer" is visible exactly once: it is the Number_Line label.
          expect(countOf(visible, CEREMONY_COPY.lineAnswer)).toBe(1);

          if (answer === undefined) {
            expect(countOf(visible, CEREMONY_COPY.lineNoAnswer)).toBe(1);
            expect(visible).not.toContain(`${answer} USD per gallon`);
          } else {
            expect(countOf(visible, CEREMONY_COPY.lineNoAnswer)).toBe(0);
            expect(visible).toContain(`${answer} USD per gallon`);
          }

          // R4.2 order: name and region, then row, now row, Number_Line, change
          // line, formula, source control.
          const plainHtml = plain(html);
          const at = (needle: string): number => {
            const index = plainHtml.indexOf(needle);
            expect(index, needle).toBeGreaterThan(-1);
            return index;
          };
          const order = [
            at("Regular gasoline · U.S. city average"),
            at(`${REVEAL_COPY.then}:`),
            at('data-role="then"'),
            at(`${REVEAL_COPY.now}:`),
            at('data-role="now"'),
            at('role="img"'),
            at('data-change=""'),
            at(REVEAL_COPY.formulaLabel),
            at(REVEAL_COPY.sourceSummary),
          ];
          expect(order).toEqual([...order].sort((a, b) => a - b));
        },
      ),
      { numRuns: 100 },
    );
  });

  it("a pair that is not comparable never takes the FigureEntry path", () => {
    // FiguresThenNow draws FigureEntry only for a comparable change; any other
    // pair takes the FigureLine branch, which has no Number_Line and so no
    // Your answer label. This checks that routing precondition over generated
    // pairs. It does not render FiguresThenNow itself, so the visible text of
    // those entries is not counted here.
    fc.assert(
      fc.property(
        fc.record({
          thenScaled: fc.integer({ min: 1000, max: 9999999 }),
          deltaScaled: fc.integer({ min: 0, max: 4999000 }),
          unitChanged: fc.boolean(),
          regionChanged: fc.boolean(),
        }),
        ({ thenScaled, deltaScaled, unitChanged, regionChanged }) => {
          fc.pre(unitChanged || regionChanged);

          const then = figure(thousandths(thenScaled), THEN_PERIOD);
          const now: Readonly<FigureV1> = {
            ...figure(thousandths(thenScaled + deltaScaled), NOW_PERIOD),
            unit: unitChanged ? "USD per litre" : BASE.unit,
            region: regionChanged ? "U.S. region other" : BASE.region,
          };

          expect(computeChange(then, now).comparable).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
