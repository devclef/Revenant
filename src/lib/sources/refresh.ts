// Append-only refresh logic for the real figures file (spec 04-real-figures,
// task 4). This is a pure dev-side module: it takes the figures already on disk
// and the freshly-downloaded series, and decides which periods are new, which
// are revisions to leave untouched, which are gaps, and which would be a
// backfill that fails the run. It serialises the merged file deterministically.
//
// Pure module. It imports only `@/lib/figures` (CATALOGUE, loadFigureFile),
// the sealed-letter figure type from `@/lib/seal-format`, and the SourceFigure
// type from `./types`. It performs no network request and never touches
// `node:fs`: reading and writing the file is the caller's job (the script
// entry in task 5). Nothing here depends on the browser or the server runtime.
//
// Data integrity (data-integrity.md, neutrality.md): existing figures are
// carried through exactly as parsed — their `value` and `retrieved_at` are
// never recomputed. No number is invented, estimated or filled. The report
// wording states only what happened to each period and never says a value
// rose, fell, improved, worsened, corrected or revised.

import { CATALOGUE, loadFigureFile } from "@/lib/figures";
import type { FigureV1 } from "@/lib/seal-format";

import type { SourceFigure } from "./types";

// Reference CATALOGUE and loadFigureFile so the imports are used before the
// stubbed functions below are implemented (tasks 3 and 4). They are the only
// runtime dependencies this module is allowed.
void CATALOGUE;
void loadFigureFile;

// --- Types -------------------------------------------------------------------

/**
 * One series as freshly downloaded: its catalogue metric id, the points read
 * from the source (ascending by `period`), the UTC time the file it came from
 * was downloaded (`YYYY-MM-DDTHH:MM:SSZ`), and the series' reference URL.
 */
export interface FreshSeries {
  metricId: string;
  points: SourceFigure[];
  downloadedAt: string;
  sourceUrl: string;
}

/**
 * What a merge did, for printing and for tests. Every list is in catalogue
 * order, then `period` ascending. `perSeries` has one entry per catalogue
 * series that produced at least one added figure; `first`/`last` are the
 * earliest and latest added periods for that series.
 */
export interface Report {
  perSeries: {
    metricId: string;
    kept: number;
    added: number;
    first: string;
    last: string;
  }[];
  gaps: { metricId: string; period: string; reason: string }[];
  revisions: {
    metricId: string;
    period: string;
    committed: string;
    source: string;
  }[];
  missingFromSource: { metricId: string; period: string }[];
  backfills: { metricId: string; period: string; latest: string }[];
}

/**
 * The outcome of a merge. `ok: false` is returned only when a backfill was
 * detected (`report.backfills` is non-empty): in that case no figures are
 * returned at all, not even the later periods. Otherwise `ok: true` carries
 * every existing figure unchanged plus the added ones.
 */
export type MergeResult =
  | { ok: true; figures: FigureV1[]; report: Report }
  | { ok: false; report: Report };

// --- Report wording ----------------------------------------------------------

/**
 * One report line to format, as a discriminated union on `kind`. Each shape
 * matches an item in {@link Report}; `added` carries the `perSeries` counts.
 */
export type ReportLine =
  | {
      kind: "revision";
      metricId: string;
      period: string;
      committed: string;
      source: string;
    }
  | { kind: "backfill"; metricId: string; period: string; latest: string }
  | {
      kind: "added";
      metricId: string;
      added: number;
      first: string;
      last: string;
    }
  | { kind: "gap"; metricId: string; period: string; reason: string }
  | { kind: "missing-from-source"; metricId: string; period: string };

/**
 * Produce the one fixed line form for a report item (design.md "Report
 * wording"). The text is neutral: it states what happened to a period and
 * never says a value rose, fell, improved, worsened, corrected or revised.
 *
 *   revision <metricId> <period> committed <committed> source now shows <source>
 *   backfill <metricId> <period> latest <latest>
 *   added <metricId> <added> first <first> last <last>
 *   gap <metricId> <period> <reason>
 *   missing-from-source <metricId> <period>
 */
export function formatReportLine(line: ReportLine): string {
  switch (line.kind) {
    case "revision":
      return `revision ${line.metricId} ${line.period} committed ${line.committed} source now shows ${line.source}`;
    case "backfill":
      return `backfill ${line.metricId} ${line.period} latest ${line.latest}`;
    case "added":
      return `added ${line.metricId} ${line.added} first ${line.first} last ${line.last}`;
    case "gap":
      return `gap ${line.metricId} ${line.period} ${line.reason}`;
    case "missing-from-source":
      return `missing-from-source ${line.metricId} ${line.period}`;
  }
}

// --- Merge and serialise (implemented in tasks 3 and 4) ----------------------

/**
 * Merge freshly-downloaded series into the existing figures, append-only, with
 * backfill refusal. Implemented in task 3 (see design.md "Refresh").
 */
export function mergeRefresh(
  existing: readonly FigureV1[],
  fresh: readonly FreshSeries[],
): MergeResult {
  void existing;
  void fresh;
  throw new Error("mergeRefresh is not implemented yet");
}

/**
 * Serialise figures to the deterministic figure-file layout and key order.
 * Implemented in task 4 (see design.md "Deterministic serialisation").
 */
export function serialiseFigureFile(figures: readonly FigureV1[]): string {
  void figures;
  throw new Error("serialiseFigureFile is not implemented yet");
}
