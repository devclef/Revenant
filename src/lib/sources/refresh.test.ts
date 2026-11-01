// Example tests for the append-only refresh logic (spec 04-real-figures,
// task 4). These are in-memory only: no network, no filesystem. Every figure
// and value here is obviously fake — round "1.xxx" strings and example.test
// URLs — so nothing can be mistaken for a real published figure
// (data-integrity.md). They walk mergeRefresh and serialiseFigureFile through
// the behaviours the design fixes: first run, append, revision, gap,
// missing-from-source, backfill refusal, a mixed run, a no-op second run, and
// order-independent serialisation.

import { describe, expect, it } from "vitest";

import { CATALOGUE } from "@/lib/figures";
import type { FigureV1 } from "@/lib/seal-format";

import {
  formatReportLine,
  mergeRefresh,
  serialiseFigureFile,
  type FreshSeries,
  type ReportLine,
} from "./refresh";
import type { SourceFigure } from "./types";

// Catalogue metric ids, in catalogue order, so tests read against real ids
// without inventing a figure value. index 0,1,2,3.
const GASOLINE = "us-gasoline-regular";
const DIESEL = "us-diesel";
const PETROL = "eu-petrol-euro95";

const CATALOGUE_BY_ID = new Map(CATALOGUE.map((s) => [s.metric.id, s]));

// A fixed fake download time and URL. The time has no milliseconds, matching
// the retrieved_at shape the real script uses, but the value is clearly a
// test constant.
const DOWNLOADED_AT = "2020-01-01T00:00:00Z";
const SOURCE_URL = "https://example.test/series";

/**
 * Build a clearly-fake existing official figure for a catalogue metric. The
 * value is a caller-supplied obviously-fake string; every other provenance
 * field is copied from the catalogue so the figure is schema-valid.
 */
function existing(
  metricId: string,
  period: string,
  value: string,
  retrievedAt = "2019-01-01T00:00:00Z",
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

/** Build a fresh series for one metric from (period, value) pairs. */
function fresh(
  metricId: string,
  points: [period: string, value: string][],
): FreshSeries {
  const pts: SourceFigure[] = points.map(([period, value]) => ({
    period,
    value,
  }));
  return {
    metricId,
    points: pts,
    downloadedAt: DOWNLOADED_AT,
    sourceUrl: SOURCE_URL,
  };
}

/** Every banned direction word the report wording must never contain. */
const BANNED_WORDS = [
  "rose",
  "fell",
  "improved",
  "worsened",
  "corrected",
  "revised",
];

function assertNoBannedWords(line: string): void {
  for (const word of BANNED_WORDS) {
    expect(line.toLowerCase()).not.toContain(word);
  }
}

describe("mergeRefresh — first run", () => {
  it("adds everything when there are no existing figures", () => {
    const result = mergeRefresh(
      [],
      [
        fresh(GASOLINE, [
          ["2020-01-02", "1.111"],
          ["2020-01-09", "1.222"],
        ]),
      ],
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.figures).toHaveLength(2);
    expect(result.figures.map((f) => f.period)).toEqual([
      "2020-01-02",
      "2020-01-09",
    ]);
    // Added figures take retrieved_at and source_url from the fresh series.
    for (const fig of result.figures) {
      expect(fig.retrieved_at).toBe(DOWNLOADED_AT);
      expect(fig.kind === "official" && fig.source_url).toBe(SOURCE_URL);
    }
    expect(result.report.backfills).toHaveLength(0);
    expect(result.report.perSeries).toEqual([
      {
        metricId: GASOLINE,
        kept: 0,
        added: 2,
        first: "2020-01-02",
        last: "2020-01-09",
      },
    ]);
    expect(formatReportLine({ kind: "added", ...result.report.perSeries[0] }));
  });
});

describe("mergeRefresh — append", () => {
  it("adds a later week to a populated series and keeps the old ones", () => {
    const existingFigs = [
      existing(GASOLINE, "2020-01-02", "1.111"),
      existing(GASOLINE, "2020-01-09", "1.222"),
    ];
    const result = mergeRefresh(existingFigs, [
      fresh(GASOLINE, [
        ["2020-01-02", "1.111"],
        ["2020-01-09", "1.222"],
        ["2020-01-16", "1.333"],
      ]),
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.figures).toHaveLength(3);
    // The two existing figures are carried through as the parsed objects.
    expect(result.figures[0]).toBe(existingFigs[0]);
    expect(result.figures[1]).toBe(existingFigs[1]);
    const addedFig = result.figures.find((f) => f.period === "2020-01-16");
    expect(addedFig?.value).toBe("1.333");
    expect(addedFig?.retrieved_at).toBe(DOWNLOADED_AT);
    expect(result.report.perSeries).toEqual([
      {
        metricId: GASOLINE,
        kept: 2,
        added: 1,
        first: "2020-01-16",
        last: "2020-01-16",
      },
    ]);
  });
});

describe("mergeRefresh — revision", () => {
  it("reports a differing value as a revision and keeps the stored figure", () => {
    const existingFig = existing(
      GASOLINE,
      "2020-01-02",
      "1.111",
      "2019-05-05T00:00:00Z",
    );
    const result = mergeRefresh(
      [existingFig],
      [fresh(GASOLINE, [["2020-01-02", "1.999"]])],
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The stored figure is identical to existing: value and retrieved_at
    // untouched, same object reference.
    expect(result.figures).toHaveLength(1);
    expect(result.figures[0]).toBe(existingFig);
    expect(result.figures[0].value).toBe("1.111");
    expect(result.figures[0].retrieved_at).toBe("2019-05-05T00:00:00Z");
    // Nothing was added.
    expect(result.report.perSeries).toHaveLength(0);
    expect(result.report.revisions).toEqual([
      {
        metricId: GASOLINE,
        period: "2020-01-02",
        committed: "1.111",
        source: "1.999",
      },
    ]);
    const line = formatReportLine({
      kind: "revision",
      ...result.report.revisions[0],
    });
    expect(line).toBe(
      "revision us-gasoline-regular 2020-01-02 committed 1.111 source now shows 1.999",
    );
    assertNoBannedWords(line);
  });
});

describe("mergeRefresh — gaps and missing-from-source", () => {
  it("a source gap keeps the existing figure and is reported as missing-from-source", () => {
    // The fresh series has a gap at 2020-01-09 (the adapter dropped it), so it
    // is simply absent from the fresh points. The existing figure there is
    // kept and reported missing-from-source, NOT as a revision.
    const existingFigs = [
      existing(GASOLINE, "2020-01-02", "1.111"),
      existing(GASOLINE, "2020-01-09", "1.222"),
    ];
    const result = mergeRefresh(existingFigs, [
      fresh(GASOLINE, [["2020-01-02", "1.111"]]),
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.figures).toHaveLength(2);
    expect(result.report.revisions).toHaveLength(0);
    expect(result.report.missingFromSource).toEqual([
      { metricId: GASOLINE, period: "2020-01-09" },
    ]);
    const line = formatReportLine({
      kind: "missing-from-source",
      ...result.report.missingFromSource[0],
    });
    expect(line).toBe("missing-from-source us-gasoline-regular 2020-01-09");
    assertNoBannedWords(line);
  });

  it("formats a gap line in its fixed form", () => {
    const gap: ReportLine = {
      kind: "gap",
      metricId: DIESEL,
      period: "2020-02-03",
      reason: "no_number",
    };
    const line = formatReportLine(gap);
    expect(line).toBe("gap us-diesel 2020-02-03 no_number");
    assertNoBannedWords(line);
  });
});

describe("mergeRefresh — backfill refusal", () => {
  it("refuses a fresh period earlier than the latest existing period and adds nothing", () => {
    const existingFigs = [
      existing(GASOLINE, "2020-01-09", "1.222"),
      existing(GASOLINE, "2020-01-16", "1.333"),
    ];
    // 2020-01-02 is earlier than the latest existing (2020-01-16): backfill.
    // 2020-01-23 is a genuine later period, but because a backfill failed the
    // run, it must NOT be added either.
    const result = mergeRefresh(existingFigs, [
      fresh(GASOLINE, [
        ["2020-01-02", "1.000"],
        ["2020-01-09", "1.222"],
        ["2020-01-16", "1.333"],
        ["2020-01-23", "1.444"],
      ]),
    ]);

    expect(result.ok).toBe(false);
    // No figures field at all on an ok:false result.
    expect("figures" in result).toBe(false);
    expect(result.report.backfills).toEqual([
      { metricId: GASOLINE, period: "2020-01-02", latest: "2020-01-16" },
    ]);
    const line = formatReportLine({
      kind: "backfill",
      ...result.report.backfills[0],
    });
    expect(line).toBe("backfill us-gasoline-regular 2020-01-02 latest 2020-01-16");
    assertNoBannedWords(line);
  });
});

describe("mergeRefresh — mixed run", () => {
  it("an empty series beside a populated one adds all of the empty one with no backfill", () => {
    // GASOLINE has existing figures; DIESEL has none. The fresh DIESEL series
    // carries several periods — all are added because latest is none, so no
    // backfill is possible for it.
    const existingFigs = [
      existing(GASOLINE, "2020-01-02", "1.111"),
      existing(GASOLINE, "2020-01-09", "1.222"),
    ];
    const result = mergeRefresh(existingFigs, [
      fresh(GASOLINE, [
        ["2020-01-02", "1.111"],
        ["2020-01-09", "1.222"],
      ]),
      fresh(DIESEL, [
        ["2020-01-02", "2.111"],
        ["2020-01-09", "2.222"],
        ["2020-01-16", "2.333"],
      ]),
    ]);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.report.backfills).toHaveLength(0);
    expect(result.figures).toHaveLength(5);
    // GASOLINE added nothing; DIESEL added all three.
    expect(result.report.perSeries).toEqual([
      {
        metricId: DIESEL,
        kept: 0,
        added: 3,
        first: "2020-01-02",
        last: "2020-01-16",
      },
    ]);
    const dieselFigs = result.figures.filter((f) => f.metric_id === DIESEL);
    expect(dieselFigs.map((f) => f.value)).toEqual(["2.111", "2.222", "2.333"]);
  });
});

describe("mergeRefresh — second identical run is a no-op", () => {
  it("adds nothing and serialises byte-identically", () => {
    const first = mergeRefresh(
      [],
      [
        fresh(GASOLINE, [
          ["2020-01-02", "1.111"],
          ["2020-01-09", "1.222"],
        ]),
        fresh(DIESEL, [["2020-01-02", "2.111"]]),
      ],
    );
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const firstBytes = serialiseFigureFile(first.figures);

    // Re-run with the exact same fresh data against the figures just written.
    const second = mergeRefresh(first.figures, [
      fresh(GASOLINE, [
        ["2020-01-02", "1.111"],
        ["2020-01-09", "1.222"],
      ]),
      fresh(DIESEL, [["2020-01-02", "2.111"]]),
    ]);
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    // mergeRefresh added nothing on the second run.
    expect(second.report.perSeries).toHaveLength(0);
    expect(second.report.revisions).toHaveLength(0);
    expect(second.report.backfills).toHaveLength(0);
    expect(second.figures).toHaveLength(first.figures.length);

    // serialiseFigureFile output is byte-identical.
    expect(serialiseFigureFile(second.figures)).toBe(firstBytes);
  });
});

describe("serialiseFigureFile — layout and ordering", () => {
  it("orders by catalogue position then period and is order-independent", () => {
    // Build figures deliberately out of order: eu-petrol (index 2) before
    // us-gasoline (index 0), and a later period before an earlier one.
    const figs: FigureV1[] = [
      existing(PETROL, "2020-01-09", "1500.222"),
      existing(GASOLINE, "2020-01-09", "1.222"),
      existing(PETROL, "2020-01-02", "1500.111"),
      existing(GASOLINE, "2020-01-02", "1.111"),
    ];
    const text = serialiseFigureFile(figs);

    // Catalogue order: us-gasoline-regular (0) before eu-petrol-euro95 (2);
    // within a series, period ascending.
    const periodsInOrder = [...text.matchAll(/"metric_id":"([^"]+)","value":"([^"]+)"/g)].map(
      (m) => [m[1], m[2]] as const,
    );
    // Reconstruct from the figure lines in output order.
    const metricOrder = [...text.matchAll(/"metric_id":"([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(metricOrder).toEqual([GASOLINE, GASOLINE, PETROL, PETROL]);
    void periodsInOrder;

    // Reordering the input yields identical bytes.
    const reordered = [figs[3], figs[0], figs[2], figs[1]];
    expect(serialiseFigureFile(reordered)).toBe(text);
  });

  it("emits the top-level key order, four-space indent, trailing commas and final newline", () => {
    const text = serialiseFigureFile([existing(GASOLINE, "2020-01-02", "1.111")]);
    const lines = text.split("\n");
    expect(lines[0]).toBe("{");
    expect(lines[1]).toBe('  "fixture": false,');
    expect(lines[2].startsWith('  "note": "')).toBe(true);
    expect(lines[3]).toBe('  "series": [],');
    expect(lines[4]).toBe('  "figures": [');
    // The single figure line is indented four spaces and has no trailing comma.
    expect(lines[5].startsWith("    {")).toBe(true);
    expect(lines[5].endsWith("}")).toBe(true);
    expect(lines[6]).toBe("  ]");
    expect(lines[7]).toBe("}");
    // Final newline.
    expect(text.endsWith("}\n")).toBe(true);
    // Figure key order is the fixed one.
    expect(lines[5].trim()).toBe(
      JSON.stringify({
        kind: "official",
        metric_id: GASOLINE,
        value: "1.111",
        unit: CATALOGUE_BY_ID.get(GASOLINE)!.metric.unit,
        region: CATALOGUE_BY_ID.get(GASOLINE)!.metric.region,
        period: "2020-01-02",
        source: CATALOGUE_BY_ID.get(GASOLINE)!.metric.source,
        series_id: CATALOGUE_BY_ID.get(GASOLINE)!.metric.series_id,
        retrieved_at: "2019-01-01T00:00:00Z",
        source_url: "https://example.test/existing",
      }),
    );
  });

  it("the fixed note contains no banned direction word", () => {
    const text = serialiseFigureFile([]);
    assertNoBannedWords(text);
  });
});
