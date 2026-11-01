// Feature: 03-persona-demo, Property 20
//
// Property: a figure that ROSE and one that FELL render structurally identical
// ChangeLine markup. The only differences allowed are the numeric magnitude,
// the direction word (rose / fell) and the sign. Element tags and CSS classes
// are identical, there is no .rose / .fell variant, and there is no colour
// difference: up and down get the exact same visual treatment (neutrality.md).
//
// Validates R11.8, R16.4.
//
// Rendered with `renderToStaticMarkup` and `createElement` -- no DOM library
// and no JSX in the render path -- matching the existing reveal test style.
// fast-check drives it with numRuns 100 over a wide space of comparable figure
// pairs.
//
// The rise and the fall are exact mirrors: the same two periods, the same
// unit / region / source / series, and a now-value chosen so the fall is the
// rise reflected about the then-value. Because the two renders share both
// periods and all provenance, the ONLY text that legitimately differs between
// them is the direction word, the signed difference and the signed percent.
// The test normalises exactly those three display fragments out of each render
// (replacing them with a fixed token) and asserts the remaining markup -- every
// tag, every class, every static string -- is byte-for-byte equal.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { ChangeLine } from "./ChangeLine";
import {
  computeChange,
  formatChange,
  type ChangeResult,
} from "@/lib/figures";
import type { FigureV1 } from "@/lib/seal-format";

// A fixed base figure. Only `value` and `period` vary across a run; the unit,
// region, source and series stay constant so every generated pair is
// comparable and the rise/fall mirror shares all provenance.
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

// A then-period strictly before the now-period, so computeChange's
// no_newer_figure check passes for both the rise and its mirror.
const THEN_PERIOD = "2024-09";
const NOW_PERIOD = "2026-09";

function figure(value: string, period: string): Readonly<FigureV1> {
  return { ...BASE, value, period };
}

function comparable(
  result: ChangeResult,
): Extract<ChangeResult, { comparable: true }> {
  if (!result.comparable) {
    throw new Error(`test setup: figures must be comparable (${result.reason})`);
  }
  return result;
}

function renderChange(
  result: Extract<ChangeResult, { comparable: true }>,
  then: Readonly<FigureV1>,
  now: Readonly<FigureV1>,
): string {
  return renderToStaticMarkup(
    createElement(ChangeLine, { result, region: then.region, then, now }),
  );
}

// Replace every occurrence of a dynamic display fragment with a fixed token, so
// what remains is the direction-independent skeleton: tags, classes and the
// static copy (the period range connector and the formula line). Longest
// fragments are replaced first so a shorter one never eats part of a longer.
function normalise(html: string, display: ReturnType<typeof formatChange>): string {
  const fragments = [
    display.difference,
    display.percent ?? "",
    display.direction,
  ].filter((f) => f.length > 0);
  // Longest first: the signed difference/percent can contain the magnitude, and
  // we want them removed whole rather than partially.
  fragments.sort((a, b) => b.length - a.length);

  let out = html;
  for (const fragment of fragments) {
    out = out.split(fragment).join("§");
  }
  return out;
}

describe("Property 20: a rise and a fall render the same markup (R11.8, R16.4)", () => {
  it("renders structurally identical markup except for magnitude, direction word and sign", () => {
    fc.assert(
      fc.property(
        // The then value (non-zero so a percent is defined for both directions)
        // and the size of the move. Two or three fraction digits, bounded
        // magnitudes, built as decimal STRINGS so no binary float ever appears.
        fc.record({
          thenWhole: fc.integer({ min: 1, max: 9999 }),
          thenFrac: fc.integer({ min: 0, max: 999 }),
          deltaWhole: fc.integer({ min: 0, max: 4999 }),
          deltaFrac: fc.integer({ min: 1, max: 999 }),
        }),
        ({ thenWhole, thenFrac, deltaWhole, deltaFrac }) => {
          // Decimal strings at three fraction digits throughout.
          const thenValue = `${thenWhole}.${String(thenFrac).padStart(3, "0")}`;

          // now = then + delta for the rise; the fall is the exact mirror:
          // now = then - delta. Both keep three fraction digits via integer
          // arithmetic on the scaled values, so the two moves are equal in
          // magnitude and opposite in direction.
          const scale = 1000n;
          const thenScaled =
            BigInt(thenWhole) * scale + BigInt(thenFrac);
          const deltaScaled =
            BigInt(deltaWhole) * scale + BigInt(deltaFrac);
          const riseScaled = thenScaled + deltaScaled;
          const fallScaled = thenScaled - deltaScaled;

          // Keep the fall's now-value non-negative so both figures stay
          // well-formed everyday prices; skip the rare case where the move
          // would cross zero.
          fc.pre(fallScaled >= 0n);

          const toDecimal = (scaled: bigint): string => {
            const whole = scaled / scale;
            const frac = scaled % scale;
            return `${whole}.${String(frac).padStart(3, "0")}`;
          };
          const riseNowValue = toDecimal(riseScaled);
          const fallNowValue = toDecimal(fallScaled);

          // Rise: then -> higher now. Fall: same then -> lower now. Same two
          // periods in both so the rendered period text is identical.
          const thenFig = figure(thenValue, THEN_PERIOD);
          const riseNow = figure(riseNowValue, NOW_PERIOD);
          const fallNow = figure(fallNowValue, NOW_PERIOD);

          const riseResult = comparable(computeChange(thenFig, riseNow));
          const fallResult = comparable(computeChange(thenFig, fallNow));

          const riseDisplay = formatChange(riseResult, thenFig.region);
          const fallDisplay = formatChange(fallResult, thenFig.region);

          // Sanity: the two directions really are a rise and a fall.
          expect(riseDisplay.direction).toBe("rose");
          expect(fallDisplay.direction).toBe("fell");

          const riseHtml = renderChange(riseResult, thenFig, riseNow);
          const fallHtml = renderChange(fallResult, thenFig, fallNow);

          // No direction-named CSS class in either render: a `class="..."`
          // attribute never contains "rose" or "fell", so styling cannot be
          // keyed on direction (neutrality.md). (The direction WORD appears as
          // body text, which these patterns deliberately do not match, since
          // they look only inside a class attribute value.)
          for (const html of [riseHtml, fallHtml]) {
            for (const classAttr of html.match(/class="[^"]*"/g) ?? []) {
              expect(classAttr).not.toContain("rose");
              expect(classAttr).not.toContain("fell");
            }
          }

          // With the magnitude, direction word and sign normalised out, the
          // remaining markup -- every tag and every class -- is byte-identical.
          const riseSkeleton = normalise(riseHtml, riseDisplay);
          const fallSkeleton = normalise(fallHtml, fallDisplay);
          expect(riseSkeleton).toBe(fallSkeleton);
        },
      ),
      { numRuns: 100 },
    );
  });
});
