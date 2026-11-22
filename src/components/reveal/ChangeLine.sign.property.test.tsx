// Feature: 16-remember-first, Property 3: The change line carries no sign
//
// For any comparable pair, the change line prints the direction word and the
// unsigned difference and percent. It never prints "+" or U+2212, and a rise
// and a fall render with the same element and class (no colour by direction).
//
// Validates requirements 8.1, 8.2.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { computeChange, formatChange } from "@/lib/figures";
import type { FigureV1 } from "@/lib/seal-format";

import { ChangeLine } from "./ChangeLine";

const REGION = "U.S. city average";
const UNIT = "USD per gallon";

// Whole-cent values from $0.001 to $999.999, written with three decimals.
const unitsArb = fc.integer({ min: 1, max: 999_999 });

function textOf(n: number): string {
  const whole = Math.floor(n / 1000);
  const frac = String(n % 1000).padStart(3, "0");
  return `${whole}.${frac}`;
}

function figure(value: string, period: string): FigureV1 {
  return {
    kind: "official",
    metric_id: "us-gasoline-regular",
    value,
    unit: UNIT,
    region: REGION,
    period,
    source: "U.S. EIA",
    series_id: "EMM_EPMR_PTE_NUS_DPG",
    retrieved_at: "2026-10-30T14:02:11Z",
    source_url: "https://example.test/series",
  } as FigureV1;
}

function render(thenValue: string, nowValue: string): string {
  const then = figure(thenValue, "2024-09");
  const now = figure(nowValue, "2026-09");
  const result = computeChange(then, now);
  if (!result.comparable) throw new Error("test setup: pair must be comparable");
  const changeText = formatChange(result, REGION);
  return renderToStaticMarkup(
    createElement(ChangeLine, { changeText, then, now }),
  );
}

const visibleText = (html: string): string => html.replace(/<[^>]*>/g, "");

describe("Property 3: the change line carries no sign", () => {
  it("prints no + or minus sign for any pair, rise, fall or unchanged", () => {
    fc.assert(
      fc.property(unitsArb, unitsArb, (a, b) => {
        const text = visibleText(render(textOf(a), textOf(b)));
        expect(text).not.toMatch(/[+\u2212]/);
      }),
      { numRuns: 200 },
    );
  });

  it("uses the same element and class for a rise and the matching fall", () => {
    fc.assert(
      fc.property(unitsArb, unitsArb, (a, b) => {
        fc.pre(a < b);
        const rise = render(textOf(a), textOf(b));
        const fall = render(textOf(b), textOf(a));
        const classOf = (html: string): string =>
          /<div class="([^"]*)" data-change="">/.exec(html)?.[1] ?? "";
        expect(classOf(rise)).not.toBe("");
        expect(classOf(rise)).toBe(classOf(fall));
        expect(visibleText(rise)).toContain("rose");
        expect(visibleText(fall)).toContain("fell");
      }),
      { numRuns: 200 },
    );
  });
});
