import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChangeLine } from "./ChangeLine";
import { displayChangeResult, rescaledChangeInputs } from "./change-display";
import { REVEAL_COPY } from "./copy";
import {
  computeChange,
  formatChange,
  type ChangeResult,
  type DisplayRescale,
} from "@/lib/figures";
import type { FigureV1 } from "@/lib/seal-format";

/**
 * Markup tests for the then-vs-now change line (design.md "Reveal", R12.9,
 * neutrality.md). Rendered with `renderToStaticMarkup` and `createElement`.
 *
 * The change line draws the `formatChange` display (direction word, signed
 * difference, percent when defined, and both periods). The formula is drawn by
 * FormulaLine, outside the Source details, and is tested in FormulaLine.test.tsx.
 * When either sealed input is a fixture, the "fixture data" label appears on
 * the change line too (R13.4).
 */

// Two comparable official figures from the same series: a rise.
const THEN: Readonly<FigureV1> = {
  kind: "official",
  metric_id: "fuel",
  value: "3.000",
  unit: "USD per gallon",
  region: "U.S. city average",
  period: "2024-09",
  source: "U.S. EIA",
  series_id: "EMM_EPMR_PTE_NUS_DPG",
  retrieved_at: "2024-10-30T14:02:11Z",
  source_url: "https://www.eia.gov/series",
};

const NOW: Readonly<FigureV1> = {
  ...THEN,
  value: "3.600",
  period: "2026-09",
  retrieved_at: "2026-10-30T14:02:11Z",
};

// A comparable change (now − then) from the two figures above.
function comparableResult(
  then: Readonly<FigureV1> = THEN,
  now: Readonly<FigureV1> = NOW,
): Extract<ChangeResult, { comparable: true }> {
  const result = computeChange(then, now);
  if (!result.comparable) {
    throw new Error("test setup: the two figures must be comparable");
  }
  return result;
}

function render(
  then: Readonly<FigureV1> = THEN,
  now: Readonly<FigureV1> = NOW,
): string {
  const changeText = formatChange(comparableResult(then, now), then.region);
  return renderToStaticMarkup(
    createElement(ChangeLine, { changeText, then, now }),
  );
}

describe("ChangeLine markup", () => {
  it("renders the formatChange display line (direction, difference, percent, periods)", () => {
    const display = formatChange(comparableResult(), THEN.region);
    const html = render();

    expect(html).toContain(display.direction);
    expect(html).toContain(display.difference);
    expect(display.percent).not.toBeNull();
    if (display.percent !== null) {
      expect(html).toContain(display.percent);
    }
    expect(html).toContain(display.thenPeriod);
    expect(html).toContain(display.nowPeriod);
    // The neutral connector between the two periods.
    expect(html).toContain(REVEAL_COPY.periodRange);
  });

  it("does not draw the formula; FormulaLine owns it (R4.2)", () => {
    const html = render();
    expect(html).not.toContain(REVEAL_COPY.formulaLabel);
    expect(html).not.toContain("data-formula=");
  });

  it("does not render the fixture-data label when neither input is a fixture", () => {
    expect(render()).not.toContain(REVEAL_COPY.labelFixtureData);
  });

  it("carries the fixture-data label when the then input is a fixture (R13.4)", () => {
    const fixtureThen: Readonly<FigureV1> = {
      ...THEN,
      source: "FIXTURE source",
      series_id: "FIXTURE-fuel",
    };
    const fixtureNow: Readonly<FigureV1> = {
      ...NOW,
      source: "FIXTURE source",
      series_id: "FIXTURE-fuel",
    };
    expect(render(fixtureThen, fixtureNow)).toContain(
      REVEAL_COPY.labelFixtureData,
    );
  });

  it("detects a fixture input through the series_id prefix, not just the source", () => {
    // A comparable pair shares source and series_id. This case fixes the
    // FIXTURE marker on the series_id only, so the series_id branch of
    // isFixtureFigure drives the label.
    const fixtureThen: Readonly<FigureV1> = { ...THEN, series_id: "FIXTURE-fuel" };
    const fixtureNow: Readonly<FigureV1> = { ...NOW, series_id: "FIXTURE-fuel" };
    expect(render(fixtureThen, fixtureNow)).toContain(
      REVEAL_COPY.labelFixtureData,
    );
  });
});

describe("ChangeLine fade marker (R3.1)", () => {
  it("marks the change line with data-change so the stage 3 Steps can fade it", () => {
    expect(render()).toMatch(/<div class="[^"]*change[^"]*" data-change="">/);
  });
});

describe("ChangeLine shows the rescaled inputs (C8.4)", () => {
  // Sealed per 1,000 litres: 1800.00 then, 1900.00 now. Shown per litre: 1.8
  // then, 1.9 now. The stored values are not changed by the display.
  const EU_THEN: Readonly<FigureV1> = {
    ...THEN,
    value: "1800.00",
    unit: "EUR per 1,000 litres",
    region: "European Union",
    period: "2024-05",
  };
  const EU_NOW: Readonly<FigureV1> = {
    ...EU_THEN,
    value: "1900.00",
    period: "2026-05",
  };

  const euRender = (): string => {
    const rescale: DisplayRescale = { divisor: 1000, unit: "EUR per litre" };
    const display = rescaledChangeInputs(
      EU_THEN.value,
      EU_NOW.value,
      rescale,
      EU_THEN.unit,
    );
    // The change is built from the rescaled inputs, as FigureEntry does.
    const shown = displayChangeResult(comparableResult(EU_THEN, EU_NOW), display);
    const changeText = formatChange(shown, EU_THEN.region, {
      differenceDigits: 2,
    });
    return renderToStaticMarkup(
      createElement(ChangeLine, {
        changeText,
        then: EU_THEN,
        now: EU_NOW,
        display,
      }),
    );
  };

  it("shows the difference from the rescaled inputs and keeps the percentage", () => {
    const html = euRender();
    // Per litre: 1.9 − 1.8 = +0.10 at two decimals. The sealed difference
    // would read +100.00.
    expect(html).toContain("+0.10");
    expect(html).not.toContain("+100.00");
    // The percentage is the same as the sealed change: 100 / 1800 = 5.6%.
    expect(html).toContain("+5.6%");
  });

  it("shows the rescale note on the change line", () => {
    const note = REVEAL_COPY.rescaledNote
      .replace("{toUnit}", "EUR per litre")
      .replace("{fromUnit}", "EUR per 1,000 litres");
    expect(euRender()).toContain(note);
  });

  it("shows no rescale note when no display inputs are passed", () => {
    expect(render()).not.toContain(REVEAL_COPY.rescaledNote.split("{")[0]);
  });
});
