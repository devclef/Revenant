// Static-markup tests for FigurePicker (spec 06, Task 5; R13.1, R13.7, R19.1).
// Rendered with renderToStaticMarkup and createElement, as the reveal tests do.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PickableSeries } from "./catalogue-list";
import { LIVE_COPY } from "./copy";
import { FigurePicker } from "./FigurePicker";

const REAL: PickableSeries = {
  metricId: "us-gasoline-regular",
  displayName: "Regular gasoline",
  unit: "USD per gallon",
  region: "U.S.",
  latestPeriod: "2026-10-26",
  isFixture: false,
};

const FIXTURE: PickableSeries = {
  metricId: "fixture-us-diesel",
  displayName: "Diesel (fixture)",
  unit: "USD per gallon",
  region: "U.S.",
  latestPeriod: "2026-10-26",
  isFixture: true,
};

function render(
  series: readonly PickableSeries[],
  selected: readonly string[] = [],
  atLimit = false,
): string {
  return renderToStaticMarkup(
    createElement(FigurePicker, {
      series,
      selected,
      atLimit,
      onToggle: () => undefined,
    }),
  );
}

describe("FigurePicker", () => {
  it("shows the name, unit, region and latest period of each series", () => {
    const html = render([REAL]);

    expect(html).toContain("Regular gasoline");
    expect(html).toContain("USD per gallon");
    expect(html).toContain("U.S.");
    expect(html).toContain("Latest period: 2026-10-26");
  });

  it("shows no value for a series", () => {
    const html = render([REAL]);

    expect(html).not.toMatch(/\b3\.\d{2,}\b/);
    expect(html).not.toContain("value");
  });

  it("labels fixture series with fixture data and leaves real series unlabelled", () => {
    const real = render([REAL]);
    const fixture = render([FIXTURE]);

    expect(fixture).toContain(LIVE_COPY.fixtureLabel);
    expect(real).not.toContain(LIVE_COPY.fixtureLabel);
  });

  it("keeps the order it is given", () => {
    const html = render([REAL, FIXTURE]);

    expect(html.indexOf("Regular gasoline")).toBeLessThan(
      html.indexOf("Diesel (fixture)"),
    );
  });

  it("marks selected series as checked", () => {
    const html = render([REAL, FIXTURE], ["us-gasoline-regular"]);

    const checked = html.match(/checked=""/g) ?? [];
    expect(checked).toHaveLength(1);
  });

  it("disables unchecked boxes once the limit is reached", () => {
    const open = render([REAL, FIXTURE], [], false);
    const full = render([REAL, FIXTURE], [], true);

    expect(open).not.toContain("disabled");
    expect(full.match(/disabled=""/g)).toHaveLength(2);
  });

  it("keeps a selected box enabled even at the limit", () => {
    const html = render([REAL, FIXTURE], ["us-gasoline-regular"], true);

    expect(html.match(/disabled=""/g)).toHaveLength(1);
  });

  it("states the maximum as the smaller of 6 and the offered count", () => {
    const four = [REAL, FIXTURE, { ...REAL, metricId: "c" }, { ...REAL, metricId: "d" }];
    const ten = Array.from({ length: 10 }, (_, i) => ({ ...REAL, metricId: `m-${i}` }));

    expect(render(four)).toContain("Choose between 1 and 4.");
    expect(render(ten)).toContain("Choose between 1 and 6.");
  });

  it("has the legend and the singular hint when one figure can be sealed", () => {
    const html = render([REAL]);

    expect(html).toContain(LIVE_COPY.figuresLegend);
    expect(html).toContain(LIVE_COPY.figuresHintOne);
    expect(html).not.toContain("between 1 and");
  });

  it("shows the none message with a link to /demo and no list when nothing can be sealed", () => {
    const html = render([]);

    expect(html).toContain("No figure can be sealed right now.");
    expect(html).toContain('href="/demo"');
    expect(html).not.toContain("<ul");
    expect(html).not.toContain("between 1 and");
  });

  it("uses the singular too-many message when the limit is 1 and reached", () => {
    const html = render([REAL], ["us-gasoline-regular"], true);

    expect(html).toContain(LIVE_COPY.figuresTooManyOne);
  });

  it("shows a Fallback_Figure with its retrieved date and the Fallback_Note", () => {
    const fallback: PickableSeries = {
      ...REAL,
      metricId: "us-gasoline-fallback",
      latestPeriod: "2026-09-01",
      fallbackRetrievedAt: "2026-10-30T14:02:11Z",
    };
    const html = render([fallback]);

    expect(html).toContain("Period: 2026-09-01");
    expect(html).not.toContain("Latest period");
    expect(html).toContain(
      "Revenant hasn&#x27;t fetched a newer figure yet. This one was retrieved 30 October 2026.",
    );
  });

  it("shows no Fallback_Note for a figure that is not a fallback", () => {
    const html = render([REAL]);

    expect(html).toContain("Latest period: 2026-10-26");
    expect(html).not.toContain("hasn&#x27;t fetched");
  });
});
