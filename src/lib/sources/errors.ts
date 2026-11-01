// Error type for the data-source adapters (04-real-figures).
//
// Pure runtime module: no process.env, no console, and no import of
// @/lib/crypto, @/lib/db or @/lib/letter-store. Nothing outside
// src/lib/sources imports this folder (enforced by boundary.test.ts, R6.7).
//
// Every SourceError carries a fixed, neutral message that names the publisher,
// the kind, and the identifying detail (URL, status, series IDs, header key,
// row number, date). It never contains cell contents beyond the single
// offending value in `bad_cell`, and never any banned direction word
// (rose, fell, improved, worsened, corrected, revised) — see neutrality.md.

/** The publisher an adapter is reading from. */
export type SourcePublisher = "eia" | "oil-bulletin";

/** The kinds of failure an adapter can report. */
export type SourceErrorKind =
  | "auth_required" // 401, 403, 407 (R2.3)
  | "http_status" // any other non-2xx
  | "network" // fetch threw or timed out
  | "empty_body" // 0 bytes
  | "wrong_host" // request or final URL host not in the allowed set (R2.5)
  | "unreadable_file" // the parser could not open the bytes
  | "link_not_found" // Bulletin page has zero or several matching links
  | "series_mismatch" // EIA: Sourcekey differs or is missing (R3.2)
  | "unit_mismatch" // EIA title unit, or Bulletin unit label (R3.3, R4.3)
  | "sheet_missing" // R4.2
  | "header_missing" // R4.2, incl. the date column header
  | "header_duplicated" // R4.2
  | "bad_date" // R3.6, R4.7
  | "duplicate_date" // R4.8
  | "bad_cell" // R5.6
  | "bad_row_marker" // Bulletin column B is not "EU_" on a row that would be emitted
  | "date_system"; // workbook uses the 1904 date system

/**
 * The identifying detail attached to a SourceError, by kind. Only fields that
 * identify the failure are allowed: a URL, an HTTP status, series IDs, a header
 * key, a row number or a date. `bad_cell` may carry the single offending cell
 * value and nothing more of the cell's contents.
 */
export interface SourceErrorDetail {
  /** The request or final URL (wrong_host, network, http_status, auth_required, link_not_found). */
  url?: string;
  /** The HTTP status (auth_required, http_status). */
  status?: number;
  /** The series ID the adapter expected (series_mismatch, bad_cell). */
  expectedSeriesId?: string;
  /** The series ID actually found, or "none" if missing (series_mismatch). */
  foundSeriesId?: string;
  /** A sheet name (sheet_missing). */
  sheet?: string;
  /** A header key or label (header_missing, header_duplicated, unit_mismatch). */
  headerKey?: string;
  /** The found unit label (unit_mismatch). */
  foundUnit?: string;
  /** A 1-based row number (bad_date, bad_cell, bad_row_marker). */
  row?: number;
  /** A YYYY-MM-DD date (bad_date, duplicate_date, bad_cell). */
  date?: string;
  /** The single offending cell value (bad_cell only). */
  cellValue?: string;
  /** The found column-B marker (bad_row_marker). */
  marker?: string;
}

/** Words that would editorialise about a change. Never allowed in a message. */
const BANNED_DIRECTION_WORDS = [
  "rose",
  "fell",
  "improved",
  "worsened",
  "corrected",
  "revised",
] as const;

/**
 * Build the fixed, neutral message for a SourceError. The message always starts
 * with the publisher and kind, then appends only the identifying detail present
 * in `detail`. It is deliberately literal and carries no judgement.
 */
function buildMessage(
  publisher: SourcePublisher,
  kind: SourceErrorKind,
  detail: SourceErrorDetail,
): string {
  const parts: string[] = [`${publisher}: ${kind}`];

  if (detail.status !== undefined) parts.push(`status ${detail.status}`);
  if (detail.url !== undefined) parts.push(`url ${detail.url}`);
  if (detail.sheet !== undefined) parts.push(`sheet "${detail.sheet}"`);
  if (detail.headerKey !== undefined) parts.push(`header "${detail.headerKey}"`);
  if (detail.expectedSeriesId !== undefined)
    parts.push(`expected series ${detail.expectedSeriesId}`);
  if (detail.foundSeriesId !== undefined)
    parts.push(`found series ${detail.foundSeriesId}`);
  if (detail.foundUnit !== undefined) parts.push(`found unit "${detail.foundUnit}"`);
  if (detail.marker !== undefined) parts.push(`marker "${detail.marker}"`);
  if (detail.row !== undefined) parts.push(`row ${detail.row}`);
  if (detail.date !== undefined) parts.push(`date ${detail.date}`);
  if (detail.cellValue !== undefined) parts.push(`cell value "${detail.cellValue}"`);

  const message = parts.join(", ");

  // Guard the neutrality invariant at construction time: a message must never
  // contain a banned direction word, even by accident through a detail field.
  const lower = message.toLowerCase();
  for (const word of BANNED_DIRECTION_WORDS) {
    if (new RegExp(`\\b${word}\\b`).test(lower)) {
      throw new Error(
        `SourceError message would contain banned direction word "${word}"`,
      );
    }
  }

  return message;
}

/**
 * An error raised by a source adapter. Its `message` is fixed text naming the
 * publisher, the kind and the identifying detail; it never carries cell
 * contents beyond the single offending value in `bad_cell`, and never a banned
 * direction word.
 */
export class SourceError extends Error {
  readonly publisher: SourcePublisher;
  readonly kind: SourceErrorKind;
  readonly detail: SourceErrorDetail;

  constructor(
    publisher: SourcePublisher,
    kind: SourceErrorKind,
    detail: SourceErrorDetail = {},
  ) {
    super(buildMessage(publisher, kind, detail));
    this.name = "SourceError";
    this.publisher = publisher;
    this.kind = kind;
    this.detail = detail;
    // Restore the prototype chain under transpilation targets below ES2015.
    Object.setPrototypeOf(this, SourceError.prototype);
  }
}
