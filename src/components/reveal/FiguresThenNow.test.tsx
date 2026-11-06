import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FiguresThenNow } from "./FiguresThenNow";
import { REVEAL_COPY } from "./copy";
import { DEMO_FIGURES } from "@/lib/figures/demo";
import { thenAndNow } from "@/lib/figures/then-now";
import {
  computeChange,
  formatChange,
  formatPeriod,
  formatValue,
  CHANGE_FORMULA_ID,
} from "@/lib/figures";
import type { Opened } from "./opening-machine";
import { figuresStateFrom, figuresResponseFrom, stubFiguresFetch } from "./figures-stub";
import { loadFigures, type FiguresState } from "./figures-api";
import type { FigureV1, MetricDefinitionV1, PayloadV1 } from "@/lib/seal-format";

/**
 * Markup tests for stage 3 of the reveal (design.md "Reveal", R6.x, R11-R13).
 * Rendered with `renderToStaticMarkup` and `createElement` — no DOM library and
 * no JSX in the render path — matching the existing reveal test style.
 *
 * `FiguresThenNow` shows, for each sealed figure in payload order:
 *
 * - the metric display name looked up from `payload.metrics` (never the live
 *   catalogue);
 * - the sealed "then" figure, straight from the payload;
 * - the "now" figure picked with `pickNow` from the Figures_API response,
 *   stubbed here as GET /api/figures built from DEMO_FIGURES (the same figure
 *   `thenAndNow` reported as now). A missing series shows `nowRetired`, a series with no figure shows `nowNotYet`,
 *   a failed request shows `nowUnavailableFetch`, and no change is drawn;
 * - a single neutral change line + formula when the two figures are comparable;
 * - both figures with their own periods plus the one neutral reason sentence
 *   when they are not (including `reason.unreadable_period`).
 *
 * `FixtureNote` appears exactly once, at the top of stage 3, when any shown
 * figure is a fixture (R13.5). The component reads no clock and makes no network
 * request: the test stubs `fetch` to throw, as Property 17 does, and asserts
 * nothing calls it.
 *
 * Fixtures use the two series that actually exist in `DEMO_FIGURES`
 * (`fixture-us-gasoline-regular`, `fixture-us-diesel`), so `thenAndNow` finds a
 * real frozen "now" figure, and a deliberately unknown series id to exercise the
 * missing-now branch. Every figure here is a FIXTURE figure, matching the demo.
 */

// The reveal tests read the fixture through a mocked DEMO_FIGURES, so they do
// not depend on the real figure file (spec 04, task 11). The factory loads the
// fixture against the real catalogue, as demo/index.ts does for the fixture half.
vi.mock("@/lib/figures/demo", async () => {
  const { loadFigureFile } = await import("@/lib/figures/load");
  const { CATALOGUE } = await import("@/lib/figures/catalogue");
  const fixture = await import("@/lib/figures/demo/us-fuel.fixture.json");
  return { DEMO_FIGURES: loadFigureFile(fixture.default, CATALOGUE) };
});

// --- fixtures ----------------------------------------------------------------

// The latest frozen "now" figures in DEMO_FIGURES, as thenAndNow returns them.
// Taken from the loaded catalogue so the test reads the same bytes the component
// does, never a hand-copied literal.
const GASOLINE_NOW = (() => {
  const { now } = thenAndNow(
    "fixture-us-gasoline-regular",
    "2026-10-27",
    DEMO_FIGURES,
  );
  if (!now.found) throw new Error("test setup: gasoline now must be found");
  return now.figure;
})();

const DIESEL_NOW = (() => {
  const { now } = thenAndNow("fixture-us-diesel", "2026-10-27", DEMO_FIGURES);
  if (!now.found) throw new Error("test setup: diesel now must be found");
  return now.figure;
})();

// Metric definitions, declared in the sealed payload so the display name is
// resolved from the letter, not the live catalogue.
const GASOLINE_METRIC: MetricDefinitionV1 = {
  id: "fixture-us-gasoline-regular",
  display_name: "Regular gasoline (fixture)",
  unit: "USD per gallon",
  region: "U.S.",
  source: GASOLINE_NOW.source,
  series_id: GASOLINE_NOW.series_id,
};

const DIESEL_METRIC: MetricDefinitionV1 = {
  id: "fixture-us-diesel",
  display_name: "No. 2 diesel (fixture)",
  unit: "USD per gallon",
  region: "U.S.",
  source: DIESEL_NOW.source,
  series_id: DIESEL_NOW.series_id,
};

// A metric whose series is NOT in DEMO_FIGURES, so thenAndNow reports
// unknown_series and no now figure exists.
const MISSING_METRIC: MetricDefinitionV1 = {
  id: "fixture-us-missing",
  display_name: "A discontinued fixture series",
  unit: "USD per gallon",
  region: "U.S.",
  source: "FIXTURE discontinued (fake data)",
  series_id: "FIXTURE-GONE",
};

// (1) Comparable "then": same unit/source/series as the now figure, an earlier
// period. computeChange against the now figure is comparable (a rise).
const GASOLINE_THEN: Readonly<FigureV1> = {
  kind: "official",
  metric_id: GASOLINE_METRIC.id,
  value: "1.00",
  unit: GASOLINE_NOW.unit,
  region: GASOLINE_NOW.region,
  period: "2023-11-06",
  source: GASOLINE_NOW.source,
  series_id: GASOLINE_NOW.series_id,
  retrieved_at: "2000-01-01T00:00:00Z",
  source_url:
    "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=EMM_EPMR_PTE_NUS_DPG&f=W",
};

// (2) Not comparable by UNIT: same source/series as its now figure but a
// different unit, so computeChange stops at the unit check.
const DIESEL_THEN_BAD_UNIT: Readonly<FigureV1> = {
  kind: "official",
  metric_id: DIESEL_METRIC.id,
  value: "10.00",
  unit: "USD per litre",
  region: DIESEL_NOW.region,
  period: "2023-11-06",
  source: DIESEL_NOW.source,
  series_id: DIESEL_NOW.series_id,
  retrieved_at: "2000-01-01T00:00:00Z",
  source_url:
    "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=EMD_EPD2D_PTE_NUS_DPG&f=W",
};

// (3) Missing now: the series is not in DEMO_FIGURES at all.
const MISSING_THEN: Readonly<FigureV1> = {
  kind: "official",
  metric_id: MISSING_METRIC.id,
  value: "2.00",
  unit: "USD per gallon",
  region: "U.S.",
  period: "2023-11-06",
  source: MISSING_METRIC.source,
  series_id: MISSING_METRIC.series_id,
  retrieved_at: "2000-01-01T00:00:00Z",
  source_url: "https://example.org/gone",
};

// (4) Not comparable by UNREADABLE PERIOD: a valid gasoline series figure whose
// period is not a real YYYY-MM or YYYY-MM-DD, so computeChange stops at the
// unreadable_period check (after unit/region pass, since both match the now
// figure).
const GASOLINE_THEN_BAD_PERIOD: Readonly<FigureV1> = {
  kind: "official",
  metric_id: GASOLINE_METRIC.id,
  value: "1.50",
  unit: GASOLINE_NOW.unit,
  region: GASOLINE_NOW.region,
  period: "that autumn",
  source: GASOLINE_NOW.source,
  series_id: GASOLINE_NOW.series_id,
  retrieved_at: "2000-01-01T00:00:00Z",
  source_url:
    "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=EMM_EPMR_PTE_NUS_DPG&f=W",
};

// Payload order is deliberate: comparable, unit-mismatch, missing, unreadable.
const PAYLOAD = {
  format_version: 1,
  letter_text: "A short sealed letter.",
  written_as_of: "2023-11-06",
  metrics: [GASOLINE_METRIC, DIESEL_METRIC, MISSING_METRIC],
  figures: [
    GASOLINE_THEN,
    DIESEL_THEN_BAD_UNIT,
    MISSING_THEN,
    GASOLINE_THEN_BAD_PERIOD,
  ],
  recall_questions: [
    {
      id: "q-fuel",
      answer_type: "number",
      text: "What do you think a gallon of regular gasoline cost then?",
      metric_id: GASOLINE_METRIC.id,
    },
  ],
} satisfies PayloadV1;

const OPENED: Opened = {
  letterId: "letter-1",
  header: {
    // "now" is always the latest figure; the sealed date only bounds "then".
    sealedAt: "2026-10-27T00:00:00.000Z",
    opensAt: "2026-11-05T00:00:00.000Z",
  },
  openingKey: {} as unknown as CryptoKey,
  envelopeHash:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  payload: PAYLOAD,
};

// The Figures_API state for every Now_Figure: GET /api/figures stubbed with a
// response built from the same DEMO_FIGURES the reveal reads for rescales.
const FIGURES: FiguresState = await figuresStateFrom(DEMO_FIGURES);

function render(
  opened: Opened = OPENED,
  figures: FiguresState = FIGURES,
): string {
  return renderToStaticMarkup(createElement(FiguresThenNow, { opened, figures }));
}

// Encode a copy string the way renderToStaticMarkup encodes a bare text child,
// so a sentence with an apostrophe (e.g. "can't") matches the entity-encoded
// markup (&#x27;). Mirrors the technique in SealedLetter.test.tsx.
function htmlText(text: string): string {
  const encoded = renderToStaticMarkup(createElement("span", null, text));
  return encoded.slice("<span>".length, -"</span>".length);
}

describe("FiguresThenNow markup", () => {
  beforeEach(() => {
    // No network of any kind in stage 3: the now data is a static import. A
    // guard fails the test if any render reaches for fetch (as Property 17 does).
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new Error("FiguresThenNow tried to fetch");
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the stage 3 heading", () => {
    expect(render()).toContain(REVEAL_COPY.stage3Title);
  });

  it("renders one entry per payload figure, in payload order, by display name", () => {
    const html = render();

    const iGasoline = html.indexOf(GASOLINE_METRIC.display_name);
    const iDiesel = html.indexOf(DIESEL_METRIC.display_name);
    const iMissing = html.indexOf(MISSING_METRIC.display_name);

    // Every metric name appears, each exactly once (the missing one is listed
    // once in payload.metrics; the two gasoline figures share one name).
    expect(iGasoline).toBeGreaterThanOrEqual(0);
    expect(iDiesel).toBeGreaterThanOrEqual(0);
    expect(iMissing).toBeGreaterThanOrEqual(0);

    // Order: gasoline (figure 0) before diesel (figure 1) before missing
    // (figure 2). The second gasoline figure (figure 3) reuses the gasoline
    // name, so first-occurrence order is gasoline < diesel < missing.
    expect(iGasoline).toBeLessThan(iDiesel);
    expect(iDiesel).toBeLessThan(iMissing);
  });

  it("sources the then figure only from the payload", () => {
    const html = render();
    // The sealed then value and its own period appear, straight from the payload.
    expect(html).toContain(formatValue(GASOLINE_THEN.value, GASOLINE_THEN.region));
    expect(html).toContain(formatPeriod(GASOLINE_THEN.period, GASOLINE_THEN.region));
  });

  it("sources the now figure from the Figures_API response (pickNow)", () => {
    const html = render();
    // The now value is the latest figure of the series in the response, not
    // anything from the payload.
    expect(html).toContain(formatValue(GASOLINE_NOW.value, GASOLINE_NOW.region));
    expect(html).toContain(formatPeriod(GASOLINE_NOW.period, GASOLINE_NOW.region));
  });

  it("shows the comparable change and its formula for the comparable figure (R12.9)", () => {
    const html = render();

    const result = computeChange(GASOLINE_THEN, GASOLINE_NOW);
    expect(result.comparable).toBe(true);
    if (!result.comparable) return;

    const display = formatChange(result, GASOLINE_THEN.region);
    // The direction word, signed difference and the two periods are all shown.
    expect(html).toContain(display.direction);
    expect(html).toContain(display.difference);
    expect(html).toContain(display.thenPeriod);
    expect(html).toContain(display.nowPeriod);
    // The formula line names the exact formula the calculation used.
    expect(html).toContain(REVEAL_COPY.formulaLabel);
    expect(html).toContain(CHANGE_FORMULA_ID);
  });

  it("shows a missing now with nowRetired and no change (series not in the response)", () => {
    const html = render();

    // The response has no entry for this series, so pickNow reports series_missing.
    const { now } = thenAndNow(MISSING_METRIC.id, "2026-10-27", DEMO_FIGURES);
    expect(now.found).toBe(false);

    expect(html).toContain(REVEAL_COPY.nowRetired);
    // The missing figure never invents a now value or a fetch message.
    expect(html).not.toContain(REVEAL_COPY.nowUnavailableFetch);
    expect(html).not.toContain(REVEAL_COPY.nowLoading);
  });

  it("shows nowNotYet for a series whose response figure is null", async () => {
    const body = figuresResponseFrom(DEMO_FIGURES);
    const emptied = {
      ...body,
      series: body.series.map((entry) =>
        entry.metric.series_id === GASOLINE_NOW.series_id
          ? { ...entry, figure: null }
          : entry,
      ),
    };
    const state = await loadFigures(stubFiguresFetch(emptied));
    expect(state.status).toBe("ready");

    const html = render(OPENED, state);
    // Each figure renders as one group, starting at its data-figure-entry marker.
    // The gasoline group is the first one, and it shows no now figure.
    const gasolineGroup = html.split('data-figure-entry=""')[1] ?? "";
    expect(gasolineGroup).toContain(htmlText(REVEAL_COPY.nowNotYet));
    expect(gasolineGroup).toContain(GASOLINE_METRIC.display_name);
    expect(gasolineGroup).not.toContain("retrieved");
    // The comparable branch is the only one that draws a now value (data-role="now").
    expect(gasolineGroup).not.toContain('data-role="now"');
  });

  it("shows nowUnavailableFetch and no change when the request failed", () => {
    const html = render(OPENED, { status: "failed" });
    expect(html).toContain(REVEAL_COPY.nowUnavailableFetch);
    expect(html).not.toContain(REVEAL_COPY.nowRetired);
    expect(html).not.toContain(CHANGE_FORMULA_ID);
    // The then figure is still shown with its own period.
    expect(html).toContain(formatValue(GASOLINE_THEN.value, GASOLINE_THEN.region));
  });

  it("shows nowLoading and no change while the request is in flight", () => {
    const html = render(OPENED, { status: "loading" });
    expect(html).toContain(REVEAL_COPY.nowLoading);
    expect(html).not.toContain(CHANGE_FORMULA_ID);
  });

  it("shows Your answer exactly once in every entry branch (issue #250, A7)", async () => {
    // Visible text only: no aria-label and no screen-reader-only span.
    const visibleAnswers = (group: string): number => {
      const text = group
        .replace(/aria-label="[^"]*"/g, "")
        .replace(/<span class="[^"]*srOnly[^"]*">[^<]*<\/span>/g, "")
        .replace(/<[^>]+>/g, "");
      return text.split(REVEAL_COPY.yourAnswer).length - 1;
    };
    const groupsOf = (html: string): string[] =>
      html.split('data-figure-entry=""').slice(1);

    // Comparable branch, with the Number_Line label.
    const comparable = groupsOf(render());
    expect(comparable.length).toBeGreaterThan(0);
    for (const group of comparable) expect(visibleAnswers(group)).toBe(1);

    // Series not in the response (no now figure).
    const missing = groupsOf(render(OPENED, { status: "failed" }));
    expect(missing.length).toBeGreaterThan(0);
    for (const group of missing) expect(visibleAnswers(group)).toBe(1);

    // Still loading: the then figure and the answer line, no Number_Line.
    const loading = groupsOf(render(OPENED, { status: "loading" }));
    expect(loading.length).toBeGreaterThan(0);
    for (const group of loading) expect(visibleAnswers(group)).toBe(1);

    // Not comparable (unit mismatch): both figures, no Number_Line, one answer line.
    const diesel = groupsOf(render()).find((group) =>
      group.includes(DIESEL_METRIC.display_name),
    );
    expect(diesel).toBeDefined();
    expect(diesel).not.toContain('data-line-label="answer"');
    expect(visibleAnswers(diesel ?? "")).toBe(1);
  });

  it("shows both figures with their own periods plus the reason for a unit mismatch", () => {
    const html = render();

    const result = computeChange(DIESEL_THEN_BAD_UNIT, DIESEL_NOW);
    expect(result.comparable).toBe(false);
    if (result.comparable) return;
    expect(result.reason).toBe("unit");

    // The lead "can't be compared" sentence and the specific unit reason.
    expect(html).toContain(htmlText(REVEAL_COPY.notComparable));
    expect(html).toContain(htmlText(REVEAL_COPY.reason.unit));

    // Both figures are still shown, each with its own period.
    expect(html).toContain(
      formatPeriod(DIESEL_THEN_BAD_UNIT.period, DIESEL_THEN_BAD_UNIT.region),
    );
    expect(html).toContain(formatPeriod(DIESEL_NOW.period, DIESEL_NOW.region));
  });

  it("shows the unreadable_period reason for a figure with an unreadable period", () => {
    const html = render();

    const result = computeChange(GASOLINE_THEN_BAD_PERIOD, GASOLINE_NOW);
    expect(result.comparable).toBe(false);
    if (result.comparable) return;
    expect(result.reason).toBe("unreadable_period");

    expect(html).toContain(htmlText(REVEAL_COPY.reason.unreadable_period));
  });

  it("renders the fixture note exactly once, at the top of stage 3 (R13.5)", () => {
    const html = render();

    // Every shown figure is a fixture, so the note appears — exactly once.
    const occurrences = html.split(REVEAL_COPY.fixtureNote).length - 1;
    expect(occurrences).toBe(1);

    // It sits above the first figure group: before the first metric name.
    const iNote = html.indexOf(REVEAL_COPY.fixtureNote);
    const iFirstMetric = html.indexOf(GASOLINE_METRIC.display_name);
    expect(iNote).toBeGreaterThanOrEqual(0);
    expect(iNote).toBeLessThan(iFirstMetric);
  });

  it("does not render the fixture note when no shown figure is a fixture", () => {
    // Swap in a payload whose single figure uses non-FIXTURE source/series, and
    // whose series is absent from DEMO_FIGURES (so no fixture now is pulled in).
    const realMetric: MetricDefinitionV1 = {
      id: "real-only",
      display_name: "A real series",
      unit: "USD per gallon",
      region: "U.S.",
      source: "U.S. EIA",
      series_id: "REAL-SERIES",
    };
    const realThen: Readonly<FigureV1> = {
      kind: "official",
      metric_id: realMetric.id,
      value: "3.00",
      unit: "USD per gallon",
      region: "U.S.",
      period: "2023-11-06",
      source: "U.S. EIA",
      series_id: "REAL-SERIES",
      retrieved_at: "2024-10-30T14:02:11Z",
      source_url: "https://www.eia.gov/series",
    };
    const payload = {
      ...PAYLOAD,
      metrics: [realMetric],
      figures: [realThen],
    } satisfies PayloadV1;
    const opened: Opened = { ...OPENED, payload };

    const html = render(opened);
    expect(html).not.toContain(REVEAL_COPY.fixtureNote);
  });

  it("makes no network request while rendering stage 3", () => {
    render();
    render(OPENED);
    // The fetch guard in beforeEach throws if touched; reaching here means no
    // render called it.
    expect(fetch).not.toHaveBeenCalled();
  });
});
