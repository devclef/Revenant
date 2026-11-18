/**
 * Date text for the Write step's Letter_Sheet and the dated own-number line
 * (spec 14, W4.2, W12.2). Pure module: no clock. Every function takes the
 * instant or day it formats, so the same input always gives the same text.
 *
 * The Intl formatting lives in `components/ui/letter-date.ts`, the one
 * letter-date module (spec 08 R15.5). This file only checks input and calls it.
 */

import {
  calendarDayIn,
  formatCalendarDate,
  formatWeekdayDate,
} from "@/components/ui/letter-date";

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * "Tuesday, 17 November 2026" for the instant, as the calendar day it falls on
 * in the given IANA zone. Returns "" for an invalid instant.
 */
export function formatSheetDate(instant: Date, timeZone: string): string {
  return formatWeekdayDate(instant, timeZone);
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
  const dayOfMonth = Number(match[3]);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, dayOfMonth);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== dayOfMonth
  ) {
    return "";
  }
  return formatCalendarDate(day);
}

/**
 * The calendar day of the instant in the given IANA zone, as YYYY-MM-DD.
 * Returns "" for an invalid instant.
 */
export function localCalendarDay(instant: Date, timeZone: string): string {
  return calendarDayIn(instant, timeZone);
}
