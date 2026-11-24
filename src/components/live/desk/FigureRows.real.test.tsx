// Markup tests for the real-mode figure rows (spec 19: real figure rows and
// receipt card without demo links). Static render only, no DOM.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PickableSeries } from "../catalogue-list";
import { LIVE_COPY, REAL_COPY } from "../copy";

import { FigureRows, type FigureRowsProps } from "./FigureRows";
import { ReceiptPanel, type ReceiptPanelProps } from "./ReceiptPanel";

/** Reverts the HTML escaping of quotes and apostrophes, so copy matches as written. */
function decode(html: string): string {
  return html.replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
}

const US: PickableSeries = {
  metricId: "us-gas",
  displayName: "U.S. regular gasoline price",
  unit: "USD per gallon",
  region: "U.S. city average",
  latestPeriod: "2026-09",
  periodType: "monthly",
  source:
    "U.S. Energy Information Administration (EIA), Weekly Retail Gasoline and Diesel Prices",
  isFixture: false,
};

const figureRows = (overrides: Partial<FigureRowsProps> = {}) =>
  decode(
    renderToStaticMarkup(
      createElement(FigureRows, {
        series: [],
        selected: [],
        onToggle: () => {},
        ...overrides,
      }),
    ),
  );

const panel = (overrides: Partial<ReceiptPanelProps> = {}) =>
  decode(
    renderToStaticMarkup(
      createElement(ReceiptPanel, {
        series: [],
        selected: [],
        onToggleFigure: () => {},
        ownNumber: { name: "", value: "", unit: "", region: "", period: "" },
        sealingDay: "2026-11-18",
        touched: { touched: {}, attempted: false },
        onTouch: () => {},
        onOwnNumberChange: () => {},
        view: "public",
        onViewChange: () => {},
        ...overrides,
      }),
    ),
  );

describe("FigureRows with no figures to offer", () => {
  it("demo mode links to the demo persona letters", () => {
    const html = figureRows();
    expect(html).toContain('href="/demo"');
    expect(html).toContain(LIVE_COPY.figuresNoneLink);
  });

  it("real mode shows the plain no-figures line with no link", () => {
    const html = figureRows({ real: true });
    expect(html).toContain(REAL_COPY.figuresNoneAvailable);
    expect(html).not.toContain("<a");
    expect(html).not.toContain('href="/demo"');
    expect(html).not.toContain(LIVE_COPY.figuresNoneLink);
    expect(html).not.toContain("{link}");
  });

  it("the receipt card passes real mode through to the figure rows", () => {
    const html = panel({ real: true });
    expect(html).toContain(REAL_COPY.figuresNoneAvailable);
    expect(html).not.toContain('href="/demo"');
  });

  it("the receipt card keeps the demo link in demo mode", () => {
    expect(panel()).toContain('href="/demo"');
  });
});

describe("FigureRows real mode with figures on offer", () => {
  it("still renders the figure rows and no demo link", () => {
    const html = figureRows({ series: [US], real: true });
    expect(html).toContain("data-figure-row");
    expect(html).not.toContain('href="/demo"');
  });
});
