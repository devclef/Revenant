// Feature: 14-write-desk, Task 6 (W10, W11, W12, X1.2). Markup tests for the
// receipt card and its rows. Static render only, no DOM.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { shortNameFor } from "@/components/reveal/short-names";

import type { PickableSeries } from "../catalogue-list";
import type { FigureDetail } from "../FigurePicker";

import { DESK_COPY } from "./copy";
import { FigureRows, type FigureRowsProps } from "./FigureRows";
import { ReceiptPanel, type ReceiptPanelProps } from "./ReceiptPanel";

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

const EU: PickableSeries = {
  metricId: "eu-diesel",
  displayName: "EU diesel price",
  unit: "EUR per litre",
  region: "EU average",
  latestPeriod: "2026-11-09",
  periodType: "weekly",
  source: "European Commission, Weekly Oil Bulletin",
  isFixture: true,
};

const DETAIL: FigureDetail = {
  value: "3.412",
  sourceName: "U.S. EIA",
  seriesId: "EMM_EPMR_PTE_NUS_DPG",
  sourceUrl: "https://www.eia.gov/",
  retrievedAt: "2026-10-30T14:02:11Z",
  period: "2026-09",
  unit: "USD per gallon",
  region: "U.S. city average",
};

const figureRows = (overrides: Partial<FigureRowsProps> = {}) =>
  renderToStaticMarkup(
    createElement(FigureRows, {
      series: [US, EU],
      selected: [],
      onToggle: () => {},
      details: new Map([[US.metricId, DETAIL]]),
      ...overrides,
    }),
  );

const panel = (overrides: Partial<ReceiptPanelProps> = {}) =>
  renderToStaticMarkup(
    createElement(ReceiptPanel, {
      series: [US, EU],
      selected: [],
      onToggleFigure: () => {},
      ownNumber: { name: "", value: "", unit: "", region: "", period: "" },
      sealingDay: "2026-11-18",
      touched: { touched: {}, attempted: false },
      onTouch: () => {},
      onOwnNumberChange: () => {},
      ...overrides,
    }),
  );

/** React writes an apostrophe in text as &#x27;, so tests compare the escaped form. */
const escapeHtml = (text: string): string => text.replace(/'/g, "&#x27;");

/** The opening tag of the element that carries `attr`, for attribute checks. */
function openingTagWith(html: string, attr: string): string {
  const match = html.match(new RegExp(`<[^>]*${attr}[^>]*>`));
  if (match === null) throw new Error(`no element with ${attr}`);
  return match[0];
}

/** A set of series with more rows than the limit, for the blocked-row test. */
function sevenSeries(): PickableSeries[] {
  return Array.from({ length: 7 }, (_, i) => ({
    ...US,
    metricId: `m-${i}`,
    displayName: `Series ${i}`,
    isFixture: false,
  }));
}

describe("FigureRows (W11)", () => {
  it("lists the rows in catalogue order with no region headings", () => {
    const html = figureRows();

    expect(
      html.indexOf(shortNameFor(US.metricId, US.displayName)),
    ).toBeLessThan(html.indexOf(shortNameFor(EU.metricId, EU.displayName)));
    expect(html).not.toContain("<legend");
    expect(html).not.toContain("United States");
  });

  it("gives each row an aria-pressed button and a visible short unit", () => {
    const html = figureRows({ selected: [US.metricId] });

    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain('aria-pressed="false"');
    expect(html).toContain("3.41 USD/gal");
    expect(html).toContain("EUR/L");
  });

  it("shows a weekly period as a week and a monthly period as month and year", () => {
    const html = figureRows();

    expect(html).toContain("Sep 2026");
    expect(html).toContain("week of 9 Nov");
  });

  it("shows the Picker_Note once only when a row is a fallback", () => {
    const note = "hasn&#x27;t fetched newer figures";
    const none = figureRows();
    const fallback = figureRows({
      series: [{ ...US, fallbackRetrievedAt: "2026-10-30T14:02:11Z" }],
    });

    expect(none).not.toContain(note);
    expect(fallback.split(note).length - 1).toBe(1);
  });

  it("states the hint, the sources line, and a Details control that starts closed", () => {
    const html = figureRows();
    const details = openingTagWith(html, "data-figure-details");

    expect(html).toContain("Choose up to 2.");
    expect(html).toContain("Sources: U.S. EIA · EU Weekly Oil Bulletin.");
    expect(details).toContain('aria-expanded="false"');
    expect(html).toContain(DESK_COPY.details);
  });

  it("marks rows past the limit aria-disabled and leaves them unselected", () => {
    const series = sevenSeries();
    const selected = series.slice(0, 6).map((item) => item.metricId);
    const html = figureRows({ series, selected });
    const blocked = openingTagWith(html, 'aria-pressed="false"');

    expect(blocked).toContain('aria-disabled="true"');
    expect(html.match(/aria-disabled="true"/g)?.length).toBe(1);
  });
});

describe("ReceiptPanel (W10)", () => {
  it("names the card 'Tuck in a receipt' once as its heading, with no 'Receipts' heading", () => {
    const html = panel();

    expect(html).toMatch(/<h2[^>]*>Tuck in a receipt<\/h2>/);
    expect(html).not.toMatch(/>Receipts</);
    expect(html).not.toContain("Add a receipt");
  });

  it("shows 'A public price' as the first toggle and the active one", () => {
    const html = panel();

    expect(html.indexOf(DESK_COPY.togglePublic)).toBeLessThan(
      html.indexOf(DESK_COPY.toggleOwn),
    );
    expect(html).toMatch(
      new RegExp(`aria-pressed="true"[^>]*>${DESK_COPY.togglePublic}<`),
    );
  });

  it("mounts both views, with only the public view shown first", () => {
    const html = panel();

    expect(openingTagWith(html, 'data-receipt-view="public"')).not.toContain(
      "hidden",
    );
    expect(openingTagWith(html, 'data-receipt-view="own"')).toContain("hidden");
  });

  it("holds the own number fields inside the own view", () => {
    const html = panel();

    expect(html).toContain("data-own-number");
    expect(html).toContain(DESK_COPY.ownName);
    expect(html).toContain(escapeHtml(DESK_COPY.ownMarked));
  });

  it("shows the loading status instead of the rows while the figures load", () => {
    const html = panel({ figuresStatus: "loading" });

    expect(html).toContain('role="status"');
    expect(html).not.toContain("data-figure-row");
  });
});
