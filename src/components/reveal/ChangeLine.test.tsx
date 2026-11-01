import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChangeLine } from "./ChangeLine";
import { REVEAL_COPY } from "./copy";
import {
  CHANGE_FORMULA_ID,
  computeChange,
  formatChange,
  type ChangeResult,
} from "@/lib/figures";
import type { FigureV1 } from "@/lib/seal-format";

/**
 * Markup tests for the then-vs-now change line (design.md "Reveal", R12.9,
 * neutrality.md). Rendered with `renderToStaticMarkup` and `createElement` — no
 * DOM library and no JSX, matching the existing reveal test style.
 *
 * A comparable change renders `formatChange`'s display (direction word, signed
 * difference, percent when defined, and both periods) followed by the formula
 * line built from {@link CHANGE_FORMULA_ID}. When either sealed input is a
 * fixture, the "fixture data" label appears on the change line too (R13.4).
 *
 * The result shown is produced by `computeChange` on two comparable official
 * figures, so the test checks the real shape the component receives rather than
 * a hand-built one.
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
function comparableResult(): Extract<ChangeResult, { comparable: true }> {
  const result = computeChange(THEN, NOW);
  if (!result.comparable) {
    throw new Error("test setup: the two figures must be comparable");
  }
  return result;
}

function render(
  result: Extract<ChangeResult, { comparable: true }>,
  then: Readonly<FigureV1>,
  now: Readonly<FigureV1>,
): string {
  return renderToStaticMarkup(
    createElement(ChangeLine, { result, region: then.region, then, now }),
  );
}

describe("ChangeLine markup", () => {
  it("renders the formatChange display line (direction, difference, percent, periods)", () => {
    const result = comparableResult();
    const display = formatChange(result, THEN.region);
    const html = render(result, THEN, NOW);

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

  it("renders a readable formula with its inputs, not the formula id", () => {
    const result = comparableResult();
    const html = render(result, THEN, NOW);
    expect(html).toContain(REVEAL_COPY.formulaLabel);
    // THEN 3.000, NOW 3.600: (now - then) / then x 100.
    expect(html).toContain("(3.600 - 3.000) / 3.000 x 100");
    // The identifier is kept in a data attribute only, never in visible text.
    expect(html).toContain(`data-formula="${CHANGE_FORMULA_ID}"`);
    const visibleText = html.replace(/<[^>]*>/g, "");
    expect(visibleText).not.toContain(CHANGE_FORMULA_ID);
  });

  it("shows the plain difference when the then value is zero (no percent)", () => {
    const zeroThen: Readonly<FigureV1> = { ...THEN, value: "0.000" };
    const result = computeChange(zeroThen, NOW);
    if (!result.comparable) throw new Error("test setup: must be comparable");
    const html = render(result, zeroThen, NOW);
    expect(html).toContain("3.600 - 0.000");
    expect(html).not.toContain(" / 0.000");
  });

  it("does not render the fixture-data label when neither input is a fixture", () => {
    const result = comparableResult();
    const html = render(result, THEN, NOW);
    expect(html).not.toContain(REVEAL_COPY.labelFixtureData);
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
    // The change itself is still computed from two comparable figures; the
    // fixture detection is independent of comparability.
    const result = computeChange(fixtureThen, fixtureNow);
    if (!result.comparable) {
      throw new Error("test setup: fixture figures must be comparable");
    }
    const html = render(result, fixtureThen, fixtureNow);
    expect(html).toContain(REVEAL_COPY.labelFixtureData);
  });

  it("detects a fixture input through the series_id prefix, not just the source (ChangeLine checks either input)", () => {
    // A comparable pair must share source and series_id, so a pair with a
    // fixture input has both inputs on that series. This case fixes the FIXTURE
    // marker on the series_id (with a real-looking source), so it asserts the
    // series_id branch of isFixtureFigure drives the label, not the source.
    const fixtureBySeriesThen: Readonly<FigureV1> = {
      ...THEN,
      series_id: "FIXTURE-fuel",
    };
    const fixtureBySeriesNow: Readonly<FigureV1> = {
      ...NOW,
      series_id: "FIXTURE-fuel",
    };
    const result = computeChange(fixtureBySeriesThen, fixtureBySeriesNow);
    if (!result.comparable) {
      throw new Error("test setup: figures must be comparable");
    }
    const html = render(result, fixtureBySeriesThen, fixtureBySeriesNow);
    expect(html).toContain(REVEAL_COPY.labelFixtureData);
  });
});
