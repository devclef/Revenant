import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { FigureLine } from "./FigureLine";
import { REVEAL_COPY } from "./copy";
import { formatUtcDate } from "@/components/demo/dates";
import {
  formatValue,
  formatPeriod,
  rescaleForDisplay,
  type DisplayRescale,
} from "@/lib/figures";
import type { FigureV1 } from "@/lib/seal-format";

/**
 * Markup tests for a single sealed figure (design.md "Reveal", R11.1-R11.3,
 * R13.1-R13.6). Rendered with `renderToStaticMarkup` and `createElement` — no
 * DOM library and no JSX, matching the existing reveal test style.
 *
 * Property 19 (validates R11.1-R11.3, R13.1-R13.5): every rendered figure shows
 * its value, unit, period and region, and reaches its source through a
 * collapsed `<details>`/`<summary>` with (for an official figure) a link that
 * carries `rel="noreferrer noopener" target="_blank"`. The label depends only
 * on the figure and its role:
 *
 * - a fixture figure shows "fixture data" and never "historical record";
 * - a non-fixture "then" figure shows "historical record, retrieved {UTC date}";
 * - a non-fixture "now" figure shows "retrieved {UTC date}".
 *
 * A rescaled series shows the rescaled value and unit with the rescaled note,
 * while the stored value still appears in the source details unchanged.
 */

// A real (non-fixture) official figure for the "then" role.
const OFFICIAL_THEN: Readonly<FigureV1> = {
  kind: "official",
  metric_id: "fuel",
  value: "3.412",
  unit: "USD per gallon",
  region: "U.S. city average",
  period: "2024-10",
  source: "U.S. EIA",
  series_id: "EMM_EPMR_PTE_NUS_DPG",
  retrieved_at: "2024-10-30T14:02:11Z",
  source_url: "https://www.eia.gov/series",
};

// A real (non-fixture) official figure for the "now" role.
const OFFICIAL_NOW: Readonly<FigureV1> = {
  ...OFFICIAL_THEN,
  value: "3.850",
  period: "2026-09",
  retrieved_at: "2026-10-30T14:02:11Z",
};

// A fixture official figure (its source starts with FIXTURE).
const FIXTURE_FIGURE: Readonly<FigureV1> = {
  ...OFFICIAL_THEN,
  value: "4.000",
  source: "FIXTURE source",
  series_id: "FIXTURE-fuel",
};

// A self-reported figure: no source_url field, source is "self-reported".
const SELF_REPORTED: Readonly<FigureV1> = {
  kind: "self-reported",
  metric_id: "rent",
  value: "1800",
  unit: "SEK per month",
  region: "Sweden",
  period: "2024-10",
  source: "self-reported",
  series_id: "my-rent",
  retrieved_at: "2024-10-30T14:02:11Z",
};

// An EU rescale: value published per 1,000 litres, shown per litre.
const RESCALE: Readonly<DisplayRescale> = {
  divisor: 1000,
  unit: "EUR per litre",
};

const RESCALED_FIGURE: Readonly<FigureV1> = {
  kind: "official",
  metric_id: "fuel-eu",
  value: "1612.0",
  unit: "EUR per 1000 litres",
  region: "European Union",
  period: "2024-10",
  source: "European Commission",
  series_id: "WEEKLY_OIL_BULLETIN",
  retrieved_at: "2024-10-30T14:02:11Z",
  source_url: "https://energy.ec.europa.eu/series",
};

function render(
  figure: Readonly<FigureV1>,
  role: "then" | "now",
  displayRescale?: Readonly<DisplayRescale>,
): string {
  return renderToStaticMarkup(
    createElement(FigureLine, { figure, role, displayRescale }),
  );
}

describe("FigureLine markup", () => {
  it("shows value, unit, period and region for a figure (R11.1-R11.3)", () => {
    const html = render(OFFICIAL_THEN, "then");
    expect(html).toContain(
      formatValue(OFFICIAL_THEN.value, OFFICIAL_THEN.region),
    );
    expect(html).toContain(OFFICIAL_THEN.unit);
    expect(html).toContain(
      formatPeriod(OFFICIAL_THEN.period, OFFICIAL_THEN.region),
    );
    expect(html).toContain(OFFICIAL_THEN.region);
  });

  it("reaches the source through <details>/<summary> and a safe link (R11.2, R13.1)", () => {
    const html = render(OFFICIAL_THEN, "then");
    expect(html).toContain("<details");
    expect(html).toContain("<summary>");
    expect(html).toContain(REVEAL_COPY.sourceSummary);
    expect(html).toContain(OFFICIAL_THEN.source);
    expect(html).toContain(OFFICIAL_THEN.series_id);
    // The link to the source carries the safe rel/target and the source_url.
    expect(html).toContain(`href="${OFFICIAL_THEN.source_url}"`);
    expect(html).toContain('rel="noreferrer noopener"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain(REVEAL_COPY.checkAtSource);
  });

  it('shows "historical record, retrieved {UTC date}" for a non-fixture then figure (R13.2)', () => {
    const html = render(OFFICIAL_THEN, "then");
    const expected = REVEAL_COPY.labelHistoricalRecord.replace(
      "{date}",
      formatUtcDate(OFFICIAL_THEN.retrieved_at),
    );
    expect(html).toContain(expected);
    expect(html).toContain("30 October 2024");
    // The ISO date must never leak through as the short form.
    expect(html).not.toContain("2024-10-30");
  });

  it('shows "retrieved {date}" for a non-fixture now figure, not the historical-record label', () => {
    const html = render(OFFICIAL_NOW, "now");
    const expected = REVEAL_COPY.labelRetrieved.replace(
      "{date}",
      formatUtcDate(OFFICIAL_NOW.retrieved_at),
    );
    expect(html).toContain(expected);
    expect(html).toContain("30 October 2026");
    expect(html).not.toContain("2026-10-30");
    expect(html).not.toContain("historical record");
  });

  it("renders the same long-form retrieved date whatever the viewer timezone (R13.3)", () => {
    // retrieved_at is formatted UTC-pinned, so the day never shifts under an
    // extreme viewer timezone. Pacific/Kiritimati is UTC+14 and America/Adak is
    // UTC-10 — the widest offsets — so a non-UTC-pinned format would roll the
    // day over. process.env.TZ decides the host timezone for Intl.
    const original = process.env.TZ;
    try {
      for (const tz of ["UTC", "Pacific/Kiritimati", "America/Adak"]) {
        process.env.TZ = tz;
        const then = render(OFFICIAL_THEN, "then");
        expect(then).toContain("30 October 2024");
        expect(then).not.toContain("2024-10-30");
        const now = render(OFFICIAL_NOW, "now");
        expect(now).toContain("30 October 2026");
        expect(now).not.toContain("2026-10-30");
      }
    } finally {
      process.env.TZ = original;
    }
  });

  it("shows the fixture-data label and never the historical-record label for a fixture figure (R13.4)", () => {
    const html = render(FIXTURE_FIGURE, "then");
    expect(html).toContain(REVEAL_COPY.labelFixtureData);
    expect(html).not.toContain("historical record");
  });

  it("omits the source link for a self-reported figure (no source_url in the schema)", () => {
    const html = render(SELF_REPORTED, "then");
    // The details still open the source summary, but there is no link.
    expect(html).toContain("<details");
    expect(html).toContain(REVEAL_COPY.sourceSummary);
    expect(html).not.toContain(REVEAL_COPY.checkAtSource);
    expect(html).not.toContain("<a ");
  });

  it("shows the rescaled value and unit with the rescaled note (R11.10)", () => {
    const html = render(RESCALED_FIGURE, "then", RESCALE);
    const rescaledValue = formatValue(
      rescaleForDisplay(RESCALED_FIGURE.value, RESCALE.divisor),
      RESCALED_FIGURE.region,
    );
    expect(html).toContain(rescaledValue);
    expect(html).toContain(RESCALE.unit);
    const note = REVEAL_COPY.rescaledNote
      .replace("{toUnit}", RESCALE.unit)
      .replace("{fromUnit}", RESCALED_FIGURE.unit);
    expect(html).toContain(note);
    // The stored value is never changed: the source details carry the figure as
    // published.
    expect(html).toContain(RESCALED_FIGURE.source);
    expect(html).toContain(RESCALED_FIGURE.series_id);
  });

  it("omits the rescaled note when there is no display rescale", () => {
    const html = render(OFFICIAL_THEN, "then");
    expect(html).not.toContain("Published per");
  });

  it("Property 19: every rendered figure shows value, unit, period, region and reaches its source", () => {
    const figureArb = fc.record({
      value: fc
        .tuple(
          fc.integer({ min: 0, max: 99999 }),
          fc.integer({ min: 0, max: 999 }),
        )
        .map(([whole, frac]) => `${whole}.${String(frac).padStart(3, "0")}`),
      unit: fc.constantFrom(
        "USD per gallon",
        "EUR per litre",
        "SEK per month",
      ),
      region: fc.constantFrom(
        "U.S. city average",
        "European Union",
        "Sweden",
      ),
      period: fc.constantFrom("2024-10", "2024-01", "2025-12", "2024-10-26"),
      series_id: fc.constantFrom("REAL_SERIES", "FIXTURE-series"),
      source: fc.constantFrom("U.S. EIA", "FIXTURE source"),
      role: fc.constantFrom<"then" | "now">("then", "now"),
    });

    fc.assert(
      fc.property(figureArb, (f) => {
        const figure: Readonly<FigureV1> = {
          kind: "official",
          metric_id: "m",
          value: f.value,
          unit: f.unit,
          region: f.region,
          period: f.period,
          source: f.source,
          series_id: f.series_id,
          retrieved_at: "2024-10-30T14:02:11Z",
          source_url: "https://example.org/series",
        };
        const html = render(figure, f.role);

        // Value, unit, period and region all appear.
        expect(html).toContain(formatValue(f.value, f.region));
        expect(html).toContain(f.unit);
        expect(html).toContain(formatPeriod(f.period, f.region));
        expect(html).toContain(f.region);

        // The source is always reachable through the details/summary/link.
        expect(html).toContain("<details");
        expect(html).toContain("<summary>");
        expect(html).toContain('rel="noreferrer noopener"');
        expect(html).toContain('target="_blank"');
        expect(html).toContain('href="https://example.org/series"');
      }),
      { numRuns: 100 },
    );
  });
});
