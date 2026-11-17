import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { FiguresThenNow } from "./FiguresThenNow";
import { REVEAL_COPY } from "./copy";
import { samePeriodLine } from "./same-period";
import { DEMO_FIGURES } from "@/lib/figures/demo";
import { figuresStateFrom } from "./figures-stub";

// Every Now_Figure comes from a stubbed GET /api/figures built from DEMO_FIGURES.
const FIGURES = await figuresStateFrom(DEMO_FIGURES);
import { thenAndNow } from "@/lib/figures/then-now";
import { formatPeriod } from "@/lib/figures";
import { numberLineGeometry } from "@/components/ceremony/figures/number-line";
import type { Opened } from "./opening-machine";
import type { FigureV1, MetricDefinitionV1, PayloadV1 } from "@/lib/seal-format";

/**
 * Same_Figure cards on stage 3 (spec 12 Z2, spec 14 R7.1). A persona letter
 * whose then figure is the same record as the now figure (same period and
 * value) gets the Single_Figure_View: the figure once with its period, the
 * nothing-to-compare line, and no now row, Number_Line, change or formula.
 * A live or real letter gets the same-period card instead: both rows, the
 * Number_Line and the Same_Period_Line, with no change line, formula or
 * nothing-to-compare line (spec 14 R7.1).
 */

// The same mock as FiguresThenNow.test.tsx: the reveal reads the fixture
// through a mocked DEMO_FIGURES, never the real figure file.
vi.mock("@/lib/figures/demo", async () => {
  const { loadFigureFile } = await import("@/lib/figures/load");
  const { CATALOGUE } = await import("@/lib/figures/catalogue");
  const fixture = await import("@/lib/figures/demo/us-fuel.fixture.json");
  return { DEMO_FIGURES: loadFigureFile(fixture.default, CATALOGUE) };
});

const SEALED_AT = "2026-10-27T00:00:00.000Z";

// The latest now figure in the series, taken from the loaded catalogue.
const NOW_FIGURE: Readonly<FigureV1> = (() => {
  const { now } = thenAndNow(
    "fixture-us-gasoline-regular",
    "2026-10-27",
    DEMO_FIGURES,
  );
  if (!now.found) throw new Error("test setup: gasoline now must be found");
  return now.figure;
})();

// The then figure is the same figure: same value, period, series and unit.
const SAME_THEN: Readonly<FigureV1> = { ...NOW_FIGURE };

const METRIC: MetricDefinitionV1 = {
  id: "fixture-us-gasoline-regular",
  display_name: "Regular gasoline (live test)",
  unit: NOW_FIGURE.unit,
  region: NOW_FIGURE.region,
  source: NOW_FIGURE.source,
  series_id: NOW_FIGURE.series_id,
};

const PAYLOAD = {
  format_version: 1,
  letter_text: "A live letter.",
  metrics: [METRIC],
  figures: [SAME_THEN],
  recall_questions: [],
} as unknown as PayloadV1;

const OPENED: Opened = {
  letterId: "letter-live-2",
  header: { sealedAt: SEALED_AT, opensAt: "2026-11-05T00:00:00.000Z" },
  payload: PAYLOAD,
  openingKey: {} as unknown as CryptoKey,
  envelopeHash:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
};

function render(
  allowSamePeriod?: boolean,
  letterKind?: "persona" | "live" | "real",
): string {
  return renderToStaticMarkup(
    createElement(FiguresThenNow, {
      opened: OPENED,
      allowSamePeriod,
      letterKind,
      figures: FIGURES,
    }),
  );
}

describe("FiguresThenNow, persona same-figure single card (spec 12 Z2)", () => {
  it("shows the single card with the nothing-to-compare line and no change", () => {
    const html = render(true, "persona");
    expect(html).toContain("data-single-figure");
    expect(html).toContain(REVEAL_COPY.nothingToCompare);
    expect(html).not.toContain(REVEAL_COPY.formulaLabel);
    expect(html).not.toContain("unchanged");
    expect(html).not.toContain(REVEAL_COPY.notComparable);
  });

  it("shows the sealed figure once with its own period", () => {
    const html = render(true, "persona");
    expect(html).toContain(REVEAL_COPY.then);
    expect(html).not.toContain('data-receipt-row="now"');
    expect(html).toContain(formatPeriod(NOW_FIGURE.period, NOW_FIGURE.region));
  });

  it("with allowSamePeriod off the persona Same_Figure is still a single card", () => {
    // The single card depends on Same_Figure and the persona kind alone.
    const html = render(false, "persona");
    expect(html).toContain("data-single-figure");
    expect(html).toContain(REVEAL_COPY.nothingToCompare);
    expect(html).not.toContain(REVEAL_COPY.reason.no_newer_figure);
    expect(html).not.toContain(REVEAL_COPY.formulaLabel);
    expect(html).not.toContain("unchanged");
  });

  it("draws no Number_Line on the single card, and the pin geometry is centred", () => {
    const geometry = numberLineGeometry(SAME_THEN.value, NOW_FIGURE.value);
    expect(geometry.posThen).toBeCloseTo(0.5, 12);
    expect(geometry.posNow).toBeCloseTo(0.5, 12);

    // The single card has no Number_Line, so no pin custom properties render.
    const html = render(true, "persona");
    expect(/--pos-then:/.test(html)).toBe(false);
    expect(/--pos-now:/.test(html)).toBe(false);
  });
});

describe("FiguresThenNow, live and real same-period card (spec 14 R7.1)", () => {
  it("shows both rows, the Number_Line and the same-period line, with no single card", () => {
    const html = render(true, "live");
    expect(html).toContain("data-same-period");
    expect(html).toContain(samePeriodLine(SAME_THEN.period));
    expect(html).not.toContain("data-single-figure");
    expect(html).toContain('data-receipt-row="now"');
    expect(html).toContain("--pos-then:");
    expect(html).toContain("--pos-now:");
  });

  it("shows no change line, no formula and no nothingToCompare", () => {
    const html = render(true, "live");
    expect(html).not.toContain(REVEAL_COPY.nothingToCompare);
    expect(html).not.toContain(REVEAL_COPY.formulaLabel);
    expect(html).not.toContain("unchanged");
    expect(html).not.toContain(REVEAL_COPY.notComparable);
  });

  it("shows the sealed period in both rows and the source once in the source control", () => {
    const html = render(true, "live");
    const period = formatPeriod(SAME_THEN.period, SAME_THEN.region);
    // Both rows carry the same period: the then row and the now row.
    const thenRow = html.slice(html.indexOf('data-receipt-row="then"'));
    const nowRow = html.slice(html.indexOf('data-receipt-row="now"'));
    expect(thenRow).toContain(period);
    expect(nowRow).toContain(period);
    // The source and the series ID are shown in the source control.
    expect(html).toContain(NOW_FIGURE.source);
    expect(html).toContain(NOW_FIGURE.series_id);
  });

  it("keeps the same card with allowSamePeriod off for a real letter", () => {
    // Same_Figure on a real letter depends on the kind, not on allowSamePeriod.
    const html = render(false, "real");
    expect(html).toContain("data-same-period");
    expect(html).not.toContain("data-single-figure");
    expect(html).not.toContain(REVEAL_COPY.nothingToCompare);
  });
});
