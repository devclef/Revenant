import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ChangeLine } from "./ChangeLine";
import { REVEAL_COPY } from "./copy";
import {
  computeChange,
  formatChange,
  type ChangeResult,
} from "@/lib/figures";
import type { FigureV1 } from "@/lib/seal-format";

/**
 * Markup tests for the then-vs-now change line (design.md "Reveal", R12.9,
 * neutrality.md). Rendered with `renderToStaticMarkup` and `createElement`.
 *
 * The change line draws `{direction} {difference magnitude} · {percent
 * magnitude} · {then period} to {now period}`, with the unsigned magnitudes
 * from `formatChange`. The formula is drawn by FormulaLine, outside the Source
 * details, and is tested in FormulaLine.test.tsx. When either sealed input is
 * a fixture, the "fixture data" label appears on the change line too (R13.4).
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
  it("renders the direction, the unsigned difference, the percent and the periods", () => {
    const display = formatChange(comparableResult(), THEN.region);
    const html = render();

    expect(display.direction).toBe("rose");
    expect(html).toContain(`>${display.direction}<`);
    expect(html).toContain(`>${display.differenceMagnitude}<`);
    expect(display.percentMagnitude).not.toBeNull();
    if (display.percentMagnitude !== null) {
      expect(html).toContain(`>${display.percentMagnitude}<`);
    }
    expect(html).toContain(display.thenPeriod);
    expect(html).toContain(display.nowPeriod);
    // The neutral connector between the two periods.
    expect(html).toContain(REVEAL_COPY.periodRange);
  });

  it("prints the magnitudes with no sign (Property 3)", () => {
    const html = render();
    expect(html).not.toContain("+0.60");
    expect(html).not.toContain("+20.0%");
    expect(html).not.toContain("\u2212");
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

describe("ChangeLine markup is the same for a rise and a fall", () => {
  it("uses the same element and class for both directions", () => {
    const fell = render({ ...THEN, value: "3.600" }, { ...NOW, value: "3.000" });
    const rose = render();
    const classOf = (html: string): string =>
      /<div class="([^"]*)" data-change="">/.exec(html)?.[1] ?? "";
    expect(classOf(fell)).not.toBe("");
    expect(classOf(fell)).toBe(classOf(rose));
    expect(fell).toContain(">fell<");
  });
});

describe("ChangeLine rescaled figures (C8.4)", () => {
  // Sealed per 1,000 litres: 1800.00 then, 1900.00 now. The change line reads
  // the rescaled inputs passed to formatChange; the stored values are unchanged.
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

  it("shows the unsigned difference from the rescaled inputs and keeps the percentage", () => {
    const changeText = formatChange(
      comparableResult(EU_THEN, EU_NOW),
      EU_THEN.region,
      { differenceDigits: 2 },
    );
    const html = renderToStaticMarkup(
      createElement(ChangeLine, { changeText, then: EU_THEN, now: EU_NOW }),
    );
    // The sealed difference would read 100.00. Shown per litre, the change
    // line keeps the percentage from the sealed values: 100 / 1800 = 5.6%.
    expect(html).toContain(`>${changeText.differenceMagnitude}<`);
    expect(html).toContain("5.6%");
    expect(html).not.toContain("+5.6%");
  });

  it("does not print the rescale note on the change line (ReceiptCard prints it once)", () => {
    const changeText = formatChange(
      comparableResult(EU_THEN, EU_NOW),
      EU_THEN.region,
    );
    const html = renderToStaticMarkup(
      createElement(ChangeLine, { changeText, then: EU_THEN, now: EU_NOW }),
    );
    expect(html).not.toContain(REVEAL_COPY.rescaledNote.split("{")[0]);
  });
});

describe("ChangeLine for Maya's regular gasoline (8.1, 8.2)", () => {
  // Then 3.600, now 3.030 (USD per gallon, shown at fuel precision): a fall of
  // 0.57, which is 15.8% of 3.600.
  const MAYA_THEN: Readonly<FigureV1> = { ...THEN, value: "3.600", period: "2024-09" };
  const MAYA_NOW: Readonly<FigureV1> = {
    ...THEN,
    value: "3.030",
    period: "2024-11-04",
  };

  it("reads fell 0.57 · 15.8% · then period to 4 Nov 2024", () => {
    const changeText = formatChange(
      comparableResult(MAYA_THEN, MAYA_NOW),
      MAYA_THEN.region,
      { differenceDigits: 2 },
    );
    const html = renderToStaticMarkup(
      createElement(ChangeLine, { changeText, then: MAYA_THEN, now: MAYA_NOW }),
    );
    const text = html.replace(/<[^>]*>/g, "");
    expect(text).toBe("fell 0.57 · 15.8% · Sept 2024 to 4 Nov 2024");
  });
});
