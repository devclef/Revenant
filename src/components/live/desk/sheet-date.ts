/**
 * Date text for the Write step's Letter_Sheet and the dated own-number line
 * (spec 14, W4.2, W12.2). Pure module: no React, no clock. Every function
 * takes the instant or day it formats, so the same input always gives the same
 * text.
 *
 * The text is assembled from `Intl.DateTimeFormat` parts in en-GB, so the
 * comma after the weekday is ours and the shape is exact whatever the runtime's
 * ICU data for en-GB.
 */

const SHEET_OPTIONS = {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
} as const;

const DAY_OPTIONS = {
  day: "numeric",
  month: "long",
  year: "numeric",
} as const;

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The text of one part type from a formatter's output, or "" when absent. */
function partsByType(
  formatter: Intl.DateTimeFormat,
  date: Date,
): (type: Intl.DateTimeFormatPartTypes) => string {
  const parts = formatter.formatToParts(date);
  return (type) => parts.find((part) => part.type === type)?.value ?? "";
}

/**
 * "Tuesday, 17 November 2026" for the instant, as the calendar day it falls on
 * in the given IANA zone. Returns "" for an invalid instant.
 */
export function formatSheetDate(instant: Date, timeZone: string): string {
  if (Number.isNaN(instant.getTime())) return "";
  const by = partsByType(
    new Intl.DateTimeFormat("en-GB", { ...SHEET_OPTIONS, timeZone }),
    instant,
  );
  return `${by("weekday")}, ${by("day")} ${by("month")} ${by("year")}`;
}

/**
 * "17 November 2026" for a YYYY-MM-DD calendar day. Returns "" when the input
 * is not a real calendar day (for example "2026-02-30" or "2026-13-01").
 */
export function formatDatedDay(day: string): string {
  const match = DAY_PATTERN.exec(day);
  if (!match) return "";
  const year = Number(match[1]);
  const month = Number(match[2]);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, Number(match[3]));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== Number(match[3])
  ) {
    return "";
  }
  const by = partsByType(
    new Intl.DateTimeFormat("en-GB", { ...DAY_OPTIONS, timeZone: "UTC" }),
    date,
  );
  return `${by("day")} ${by("month")} ${by("year")}`;
}

/**
 * The calendar day of the instant in the given IANA zone, as YYYY-MM-DD.
 * Returns "" for an invalid instant.
 */
export function localCalendarDay(instant: Date, timeZone: string): string {
  if (Number.isNaN(instant.getTime())) return "";
  const by = partsByType(
    new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      timeZone,
    }),
    instant,
  );
  const pad = (value: string): string => value.padStart(2, "0");
  return `${by("year")}-${pad(by("month"))}-${pad(by("day"))}`;
}
