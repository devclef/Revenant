// Prefetch_Script core (spec 04-real-figures, task 5). `runPrefetch` runs both
// Adapters, checks the Bulletin column letters against the catalogue, builds the
// fresh series, merges them append-only with backfill refusal, checks coverage,
// serialises the figure file and proves it loads — all without touching a file.
// Reading and writing the Real_File is the caller's job (the script entry).
//
// Pure dev-side module. It imports only the two Adapters, the append-only
// refresh and the figures model (CATALOGUE, loadFigureFile, FigureDataError).
// It performs no file access, no network beyond the Adapters, reads no
// environment variable and logs nothing. Nothing here depends on the browser or
// the server runtime, and nothing in the app or the image imports it (R6.7).
//
// Data integrity (data-integrity.md, neutrality.md): no number is invented,
// estimated or filled; existing figures are carried through exactly as parsed.
// Every error message states only what happened and never says a value rose,
// fell, improved, worsened, was corrected or revised.

import { CATALOGUE, FigureDataError, loadFigureFile } from "@/lib/figures";

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

// `mergeRefresh`, `serialiseFigureFile`, `loadFigureFile` and `FigureDataError`
// are the documented surface the second half of `runPrefetch` uses (task 3);
// `FreshSeries` is the type it builds the fresh series from. The first half
// (both Adapters and the column-letter check) is implemented below, in task 2;
// reference the task-3 surface here so the imports stay used until then.
void mergeRefresh;
void serialiseFigureFile;
void loadFigureFile;
void FigureDataError;
type _UsedTypes = FreshSeries;
void (0 as unknown as _UsedTypes);

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
 * fresh series (task 3) and the column-letter check (below) know which of the
 * two {@link BulletinResult} series belongs to which catalogue entry.
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
 * the Weekly Oil Bulletin landing page. Task 3 tags each fresh point with the
 * URL for its metric id.
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

// SOURCE_URL is consumed by the fresh-series build in task 3; reference it here
// so the table stays used until then without inventing a premature caller.
void SOURCE_URL;

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
 *  3. (task 3) Build the fresh series, `mergeRefresh`, the coverage check,
 *     `serialiseFigureFile`, and prove the text loads with `loadFigureFile`.
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

  // 3. The fresh-series build, merge, coverage check and serialise/round-trip
  //    land in task 3. `eiaResults` and `bulletin` feed that step.
  void existingJson;
  void eiaResults;
  throw new Error("runPrefetch: merge and serialise not implemented (task 3)");
}
