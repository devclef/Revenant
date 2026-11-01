import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FiguresThenNow } from "./FiguresThenNow";
import { REVEAL_COPY } from "./copy";
import { CATALOGUE } from "@/lib/figures/catalogue";
import { loadFigureFile } from "@/lib/figures/load";
import { thenAndNow } from "@/lib/figures/then-now";
import { computeChange, isFixtureFigure } from "@/lib/figures";
import type { LoadedFigures } from "@/lib/figures";
import type { Opened } from "./opening-machine";
import type { FigureV1, MetricDefinitionV1, PayloadV1 } from "@/lib/seal-format";

import usFuelFixture from "@/lib/figures/demo/us-fuel.fixture.json";

/**
 * R16.4 (data-integrity.md "Fixture figures ... only with a visible 'fixture
 * data' label next to each one"): in stage 3 of the reveal, every rendered
 * fixture figure carries a visible "fixture data" label, and a change line
 * built from a fixture input carries one too.
 *
 * Rendered with `renderToStaticMarkup` and `createElement` — no DOM library and
 * no JSX in the render path — matching the existing reveal test style.
 *
 * The visible label is `REVEAL_COPY.labelFixtureData` ("fixture data") rendered
 * as its own element by {@link FigureLine} (once per fixture figure shown) and
 * by {@link ChangeLine} (once more when either change input is a fixture). The
 * fixture NOTE at the top of stage 3 (`REVEAL_COPY.fixtureNote`) is a different,
 * longer sentence that merely contains the phrase "fixture data" inline; it is
 * not a per-figure label and must not be counted as one. We therefore count the
 * label only where it renders element-bounded (`>fixture data<`), which the
 * inline note never produces.
 *
 * The fixture figures come from loading the US fuel fixture file directly —
 * `loadFigureFile(us-fuel.fixture.json, CATALOGUE)` — not from the `DEMO_FIGURES`
 * re-export (owner note). This is the same validated, frozen result the demo
 * uses, read straight from its source file. The two fixture series it defines
 * (`fixture-us-gasoline-regular`, `fixture-us-diesel`) each give a real frozen
 * fixture "now" figure, so the component renders a then figure, a now figure
 * and a change line for each — three visible labels per comparable fixture
 * entry. No network: the file is a static import.
 */

// The label text, and a guard that the note is a different, longer string that
// merely contains it. If these were equal, counting the phrase would be
// ambiguous and this test would be meaningless.
const LABEL = REVEAL_COPY.labelFixtureData;
const ELEMENT_BOUNDED_LABEL = `>${LABEL}<`;

// --- fixtures ----------------------------------------------------------------

// The US fuel fixture file, loaded directly through the same loader the demo
// uses but read straight from its source JSON (owner note: not DEMO_FIGURES).
// loadFigureFile validates it against the real CATALOGUE and deep-freezes the
// result, so these are the exact frozen figures the component also sees.
const FIXTURE: LoadedFigures = loadFigureFile(usFuelFixture, CATALOGUE);

// The latest frozen "now" fixture figures in the loaded fixture file, read
// straight from the loaded catalogue so the test uses the same bytes the
// component does.
const GASOLINE_NOW = (() => {
  const { now } = thenAndNow(
    "fixture-us-gasoline-regular",
    "2026-10-27",
    FIXTURE,
  );
  if (!now.found) throw new Error("test setup: gasoline now must be found");
  return now.figure;
})();

const DIESEL_NOW = (() => {
  const { now } = thenAndNow("fixture-us-diesel", "2026-10-27", FIXTURE);
  if (!now.found) throw new Error("test setup: diesel now must be found");
  return now.figure;
})();

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

// Comparable fixture "then" figures: same unit/source/series as their now
// figures, an earlier period, so computeChange is comparable and a ChangeLine
// renders. Both inputs are fixtures, so the change line also carries the label.
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

const DIESEL_THEN: Readonly<FigureV1> = {
  kind: "official",
  metric_id: DIESEL_METRIC.id,
  value: "1.20",
  unit: DIESEL_NOW.unit,
  region: DIESEL_NOW.region,
  period: "2023-11-06",
  source: DIESEL_NOW.source,
  series_id: DIESEL_NOW.series_id,
  retrieved_at: "2000-01-01T00:00:00Z",
  source_url:
    "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=EMD_EPD2D_PTE_NUS_DPG&f=W",
};

// Every figure in this payload is a fixture, and both metrics have a comparable
// now figure in DEMO_FIGURES, so each entry renders: then FigureLine (label),
// now FigureLine (label), ChangeLine (label) = 3 labels per entry, 6 in total.
const PAYLOAD = {
  format_version: 1,
  letter_text: "A short sealed letter.",
  written_as_of: "2023-11-06",
  metrics: [GASOLINE_METRIC, DIESEL_METRIC],
  figures: [GASOLINE_THEN, DIESEL_THEN],
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
    sealedAt: "2026-10-27T00:00:00.000Z",
    opensAt: "2026-11-05T00:00:00.000Z",
  },
  openingKey: {} as unknown as CryptoKey,
  payload: PAYLOAD,
};

function render(opened: Opened = OPENED): string {
  return renderToStaticMarkup(createElement(FiguresThenNow, { opened }));
}

// Count element-bounded occurrences of the label (`>fixture data<`), which the
// per-figure/per-change label produces but the inline fixture NOTE never does.
function labelCount(html: string): number {
  return html.split(ELEMENT_BOUNDED_LABEL).length - 1;
}

describe("fixture-label visibility (R16.4)", () => {
  beforeEach(() => {
    // Stage 3 reads no network: the now data is a static import. Fail if a
    // render reaches for fetch.
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

  it("the label and the fixture note are distinct strings (so counting is meaningful)", () => {
    // The note contains the phrase, but is not equal to the label; the label is
    // counted element-bounded so the note's inline phrase is never miscounted.
    expect(REVEAL_COPY.fixtureNote).not.toEqual(LABEL);
    expect(REVEAL_COPY.fixtureNote).toContain(LABEL);
  });

  it("every rendered fixture figure carries a visible 'fixture data' label", () => {
    const html = render();

    // Every then and now figure actually shown is a fixture.
    const shownFixtureFigures = [
      GASOLINE_THEN,
      GASOLINE_NOW,
      DIESEL_THEN,
      DIESEL_NOW,
    ];
    for (const figure of shownFixtureFigures) {
      expect(isFixtureFigure(figure)).toBe(true);
    }

    // One visible label per fixture FigureLine (4) plus one per fixture change
    // line (2, both entries comparable with fixture inputs) = 6 in total. The
    // count matches the fixture-figure count plus the fixture change lines; no
    // fixture figure is shown without its label.
    const fixtureFigureLabels = shownFixtureFigures.length; // 4
    const fixtureChangeLabels = [GASOLINE_THEN, DIESEL_THEN].filter((then) => {
      const now = then === GASOLINE_THEN ? GASOLINE_NOW : DIESEL_NOW;
      const change = computeChange(then, now);
      return change.comparable && (isFixtureFigure(then) || isFixtureFigure(now));
    }).length; // 2

    expect(labelCount(html)).toBe(fixtureFigureLabels + fixtureChangeLabels);
    expect(labelCount(html)).toBe(6);
  });

  it("a change line built from a fixture input carries the 'fixture data' label", () => {
    const html = render();

    // Both entries are comparable (a ChangeLine renders) and both have fixture
    // inputs, so each change line carries the label. The change markup shows
    // the direction/difference from formatChange; the label sits on that line.
    const gasolineChange = computeChange(GASOLINE_THEN, GASOLINE_NOW);
    const dieselChange = computeChange(DIESEL_THEN, DIESEL_NOW);
    expect(gasolineChange.comparable).toBe(true);
    expect(dieselChange.comparable).toBe(true);

    // The formula line only renders inside a ChangeLine, so its count equals the
    // number of change lines shown (2). The label count (6) exceeds the four
    // FigureLine labels by exactly the two change lines, confirming each change
    // line carries the label.
    const changeLines = html.split(REVEAL_COPY.formulaLabel).length - 1;
    expect(changeLines).toBe(2);
    expect(labelCount(html)).toBe(4 + changeLines);
  });

  it("shows no 'fixture data' label when no shown figure is a fixture", () => {
    // A real series absent from DEMO_FIGURES: non-fixture then, no fixture now
    // pulled in, no change line. No visible label anywhere.
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
    expect(isFixtureFigure(realThen)).toBe(false);
    expect(labelCount(html)).toBe(0);
    // And the top-of-stage fixture note is absent too.
    expect(html).not.toContain(REVEAL_COPY.fixtureNote);
  });

  it("makes no network request while rendering", () => {
    render();
    expect(fetch).not.toHaveBeenCalled();
  });
});
