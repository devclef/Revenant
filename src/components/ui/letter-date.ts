/**
 * The one letter-date module (spec 08 R15.1, R15.5). It replaces
 * `src/components/demo/dates.ts`, `StillSealed`'s `UTC_DATE`, and the date part
 * of `live/format.ts`. Every letter date in the product is formatted here, so
 * the shape is written one way: the en-GB long form, e.g. "30 October 2026".
 *
 * Pure module: no React, no DOM, no clock. The output is assembled from
 * `Intl.DateTimeFormat` parts (`day` numeric, `month` long, `year` numeric in
 * `en-GB`), so the shape is exact whatever the runtime's ICU data, and never
 * depends on the host locale.
 *
 * A letter's opening and sealing dates are shown in the letter's own zone
 * (`formatLetterDate` with the `LetterZone` from `letterZoneFor`), so the date
 * reads the same for every viewer. A `retrieved_at` is an instant of Revenant's
 * fetch, not a letter-zone date, so it always uses UTC.
 */

import { formatPeriod } from "@/lib/figures/format-change";

/**
 * The zone a letter's dates are shown in. `utc` for personas; a fixed offset
 * derived from a Real_Letter's `opens_at`; or an IANA zone for a Live_Letter
 * (the browser's own zone at sealing).
 */
export type LetterZone =
  | { kind: "utc" }
  | { kind: "fixed"; offsetMinutes: number }
  | { kind: "iana"; timeZone: string };

/** The fields every letter-date formatter assembles, in en-GB. */
const DATE_PART_OPTIONS = {
  day: "numeric",
  month: "long",
  year: "numeric",
} as const;

/** Assemble the en-GB long-form date from an `Intl.DateTimeFormat`. */
function formatWith(formatter: Intl.DateTimeFormat, date: Date): string {
  // Reading the parts and reassembling them keeps the exact "30 October 2026"
  // shape whatever the runtime's ICU data for en-GB, which can vary in
  // separators and ordering across engines.
  const parts = formatter.formatToParts(date);
  const by = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${by("day")} ${by("month")} ${by("year")}`;
}

/** The UTC formatter, reused for every `utc` zone and for `formatCalendarDate`. */
const UTC_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  ...DATE_PART_OPTIONS,
  timeZone: "UTC",
});

/**
 * Format an ISO instant as the calendar date it falls on in `zone`, as
 * "30 October 2026". Returns "" when the input is not a date.
 */
export function formatLetterDate(instant: string, zone: LetterZone): string {
  const ms = Date.parse(instant);
  if (Number.isNaN(ms)) return "";

  if (zone.kind === "utc") {
    return formatWith(UTC_FORMATTER, new Date(ms));
  }

  if (zone.kind === "iana") {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      ...DATE_PART_OPTIONS,
      timeZone: zone.timeZone,
    });
    return formatWith(formatter, new Date(ms));
  }

  // A fixed offset. Shift the instant by the offset, then read it in UTC, so
  // the calendar date is the local date in that offset. No IANA zone needed.
  const shifted = new Date(ms + zone.offsetMinutes * 60_000);
  return formatWith(UTC_FORMATTER, shifted);
}

/**
 * Format a plain calendar date given as `YYYY-MM-DD`
 * (e.g. `persona.written_as_of`) as "12 May 2024".
 *
 * The date is read at UTC midnight so the day never shifts under the viewer's
 * timezone.
 */
export function formatCalendarDate(date: string): string {
  const ms = Date.parse(`${date}T00:00:00.000Z`);
  if (Number.isNaN(ms)) return "";
  return formatWith(UTC_FORMATTER, new Date(ms));
}

/** The UTC month-and-year formatter, reused by `formatCalendarMonth`. */
const UTC_MONTH_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Format a plain calendar date given as `YYYY-MM-DD` as its month and year in
 * en-GB, e.g. "May 2024" for "2024-05-12" (spec 10 C4.2, the Memory_Line). Read
 * at UTC midnight, so the month never shifts under the viewer's timezone.
 * Returns "" when the input is not a date.
 */
export function formatCalendarMonth(date: string): string {
  const ms = Date.parse(`${date}T00:00:00.000Z`);
  if (Number.isNaN(ms)) return "";
  const parts = UTC_MONTH_FORMATTER.formatToParts(new Date(ms));
  const by = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${by("month")} ${by("year")}`;
}

/**
 * The runtime's own IANA zone (the browser's zone on the client), for passing
 * to `letterZoneFor` for a Live_Letter. Kept here so callers never construct
 * their own `Intl.DateTimeFormat` (R15.5). Falls back to "UTC" if the runtime
 * cannot resolve a zone.
 */
export function browserTimeZone(): string {
  try {
    return new Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** Minutes of day of an instant in UTC (0 to 1439). */
function utcMinutesOfDay(ms: number): number {
  const date = new Date(ms);
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}

/**
 * The zone a letter's opening and sealing dates are shown in (spec 08 R15.1).
 *
 * - `persona`: `utc`. A persona's `opens_at` is 00:00 UTC.
 * - `live`: the browser's own IANA zone. A Live_Letter opens 30 seconds after
 *   sealing on the same device, so the browser zone is the sealing zone.
 * - `real`: the opening is 00:00 in the sealing zone, so `opens_at` itself
 *   carries the sealing offset. If `opens_at` is 00:00 in the browser's zone,
 *   that zone is used. Otherwise a fixed offset is derived: with `t` the UTC
 *   minutes of day of `opens_at`, the offset is `-t` when `t` lies in (−12:00,
 *   0], else `24h − t`. When both fit, the west offset is chosen.
 */
export function letterZoneFor(
  kind: "persona" | "live" | "real",
  opensAt: string,
  browserTimeZone: string,
): LetterZone {
  if (kind === "persona") return { kind: "utc" };
  if (kind === "live") return { kind: "iana", timeZone: browserTimeZone };

  // Real_Letter. First prefer the browser's own zone when the opening is local
  // midnight there, so the letter reads in a named zone on the sealing device.
  const ms = Date.parse(opensAt);
  if (Number.isNaN(ms)) return { kind: "iana", timeZone: browserTimeZone };

  if (isLocalMidnight(ms, browserTimeZone)) {
    return { kind: "iana", timeZone: browserTimeZone };
  }

  // Otherwise derive a fixed offset from the UTC time of day of `opens_at`.
  // `t` is minutes east of UTC that would have to be subtracted to reach 00:00.
  const t = utcMinutesOfDay(ms);
  // `-t` reaches local midnight when the sealing zone is west of UTC (offset in
  // (−12:00, 0]); `24h − t` reaches it when east of UTC (offset in (0, +12:00]).
  // The "both fit" band is t in [10:00, 12:00] UTC; there the west offset is
  // chosen.
  const westOffset = -t; // minutes; in [−720, 0)
  const eastOffset = 1440 - t; // minutes; in (720, 1440]
  const westFits = westOffset >= -720 && westOffset <= 0;
  const eastFits = eastOffset >= 0 && eastOffset <= 840; // up to +14:00
  const offsetMinutes = westFits ? westOffset : eastFits ? eastOffset : -t;
  return { kind: "fixed", offsetMinutes };
}

/**
 * Whether `ms` is 00:00 of some calendar day in `timeZone`. Uses the hour and
 * minute parts in that zone; a zone Revenant cannot resolve reads as not
 * midnight, so the caller falls back to a derived offset.
 */
function isLocalMidnight(ms: number, timeZone: string): boolean {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(ms));
    const hour = parts.find((part) => part.type === "hour")?.value;
    const minute = parts.find((part) => part.type === "minute")?.value;
    return hour === "00" && minute === "00";
  } catch {
    return false;
  }
}

/** A full ISO instant with a time and a `Z` or offset, e.g. `2026-10-26T23:30:00Z`. */
const INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

/** A period string: a year, a month or a day (see `formatPeriod`). */
const PERIOD_RE = /^\d{4}(-\d{2}(-\d{2})?)?$/;

/** The UTC short-date formatter, reused by `formatShortDate`. */
const UTC_SHORT_FORMATTER = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * The short date shown beside a figure on the picker and the Receipt_Card
 * (spec 12 K2). Shared so the two cannot drift.
 *
 * - A full ISO instant becomes its UTC calendar date, e.g. "26 Oct 2026". The
 *   viewer's timezone never enters the result.
 * - A period string is shown in its own form through `formatPeriod`: a month
 *   as "Oct 2026", a day as "26 Oct 2026", a year as "2026". No day is invented
 *   for a month or a year.
 * - Anything else returns "".
 */
export function formatShortDate(value: string): string {
  if (INSTANT_RE.test(value)) {
    const ms = Date.parse(value);
    if (Number.isNaN(ms)) return "";
    const parts = UTC_SHORT_FORMATTER.formatToParts(new Date(ms));
    const by = (type: Intl.DateTimeFormatPartTypes): string =>
      parts.find((part) => part.type === type)?.value ?? "";
    return `${by("day")} ${by("month")} ${by("year")}`;
  }

  // Region does not change a period's output (see formatPeriod), so it is not
  // needed here. Only a real period is passed on; formatPeriod would echo any
  // other text back unchanged.
  if (PERIOD_RE.test(value)) return formatPeriod(value, "");
  return "";
}
