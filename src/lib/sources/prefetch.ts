// Prefetch_Script core (spec 04-real-figures, task 5). `runPrefetch` runs both
// Adapters, checks the Bulletin column letters against the catalogue, builds the
// fresh series, merges them append-only with backfill refusal, checks coverage,
// serialises the figure file and proves it loads — all without touching a file.
// Reading and writing the Real_File is the caller's job (the script entry).
//
// Pure dev-side module. It imports only the two Adapters, the append-only
// refresh and the figures model (CATALOGUE, loadFigureFile). It performs no
// file access, no network beyond the Adapters, reads no environment variable
// and logs nothing. Nothing here depends on the browser or the server runtime,
// and nothing in the app or the image imports it (R6.7).
//
// Data integrity (data-integrity.md, neutrality.md): no number is invented,
// estimated or filled; existing figures are carried through exactly as parsed.
// Every error message states only what happened and never says a value rose,
// fell, improved, worsened, was corrected or revised.

import { CATALOGUE, loadFigureFile } from "@/lib/figures";
import type { FigureV1 } from "@/lib/seal-format";

import { fetchEiaSeries } from "./eia";
import type { EiaResult } from "./eia";
import { fetchBulletin } from "./oil-bulletin";
import type { BulletinKey, BulletinResult } from "./oil-bulletin";
import {
  mergeRefresh,
  serialiseFigureFile,
  type FreshSeries,
  type Report,
} from "./refresh";
import type { AdapterDeps, Fetcher } from "./types";

// --- Types -------------------------------------------------------------------

/**
 * Injectable dependencies for {@link runPrefetch}. Tests pass a `fetcher` that
 * returns the Recorded_Excerpts (so no network is touched) and a fixed `now`;
 * both default to each Adapter's real implementation.
 */
export interface PrefetchDeps {
  fetcher?: Fetcher;
  now?: () => Date;
}

/**
 * Which of the three run-ending checks failed (design.md "Prefetch"):
 *
 *  - `backfill`: a fresh point was earlier than its series' latest existing
 *    period, so the whole run fails and nothing is written.
 *  - `column_letter`: a Bulletin catalogue entry's `column <LETTER> "<KEY>"`
 *    text disagreed with the letter the Adapter found the key in.
 *  - `coverage`: a series' earliest figure is later than the required date.
 */
export type PrefetchErrorKind = "backfill" | "column_letter" | "coverage";

/**
 * A run-ending prefetch failure. `report` carries the merge {@link Report} for
 * the `backfill` and `coverage` kinds, so the script entry can still print what
 * the run found before the failure line; it is `null` for `column_letter`,
 * which fails before any merge.
 *
 * The message states only what happened and never says a value rose, fell,
 * improved, worsened, was corrected or revised (data-integrity.md,
 * neutrality.md).
 */
export class PrefetchError extends Error {
  readonly kind: PrefetchErrorKind;
  readonly report: Report | null;

  constructor(kind: PrefetchErrorKind, message: string, report: Report | null) {
    super(message);
    this.name = "PrefetchError";
    this.kind = kind;
    this.report = report;
  }
}

// --- Source wiring -----------------------------------------------------------

/** The two EIA series IDs this script downloads, paired with their metric id. */
const EIA_SERIES: readonly { metricId: string; seriesId: string }[] = [
  { metricId: "us-gasoline-regular", seriesId: "EMM_EPMR_PTE_NUS_DPG" },
  { metricId: "us-diesel", seriesId: "EMD_EPD2D_PTE_NUS_DPG" },
] as const;

/**
 * The two Bulletin metric ids paired with the header key each reads, so the
 * fresh-series build and the column-letter check know which of the two
 * {@link BulletinResult} series belongs to which catalogue entry.
 */
const BULLETIN_SERIES: readonly { metricId: string; key: BulletinKey }[] = [
  { metricId: "eu-petrol-euro95", key: "EU_price_with_tax_euro95" },
  { metricId: "eu-diesel", key: "EU_price_with_tax_diesel" },
] as const;

/**
 * The reference URL each series' figures carry as their `source_url`, equal to
 * the catalogue reference page recorded beside each entry in `catalogue.ts`
 * (data-integrity.md: a figure's `source_url` is a link a user can follow). The
 * two EIA series each point at their own history page; both EU series point at
 * the Weekly Oil Bulletin landing page. The fresh-series build tags each point
 * with the URL for its metric id.
 */
const SOURCE_URL: Readonly<Record<string, string>> = {
  "us-gasoline-regular":
    "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=EMM_EPMR_PTE_NUS_DPG&f=W",
  "us-diesel":
    "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET&s=EMD_EPD2D_PTE_NUS_DPG&f=W",
  "eu-petrol-euro95":
    "https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en",
  "eu-diesel":
    "https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en",
};

// --- Column-letter check (R4.4) ----------------------------------------------

/**
 * Pull the column letter out of one Bulletin catalogue entry's `series_id`
 * text. The text carries `column <LETTER> "<KEY>"`; this reads `<LETTER>` for
 * the given `key`, matching the key by its exact quoted spelling so the two
 * entries never cross. Returns the letter, or `null` when the entry does not
 * carry a `column <LETTER> "<key>"` phrase (which is itself a mismatch).
 */
function catalogueColumnLetter(
  seriesIdText: string,
  key: BulletinKey,
): string | null {
  // `column <LETTER> "<KEY>"`: one or more A–Z letters, then the exact key in
  // double quotes. The key is interpolated verbatim; it is a fixed identifier
  // of upper/lower letters and underscores, so it carries no regex metachars.
  const pattern = new RegExp(`column\\s+([A-Z]+)\\s+"${key}"`);
  const match = pattern.exec(seriesIdText);
  return match ? match[1] : null;
}

/**
 * Compare each Bulletin catalogue entry's declared column letter against the
 * letter the Adapter actually found the key in (`BulletinResult.columns`).
 *
 * A difference (or a catalogue entry missing the `column <LETTER> "<KEY>"`
 * phrase) throws {@link PrefetchError} of kind `column_letter`, naming the
 * catalogue letter, the found letter and the key, so task 5's operator knows
 * exactly which single letter in `catalogue.ts` to correct (R4.4). Nothing is
 * written. Today both match (`C`, `D`), so this never throws.
 */
function checkColumnLetters(columns: Record<BulletinKey, string>): void {
  for (const { metricId, key } of BULLETIN_SERIES) {
    const entry = CATALOGUE.find((s) => s.metric.id === metricId);
    if (entry === undefined) {
      // A Bulletin metric id missing from the catalogue is a wiring error, not
      // a data condition; fail the run rather than silently skipping the check.
      throw new PrefetchError(
        "column_letter",
        `column_letter ${key}: catalogue has no series ${metricId}`,
        null,
      );
    }

    const catalogueLetter = catalogueColumnLetter(entry.metric.series_id, key);
    const foundLetter = columns[key];

    if (catalogueLetter === null) {
      throw new PrefetchError(
        "column_letter",
        `column_letter ${key}: catalogue declares no column, source found ${foundLetter}`,
        null,
      );
    }

    if (catalogueLetter !== foundLetter) {
      throw new PrefetchError(
        "column_letter",
        `column_letter ${key}: catalogue column ${catalogueLetter}, source found ${foundLetter}`,
        null,
      );
    }
  }
}

// --- Existing figures --------------------------------------------------------

/**
 * Parse the committed figure file into the existing {@link FigureV1}[], or an
 * empty array when there is none yet (`existingJson === null`, the first run).
 *
 * Reuses {@link loadFigureFile} against the live {@link CATALOGUE} so a corrupt
 * or out-of-catalogue committed file fails the run exactly as it would at load
 * time: its `FigureDataError` propagates unchanged (design.md "Prefetch" step 6
 * loads the *output*; this loads the *input* so a bad committed file is caught
 * before anything is merged). Figures are returned exactly as parsed — values
 * and `retrieved_at` are never recomputed (data-integrity.md).
 */
function parseExisting(existingJson: unknown | null): FigureV1[] {
  if (existingJson === null) return [];
  const loaded = loadFigureFile(existingJson, CATALOGUE);
  const figures: FigureV1[] = [];
  for (const series of loaded.series.values()) {
    for (const fig of series.figures) figures.push(fig);
  }
  return figures;
}

// --- Fresh series ------------------------------------------------------------

/**
 * Build the {@link FreshSeries}[] the refresh merges, one per catalogue series
 * that this script downloads, in catalogue order (design.md "Prefetch" step 3):
 *
 *  - `us-gasoline-regular` and `us-diesel` take their points from the matching
 *    {@link EiaResult}, paired by `series_id`.
 *  - `eu-petrol-euro95` and `eu-diesel` take their points from the matching
 *    {@link BulletinResult} series, paired by header key.
 *
 * Each series' points carry that download's own `downloadedAt` and the series'
 * reference `sourceUrl` from {@link SOURCE_URL}; the merge tags each added
 * figure with them (data-integrity.md: every figure carries `retrieved_at` and
 * `source_url`). Points are passed through exactly as the Adapter read them;
 * nothing is invented, estimated, reordered or filled.
 */
function buildFresh(
  eiaResults: readonly EiaResult[],
  bulletin: BulletinResult,
): FreshSeries[] {
  const fresh: FreshSeries[] = [];

  // Index the EIA downloads by series id. Every EIA_SERIES id is fetched by
  // runPrefetch before this is called, so a miss is an internal wiring fault,
  // not a data condition — it is never a PrefetchError kind.
  const eiaBySeriesId = new Map<string, EiaResult>();
  for (const result of eiaResults) eiaBySeriesId.set(result.seriesId, result);

  for (const { metricId, seriesId } of EIA_SERIES) {
    const result = eiaBySeriesId.get(seriesId);
    if (result === undefined) {
      throw new Error(
        `runPrefetch: no EIA download for series ${seriesId} (${metricId})`,
      );
    }
    fresh.push({
      metricId,
      points: result.result.points,
      downloadedAt: result.downloadedAt,
      sourceUrl: SOURCE_URL[metricId],
    });
  }

  // Bulletin: one download carries both EU series, keyed by header key.
  for (const { metricId, key } of BULLETIN_SERIES) {
    fresh.push({
      metricId,
      points: bulletin.series[key].points,
      downloadedAt: bulletin.downloadedAt,
      sourceUrl: SOURCE_URL[metricId],
    });
  }

  return fresh;
}

// --- Coverage check (R6.5) ---------------------------------------------------

/**
 * The latest start the merged file may have for any series: each series' very
 * first figure must fall on or before this date, so every series reaches back
 * through the demo windows. String comparison of `YYYY-MM-DD` matches the
 * figures layer's own weekly ordering.
 */
const COVERAGE_LATEST_START = "2023-06-07";

/**
 * Check that each catalogue series' earliest figure period is on or before
 * {@link COVERAGE_LATEST_START} (design.md "Prefetch" step 5, R6.5). A series
 * whose earliest period is later — or a series with no figures at all — throws
 * {@link PrefetchError} of kind `coverage`, naming the series and that earliest
 * period, and carrying the merge `report` so the entry can still print what the
 * run found. The message states only the series id and the date; it makes no
 * judgement about any value (neutrality.md).
 */
function checkCoverage(figures: readonly FigureV1[], report: Report): void {
  for (const series of CATALOGUE) {
    const metricId = series.metric.id;

    let earliest: string | null = null;
    for (const fig of figures) {
      if (fig.metric_id !== metricId) continue;
      if (earliest === null || fig.period < earliest) earliest = fig.period;
    }

    if (earliest === null) {
      throw new PrefetchError(
        "coverage",
        `coverage ${metricId}: no figures`,
        report,
      );
    }

    if (earliest > COVERAGE_LATEST_START) {
      throw new PrefetchError(
        "coverage",
        `coverage ${metricId}: earliest ${earliest} after ${COVERAGE_LATEST_START}`,
        report,
      );
    }
  }
}

// --- Run ---------------------------------------------------------------------

/**
 * Run both Adapters and the refresh over the existing figures, and return the
 * serialised figure file that would be written (design.md "Prefetch"). It
 * touches no file; reading and writing are the script entry's job (task 5).
 *
 * In order:
 *
 *  1. `fetchEiaSeries` for the two EIA IDs and `fetchBulletin` once, run
 *     sequentially so a thrown `SourceError` names exactly one publisher.
 *  2. The column-letter check (R4.4): each Bulletin catalogue entry's
 *     `column <LETTER> "<KEY>"` text is compared with the letter the Adapter
 *     found the key in; a difference is a `column_letter` {@link PrefetchError}.
 *  3. Build the fresh series (each download's points tagged with its
 *     `downloadedAt` and the series' reference URL), parse the committed
 *     figures, `mergeRefresh` (a backfill becomes a `backfill`
 *     {@link PrefetchError}), the coverage check (a series starting after
 *     {@link COVERAGE_LATEST_START} is a `coverage` {@link PrefetchError}),
 *     `serialiseFigureFile`, and prove the text loads with `loadFigureFile`
 *     (its `FigureDataError` propagates). It returns `{ text, report }`.
 *
 * `deps.fetcher` and `deps.now` are threaded into both Adapters so tests drive
 * the whole run from recorded bytes and a fixed clock with no network (R2.6).
 */
export async function runPrefetch(
  existingJson: unknown | null,
  deps?: PrefetchDeps,
): Promise<{ text: string; report: Report }> {
  const adapterDeps: AdapterDeps = { fetcher: deps?.fetcher, now: deps?.now };

  // 1. Both Adapters, sequentially: a failure throws a SourceError naming the
  //    one publisher it was reading (eia or oil-bulletin), never a mix.
  const eiaResults: EiaResult[] = [];
  for (const { seriesId } of EIA_SERIES) {
    eiaResults.push(await fetchEiaSeries(seriesId, adapterDeps));
  }
  const bulletin: BulletinResult = await fetchBulletin(adapterDeps);

  // 2. Column-letter check (R4.4): throws `column_letter` on any difference,
  //    before any merge or file is produced.
  checkColumnLetters(bulletin.columns);

  // 3. Build the fresh series (points tagged with each download's time and the
  //    series' reference URL) and parse the committed figures, if any.
  const existing = parseExisting(existingJson);
  const fresh = buildFresh(eiaResults, bulletin);

  // 4. Append-only merge. A backfill fails the whole run: nothing is written.
  const merged = mergeRefresh(existing, fresh);
  if (!merged.ok) {
    throw new PrefetchError(
      "backfill",
      "backfill: a fresh period is earlier than the series' latest existing period",
      merged.report,
    );
  }

  // 5. Coverage check (R6.5): every series must reach back to COVERAGE window.
  checkCoverage(merged.figures, merged.report);

  // 6. Serialise deterministically, then prove the text loads against the
  //    catalogue. A FigureDataError from loadFigureFile propagates unchanged.
  const text = serialiseFigureFile(merged.figures);
  loadFigureFile(JSON.parse(text), CATALOGUE);

  return { text, report: merged.report };
}
