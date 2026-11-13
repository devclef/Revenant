// Static-markup tests for FigurePicker (spec 06, Task 5; R13.1, R13.7, R19.1).
// Rendered with renderToStaticMarkup and createElement, as the reveal tests do.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ReceiptCard, type ReceiptCardProps } from "@/components/reveal/ReceiptCard";
import { receiptFigureOf, receiptSourceOf } from "@/components/reveal/FigureLine";
import type { FigureV1 } from "@/lib/seal-format";
import type { PickableSeries } from "./catalogue-list";
import { LIVE_COPY } from "./copy";
import { FigurePicker, type FigureDetail } from "./FigurePicker";
import fc from "fast-check";

/** Escapes the apostrophe the way renderToStaticMarkup writes it. */
function escapeHtml(text: string): string {
  return text.replace(/'/g, "&#x27;");
}

function countOf(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

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
    expect(html).toContain("Period: 26 Oct 2026");
    expect(html).not.toContain("2026-10-26");
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

  it("shows a Fallback_Figure with its period and a Short_Date retrieved row", () => {
    const fallback: PickableSeries = {
      ...REAL,
      metricId: "us-gasoline-fallback",
      latestPeriod: "2026-10-01",
      fallbackRetrievedAt: "2026-10-30T14:02:11Z",
    };
    const html = render([fallback]);

    expect(html).toContain("Period: 1 Oct 2026");
    expect(html).toContain("Retrieved 30 Oct 2026");
    expect(html).not.toContain("This one was retrieved");
  });

  it("shows no picker note and no retrieved row for a figure that is not a fallback", () => {
    const html = render([REAL]);

    expect(html).toContain("Period: 26 Oct 2026");
    expect(html).not.toContain("Retrieved ");
    expect(html).not.toContain(escapeHtml(LIVE_COPY.pickerNote));
  });
});

describe("FigurePicker value and source details", () => {
  const DETAIL = {
    value: "3.412",
    sourceName: "U.S. EIA",
    seriesId: "EMM_EPMR_PTE_NUS_DPG",
    sourceUrl: "https://www.eia.gov/series",
    retrievedAt: "2026-10-30T14:02:11Z",
    period: "2026-09",
    unit: "USD per gallon",
    region: "U.S. city average",
  };

  function renderWith(
    series: readonly PickableSeries[],
    details?: ReadonlyMap<string, typeof DETAIL>,
  ): string {
    return renderToStaticMarkup(
      createElement(FigurePicker, {
        series,
        selected: [],
        atLimit: false,
        onToggle: () => undefined,
        details,
      }),
    );
  }

  it("shows the value at display precision with its unit", () => {
    const html = renderWith([REAL], new Map([[REAL.metricId, DETAIL]]));

    expect(html).toContain("Value: 3.41 USD per gallon");
    expect(html).not.toContain("Value: 3.412");
  });

  it("shows the published value and unit as 'As published' in the source details", () => {
    const html = renderWith([REAL], new Map([[REAL.metricId, DETAIL]]));

    expect(html).toContain("As published: 3.412 USD per gallon");
  });

  it("shows the retrieved date as a Short_Date in the source details", () => {
    const html = renderWith([REAL], new Map([[REAL.metricId, DETAIL]]));

    expect(html).toContain("<dd>30 Oct 2026</dd>");
  });

  it("shows the source name beside the item and the details behind a control", () => {
    const html = renderWith([REAL], new Map([[REAL.metricId, DETAIL]]));

    expect(html).toContain("Source: U.S. EIA");
    expect(html).toContain("<details");
    expect(html).toContain(LIVE_COPY.figureSourceDetails);
    expect(html).toContain("EMM_EPMR_PTE_NUS_DPG");
    expect(html).toContain('href="https://www.eia.gov/series"');
  });

  it("invents no value for a series with no detail entry", () => {
    const html = renderWith([REAL], new Map());

    expect(html).not.toContain("Value:");
    expect(html).not.toContain("<details");
    expect(html).toContain("Regular gasoline");
  });

  it("keeps catalogue order when details are shown", () => {
    const html = renderWith(
      [REAL, FIXTURE],
      new Map([
        [REAL.metricId, DETAIL],
        [FIXTURE.metricId, { ...DETAIL, value: "1.000" }],
      ]),
    );

    expect(html.indexOf("Regular gasoline")).toBeLessThan(
      html.indexOf("Diesel (fixture)"),
    );
  });
});

// Property tests for spec 12 K3: the picker's value matches the Receipt_Card,
// no stored value changes, and the Picker_Note appears once or not at all.

const RECEIPT_UNITS = [
  { unit: "USD per gallon", region: "U.S. city average" },
  { unit: "EUR per 1,000 litres", region: "EU27, weighted average" },
] as const;

/** A decimal string with three fraction digits from a whole number of thousandths. */
function decimalOf(thousandths: number): string {
  return `${Math.floor(thousandths / 1000)}.${String(thousandths % 1000).padStart(3, "0")}`;
}

describe("FigurePicker property: picker value matches the Receipt_Card", () => {
  it("shows the same value and unit as the Receipt_Card for any published value", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 999_999_999_999 }),
        fc.constantFrom(...RECEIPT_UNITS),
        (thousandths, { unit, region }) => {
          const value = decimalOf(thousandths);
          const figure: FigureV1 = {
            kind: "official",
            metric_id: "us-gasoline-regular",
            value,
            unit,
            region,
            period: "2026-09",
            source: "U.S. EIA",
            series_id: "EMM_EPMR_PTE_NUS_DPG",
            retrieved_at: "2026-10-30T14:02:11Z",
            source_url: "https://www.eia.gov/series",
          };
          const detail: FigureDetail = {
            value,
            sourceName: "U.S. EIA",
            seriesId: "EMM_EPMR_PTE_NUS_DPG",
            sourceUrl: "https://www.eia.gov/series",
            retrievedAt: "2026-10-30T14:02:11Z",
            period: "2026-09",
            unit,
            region,
          };
          const picker = renderToStaticMarkup(
            createElement(FigurePicker, {
              series: [REAL],
              selected: [],
              atLimit: false,
              onToggle: () => undefined,
              details: new Map([[REAL.metricId, detail]]),
            }),
          );
          const props: ReceiptCardProps = {
            name: "Regular gasoline",
            region,
            unit,
            then: receiptFigureOf(figure, "then", "persona"),
            now: { message: null },
            source: receiptSourceOf(figure, "Regular gasoline"),
          };
          const receipt = renderToStaticMarkup(
            createElement(ReceiptCard, props),
          );

          const pickerValue = picker.match(/Value: ([^<]*)</)?.[1];
          const receiptValue = receipt.match(
            /data-role="then"[^>]*>([^<]*)</,
          )?.[1];
          expect(receiptValue).toBeTruthy();
          expect(pickerValue).toBe(`${receiptValue} ${props.then.unit}`);
        },
      ),
    );
  });
});

describe("FigurePicker property: no stored value changes", () => {
  it("leaves the FigureDetail exactly as given after rendering", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 999_999_999_999 }),
        fc.constantFrom(...RECEIPT_UNITS),
        (thousandths, { unit, region }) => {
          const detail: FigureDetail = {
            value: decimalOf(thousandths),
            sourceName: "U.S. EIA",
            seriesId: "EMM_EPMR_PTE_NUS_DPG",
            sourceUrl: "https://www.eia.gov/series",
            retrievedAt: "2026-10-30T14:02:11Z",
            period: "2026-09",
            unit,
            region,
          };
          const before = structuredClone(detail);
          const html = renderToStaticMarkup(
            createElement(FigurePicker, {
              series: [REAL],
              selected: [],
              atLimit: false,
              onToggle: () => undefined,
              details: new Map([[REAL.metricId, detail]]),
            }),
          );

          expect(detail).toEqual(before);
          expect(html).toContain(`As published: ${detail.value} ${unit}`);
        },
      ),
    );
  });
});

describe("FigurePicker property: Picker_Note appears once or not at all", () => {
  const NOTE = escapeHtml(LIVE_COPY.pickerNote);

  /** Fallback positions for `count` fallback figures out of 8: front, back and spread. */
  function positionSets(count: number): number[][] {
    const front = Array.from({ length: count }, (_, i) => i);
    const back = Array.from({ length: count }, (_, i) => 8 - count + i);
    const spread = Array.from({ length: count }, (_, i) =>
      Math.floor((i * 8) / Math.max(count, 1)),
    );
    return [front, back, spread];
  }

  const COUNTS = [0, 1, 4, 8] as const;

  for (const count of COUNTS) {
    for (const positions of positionSets(count)) {
      it(`shows the note exactly ${count > 0 ? "once" : "never"} with ${count} fallback figure(s) at ${positions.join(",") || "no positions"}`, () => {
        const series: PickableSeries[] = Array.from({ length: 8 }, (_, i) => ({
          ...REAL,
          metricId: `m-${i}`,
          displayName: `Figure ${i}`,
          fallbackRetrievedAt: positions.includes(i)
            ? "2026-10-30T14:02:11Z"
            : undefined,
        }));
        const html = render(series);

        expect(countOf(html, NOTE)).toBe(count > 0 ? 1 : 0);
        if (count > 0) {
          expect(html.indexOf(NOTE)).toBeLessThan(html.indexOf("<ul"));
          expect(countOf(html, "Retrieved 30 Oct 2026")).toBe(count);
        }
        expect(html).not.toContain("This one was retrieved");
      });
    }
  }
});
