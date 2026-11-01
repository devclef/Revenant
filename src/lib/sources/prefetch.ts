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
import { fetchBulletin } from "./oil-bulletin";
import type { BulletinKey } from "./oil-bulletin";
import {
  mergeRefresh,
  serialiseFigureFile,
  type FreshSeries,
  type Report,
} from "./refresh";
import type { Fetcher } from "./types";

// `fetchEiaSeries`, `fetchBulletin`, `mergeRefresh`, `serialiseFigureFile`,
// `loadFigureFile`, `CATALOGUE` and `FigureDataError` are the documented surface
// `runPrefetch` uses; `BulletinKey` and `FreshSeries` are the types it builds
// the fresh series and the column check from. The implementation lands in
// tasks 2 and 3; reference them here so the imports stay used until then.
void fetchEiaSeries;
void fetchBulletin;
void mergeRefresh;
void serialiseFigureFile;
void loadFigureFile;
void CATALOGUE;
void FigureDataError;
type _UsedTypes = BulletinKey | FreshSeries;
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
