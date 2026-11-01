// Feature: 04-real-figures, task 4. Property-based tests (fast-check) for the
// append-only refresh logic in ./refresh.
//
// These are in-memory only: no network, no filesystem. Every generated figure
// is obviously fake — values are round "N.xxx" strings, periods are drawn from
// a tiny calendar, and provenance is copied from the real catalogue so the
// figures are schema-valid without inventing any field (data-integrity.md).
// Generators are bounded to the four catalogue metric ids and valid
// YYYY-MM-DD periods, so nothing here can be mistaken for a real published
// figure.
//
// Property 6 (mergeRefresh): a refresh never changes what is committed — every
// existing figure appears unchanged (value and retrieved_at preserved) in an
// ok:true result — and it refuses backfills: whenever a fresh point for a
// series is earlier than that series' latest existing period, the result is
// ok:false and no figures array is present.
//
// Property 7 (serialiseFigureFile): output is deterministic (same figures ->
// same bytes), ordered (catalogue position then period ascending), and stable
// (serialising the parse of a serialisation returns identical bytes, and
// permuting the input never changes the output).

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { CATALOGUE } from "@/lib/figures";
import type { FigureV1 } from "@/lib/seal-format";

import { mergeRefresh, serialiseFigureFile, type FreshSeries } from "./refresh";
import type { SourceFigure } from "./types";

const NUM_RUNS = 200;

// The four catalogue metric ids, in catalogue order, so the generators stay
// bounded to real ids and tests can assert catalogue ordering.
const METRIC_IDS = CATALOGUE.map((s) => s.metric.id);
const CATALOGUE_BY_ID = new Map(CATALOGUE.map((s) => [s.metric.id, s]));
const CATALOGUE_POS = new Map(METRIC_IDS.map((id, i) => [id, i]));

// A small calendar of valid, obviously-fake YYYY-MM-DD periods in ascending
// string order. String comparison of these equals chronological order, which
// is exactly the order mergeRefresh and serialiseFigureFile use.
const PERIODS = [
  "2020-01-02",
  "2020-01-09",
  "2020-01-16",
  "2020-01-23",
  "2020-01-30",
  "2020-02-06",
  "2020-02-13",
  "2020-02-20",
] as const;

const DOWNLOADED_AT = "2020-06-01T00:00:00Z";
const SOURCE_URL = "https://example.test/series";

/** Build a clearly-fake official figure for a catalogue metric. */
function makeFigure(
  metricId: string,
  period: string,
  value: string,
  retrievedAt: string,
): FigureV1 {
  const series = CATALOGUE_BY_ID.get(metricId);
  if (!series) throw new Error(`no catalogue metric ${metricId}`);
  return {
    kind: "official",
    metric_id: metricId,
    value,
    unit: series.metric.unit,
    region: series.metric.region,
    period,
    source: series.metric.source,
    series_id: series.metric.series_id,
    retrieved_at: retrievedAt,
    source_url: "https://example.test/existing",
  };
}

/** An obviously-fake value string, e.g. "3.142". */
const valueArb = fc
  .integer({ min: 0, max: 999 })
  .map((n) => `1.${n.toString().padStart(3, "0")}`);

/** A clearly-fake retrieved_at timestamp distinct from the download time. */
const retrievedAtArb = fc
  .integer({ min: 1, max: 28 })
  .map((d) => `2019-01-${d.toString().padStart(2, "0")}T00:00:00Z`);

/**
 * Generate a set of existing figures: for each metric id, a subset of the
 * calendar with fake values. Keys are unique by construction (one value per
 * metric|period), and figures are returned shuffled so no test relies on input
 * order.
 */
const existingArb: fc.Arbitrary<FigureV1[]> = fc
  .tuple(
    ...METRIC_IDS.map((metricId) =>
      fc
        .subarray([...PERIODS], { minLength: 0, maxLength: PERIODS.length })
        .chain((periods) =>
          fc.tuple(
            fc.constant(metricId),
            fc.constant(periods),
            fc.array(valueArb, {
              minLength: periods.length,
              maxLength: periods.length,
            }),
            fc.array(retrievedAtArb, {
              minLength: periods.length,
              maxLength: periods.length,
            }),
          ),
        ),
    ),
  )
  .chain((perMetric) => {
    const figs: FigureV1[] = [];
    for (const [metricId, periods, values, retrieved] of perMetric) {
      periods.forEach((period, i) => {
        figs.push(makeFigure(metricId, period, values[i], retrieved[i]));
      });
    }
    return fc.shuffledSubarray(figs, {
      minLength: figs.length,
      maxLength: figs.length,
    });
  });

/**
 * Generate fresh series: for each metric id, a subset of the calendar with
 * fake values, carried as ascending-by-period points (as the adapters emit).
 */
const freshArb: fc.Arbitrary<FreshSeries[]> = fc
  .tuple(
    ...METRIC_IDS.map((metricId) =>
      fc
        .subarray([...PERIODS], { minLength: 0, maxLength: PERIODS.length })
        .chain((periods) =>
          fc.tuple(
            fc.constant(metricId),
            fc.constant(periods),
            fc.array(valueArb, {
              minLength: periods.length,
              maxLength: periods.length,
            }),
          ),
        ),
    ),
  )
  .map((perMetric) =>
    perMetric
      .filter(([, periods]) => periods.length > 0)
      .map(([metricId, periods, values]) => {
        // subarray preserves source order, so periods are already ascending.
        const points: SourceFigure[] = periods.map((period, i) => ({
          period,
          value: values[i],
        }));
        return {
          metricId,
          points,
          downloadedAt: DOWNLOADED_AT,
          sourceUrl: SOURCE_URL,
        };
      }),
  );

/** The latest existing period for a metric, or null. String comparison. */
function latestExisting(
  existing: readonly FigureV1[],
  metricId: string,
): string | null {
  let latest: string | null = null;
  for (const fig of existing) {
    if (fig.metric_id !== metricId) continue;
    if (latest === null || fig.period > latest) latest = fig.period;
  }
  return latest;
}

/** Does any fresh point lie before its series' latest existing period? */
function hasBackfill(
  existing: readonly FigureV1[],
  fresh: readonly FreshSeries[],
): boolean {
  for (const series of fresh) {
    const latest = latestExisting(existing, series.metricId);
    if (latest === null) continue;
    const existingKeys = new Set(
      existing
        .filter((f) => f.metric_id === series.metricId)
        .map((f) => f.period),
    );
    for (const point of series.points) {
      // A point whose key already exists is a revision or a no-op, never a
      // backfill; only a genuinely new earlier period is a backfill.
      if (existingKeys.has(point.period)) continue;
      if (point.period < latest) return true;
    }
  }
  return false;
}

describe("Property 6: a refresh never rewrites committed figures and refuses backfills", () => {
  it("every existing figure survives unchanged on ok:true, and any backfill forces ok:false with no figures", () => {
    fc.assert(
      fc.property(existingArb, freshArb, (existing, fresh) => {
        const result = mergeRefresh(existing, fresh);
        const expectBackfill = hasBackfill(existing, fresh);

        if (expectBackfill) {
          // A backfill must refuse the whole run: ok:false, backfills reported,
          // and no figures array present at all.
          expect(result.ok).toBe(false);
          expect(result.report.backfills.length).toBeGreaterThan(0);
          expect("figures" in result).toBe(false);
          return;
        }

        // No backfill: the run succeeds and carries every existing figure
        // through unchanged.
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.report.backfills).toHaveLength(0);

        for (const original of existing) {
          const carried = result.figures.find(
            (f) =>
              f.metric_id === original.metric_id &&
              f.period === original.period,
          );
          expect(carried).toBeDefined();
          // Same object reference: value and retrieved_at are never recomputed.
          expect(carried).toBe(original);
          expect(carried?.value).toBe(original.value);
          expect(carried?.retrieved_at).toBe(original.retrieved_at);
        }

        // Nothing is dropped: every existing figure is still present.
        expect(result.figures.length).toBeGreaterThanOrEqual(existing.length);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

/**
 * Collect (metric_id, period) pairs in the order they appear in serialised
 * output, by scanning the figure lines.
 */
function serialisedOrder(text: string): [string, string][] {
  const pairs: [string, string][] = [];
  for (const m of text.matchAll(
    /"metric_id":"([^"]+)","value":"[^"]*","unit":"[^"]*","region":"[^"]*","period":"([^"]+)"/g,
  )) {
    pairs.push([m[1], m[2]]);
  }
  return pairs;
}

describe("Property 7: serialiseFigureFile is deterministic, ordered and stable", () => {
  it("produces identical, catalogue-then-period-ordered bytes regardless of input order, and round-trips through parse", () => {
    fc.assert(
      fc.property(existingArb, (figures) => {
        const text = serialiseFigureFile(figures);

        // Deterministic: serialising the same figures again gives the same
        // bytes.
        expect(serialiseFigureFile(figures)).toBe(text);

        // Order-independent: any permutation of the input serialises
        // identically.
        const reversed = [...figures].reverse();
        expect(serialiseFigureFile(reversed)).toBe(text);

        // Ordered: catalogue position of metric_id, then period ascending.
        const order = serialisedOrder(text);
        expect(order).toHaveLength(figures.length);
        for (let i = 1; i < order.length; i += 1) {
          const [prevId, prevPeriod] = order[i - 1];
          const [currId, currPeriod] = order[i];
          const prevPos = CATALOGUE_POS.get(prevId)!;
          const currPos = CATALOGUE_POS.get(currId)!;
          expect(prevPos).toBeLessThanOrEqual(currPos);
          if (prevPos === currPos) {
            // Within a series, period ascending by string comparison.
            expect(prevPeriod <= currPeriod).toBe(true);
          }
        }

        // Stable: serialising the parse of a serialisation returns identical
        // bytes. The parsed figures carry the same provenance fields, so the
        // re-serialisation is byte-for-byte equal.
        const parsed = JSON.parse(text) as { figures: FigureV1[] };
        expect(serialiseFigureFile(parsed.figures)).toBe(text);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
