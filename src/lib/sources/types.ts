// Shared types for the data-source adapters (04-real-figures).
//
// Pure type module: no runtime code, no process.env, no console, and no import
// of @/lib/crypto, @/lib/db or @/lib/letter-store. Nothing outside
// src/lib/sources imports this folder (enforced by boundary.test.ts, R6.7).

/** The result of a single download: the HTTP status, final URL and raw bytes. */
export interface FetchResult {
  status: number;
  url: string;
  body: Uint8Array;
}

/**
 * A function that downloads one URL and returns its status, final URL and body.
 * The concrete implementation and the allowed-host check live in `fetcher.ts`;
 * this type is declared here so the pure type module is self-contained.
 */
export type Fetcher = (url: string) => Promise<FetchResult>;

/** One sourced figure for a series. `period` is a YYYY-MM-DD calendar date. */
export interface SourceFigure {
  /** YYYY-MM-DD */
  period: string;
  /** The value as a decimal string, at full published precision. */
  value: string;
}

/**
 * A period the source covers but for which no usable number was published.
 * `no_number` = the value cell was empty; `not_a_number` = it held text.
 * A gap is reported, never filled or estimated (data-integrity.md).
 */
export interface SourceGap {
  /** YYYY-MM-DD */
  period: string;
  reason: "no_number" | "not_a_number";
}

/** The result of reading one series: its figures and the gaps found. */
export interface SeriesResult {
  /** Figures, ascending by `period`. */
  points: SourceFigure[];
  gaps: SourceGap[];
}

/**
 * Injectable dependencies for an adapter. Tests pass a `fetcher` that returns
 * recorded bytes (so no adapter touches the network) and a fixed `now`.
 */
export interface AdapterDeps {
  fetcher?: Fetcher;
  now?: () => Date;
}
