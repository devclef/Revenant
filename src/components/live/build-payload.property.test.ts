// Property 12: the payload builder copies the then figures and nothing else
// (design.md, Correctness Properties; R13.4 to R13.6, R14.1, R14.4).
//
// The oracle works from the raw series, not from thenAndNow: the "then" figure
// is the figure with the latest period on or before the sealing day, and a
// missing "then" is a series with no period on or before that day.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { checkRecallSubject } from "@/lib/recall";
import type { FigureV1, MetricDefinitionV1 } from "@/lib/seal-format";
import { CATALOGUE, type LoadedFigures } from "@/lib/figures";

import { buildLivePayload } from "./build-payload";
import { RECALL_SUBJECTS } from "./recall-subjects";
import { catalogueMetric, fixtureMetric, makeFigures, type SeriesInput } from "./test-figures";

const DAY_MS = 86_400_000;
const FIRST_MONDAY_MS = Date.UTC(1970, 0, 5);

// A real Monday between about 1980 and 2120.
const mondayArb: fc.Arbitrary<string> = fc
  .integer({ min: 520, max: 7800 })
  .map((weeks) => new Date(FIRST_MONDAY_MS + weeks * 7 * DAY_MS).toISOString().slice(0, 10));

// Any calendar day from about 1975 to 2140, as the sealing day.
const sealedDateArb: fc.Arbitrary<string> = fc
  .integer({ min: 0, max: 60_000 })
  .map((days) => new Date(Date.UTC(1975, 0, 1) + days * DAY_MS).toISOString().slice(0, 10));

const valueArb: fc.Arbitrary<string> = fc
  .tuple(fc.integer({ min: 0, max: 9999 }), fc.integer({ min: 0, max: 99 }))
  .map(([whole, cents]) => `${whole}.${cents < 10 ? "0" : ""}${cents}`);

// The six listable ids: the four real catalogue series and the two fixture
// subjects. Each gets its own metric definition.
const LISTABLE_IDS = Object.keys(RECALL_SUBJECTS);

function metricFor(id: string): MetricDefinitionV1 {
  return id.startsWith("fixture-") ? fixtureMetric(id) : catalogueMetric(id);
}

const METRICS: Record<string, MetricDefinitionV1> = Object.fromEntries(
  LISTABLE_IDS.map((id) => [id, metricFor(id)]),
);

// One series' figures: 1 to 8 Mondays, each with a value.
function seriesInputArb(id: string): fc.Arbitrary<SeriesInput> {
  return fc
    .uniqueArray(mondayArb, { minLength: 1, maxLength: 8 })
    .chain((periods) =>
      fc
        .array(valueArb, { minLength: periods.length, maxLength: periods.length })
        .map((values) => ({
          metric: METRICS[id],
          figures: periods.map((period, i) => ({ period, value: values[i] })),
        })),
    );
}

// Figures for all six series, in catalogue order.
const figuresArb: fc.Arbitrary<LoadedFigures> = fc
  .tuple(...LISTABLE_IDS.map((id) => seriesInputArb(id)))
  .map((entries) => makeFigures(entries));

// A selection of 1 to 6 distinct listable ids, in a random order.
const selectionArb: fc.Arbitrary<string[]> = fc.uniqueArray(fc.constantFrom(...LISTABLE_IDS), {
  minLength: 1,
  maxLength: 6,
});

// A code point from anywhere in Unicode except surrogates, which cannot stand alone.
const codePointArb = fc.integer({ min: 0, max: 0x10ffff }).filter((n) => n < 0xd800 || n > 0xdfff);

// A valid letter: 1 to 200 code points with at least one non-whitespace
// character, as payloadV1Schema requires.
const letterTextArb: fc.Arbitrary<string> = fc
  .array(codePointArb, { minLength: 1, maxLength: 200 })
  .map((codePoints) => String.fromCodePoint(...codePoints))
  .filter((text) => text.trim().length > 0);

// The figure with the latest period on or before the sealing day, read straight
// from the series, or undefined when no figure is on or before it.
function oracleThen(
  figures: LoadedFigures,
  id: string,
  sealedDate: string,
): FigureV1 | undefined {
  const series = figures.series.get(id);
  if (series === undefined) return undefined;
  let best: FigureV1 | undefined;
  for (const f of series.figures) {
    if (f.period <= sealedDate && (best === undefined || f.period > best.period)) {
      best = f;
    }
  }
  return best;
}

describe("Property 12: buildLivePayload copies the then figures and nothing else", () => {
  it("builds a valid payload, or names the first series with no then figure", () => {
    fc.assert(
      fc.property(
        selectionArb,
        figuresArb,
        sealedDateArb,
        letterTextArb,
        (ids, figures, sealedDate, text) => {
          const result = buildLivePayload({ text, metricIds: ids, sealedDate, figures });

          const firstMissing = ids.find((id) => oracleThen(figures, id, sealedDate) === undefined);
          if (firstMissing !== undefined) {
            expect(result).toEqual({ ok: false, metricId: firstMissing });
            return;
          }

          expect(result.ok).toBe(true);
          if (!result.ok) return;
          const { payload } = result;

          // Shape: version 1, the letter as written, no written_as_of.
          expect(payload.format_version).toBe(1);
          expect(payload.letter_text).toBe(text);
          expect(payload).not.toHaveProperty("written_as_of");

          // One figure and one metric per selection, in selection order.
          expect(payload.figures).toHaveLength(ids.length);
          expect(payload.metrics).toHaveLength(ids.length);
          expect(payload.recall_questions).toHaveLength(ids.length);

          ids.forEach((id, i) => {
            // The then figure is copied unchanged, and no self-reported figure appears.
            const expected = oracleThen(figures, id, sealedDate);
            expect(expected).toBeDefined();
            expect(payload.figures[i]).toEqual(expected);
            expect(payload.figures[i].kind).toBe("official");
            expect(payload.figures[i].metric_id).toBe(id);

            // Six-key metric definition, copied from the series' metric.
            const metric = payload.metrics[i];
            expect(Object.keys(metric).sort()).toEqual(
              ["display_name", "id", "region", "series_id", "source", "unit"],
            );
            expect(metric).toEqual(METRICS[id]);

            // One number question per selection, with its subject, passing the subject check.
            const subject = RECALL_SUBJECTS[id];
            expect(checkRecallSubject(subject, METRICS[id])).toBeNull();
            expect(payload.recall_questions[i]).toEqual({
              id: `q${i + 1}`,
              answer_type: "number",
              metric_id: id,
              text: `What do you think ${subject} cost then?`,
            });
          });
        },
      ),
      { numRuns: 100 },
    );
  });

  it("returns the first series with no then figure in selection order", () => {
    const figures = makeFigures([
      {
        metric: catalogueMetric("us-diesel"),
        figures: [{ period: "2026-10-26", value: "4.00" }],
      },
      {
        metric: catalogueMetric("us-gasoline-regular"),
        figures: [{ period: "2010-01-04", value: "2.50" }],
      },
    ]);

    // us-gasoline-regular has a figure on or before 2020-01-06. us-diesel's only
    // figure is later, so it is the first series with no then figure.
    const result = buildLivePayload({
      text: "Dear future me.",
      metricIds: ["us-diesel", "us-gasoline-regular"],
      sealedDate: "2020-01-06",
      figures,
    });

    expect(result).toEqual({ ok: false, metricId: "us-diesel" });
  });

  it("is deterministic: the same inputs build the same payload", () => {
    const figures = makeFigures([
      {
        metric: catalogueMetric("eu-diesel"),
        figures: [{ period: "2024-06-03", value: "1800.00" }],
      },
    ]);
    const input = {
      text: "Same letter.",
      metricIds: ["eu-diesel"],
      sealedDate: "2026-11-02",
      figures,
    };

    expect(buildLivePayload(input)).toEqual(buildLivePayload(input));
  });

  it("omits catalogue-only fields such as period_type from the metric", () => {
    const eu = CATALOGUE.find((s) => s.metric.id === "eu-petrol-euro95")!;
    expect(eu.display_rescale).toBeDefined();

    const figures = makeFigures([
      {
        metric: eu.metric,
        figures: [{ period: "2024-06-03", value: "1800.00" }],
      },
    ]);
    const result = buildLivePayload({
      text: "EU letter.",
      metricIds: ["eu-petrol-euro95"],
      sealedDate: "2026-11-02",
      figures,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.metrics[0]).not.toHaveProperty("period_type");
    expect(result.payload.metrics[0]).not.toHaveProperty("display_rescale");
  });
});
