// Period helpers for the figures model (spec 02-demo-figures).
//
// A period is either a weekly date ("YYYY-MM-DD") or a month ("YYYY-MM").
// Everything comparable crosses the public API as a plain "YYYY-MM-DD" string:
// no Date objects and no time zones leak out. Date.UTC is used internally only
// to validate calendar dates and to find the last day of a month, then the
// result is formatted back to a string.
//
// Pure module: imports only the PeriodType value type, nothing from
// src/lib/crypto, src/lib/db or Node built-ins.

import type { PeriodType } from "./types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * True when `s` is a real calendar date in "YYYY-MM-DD" form.
 *
 * The regex rejects the wrong shape; the UTC round-trip rejects impossible
 * days (e.g. 2024-02-30, 2024-13-01) by confirming the constructed date's
 * parts match the input exactly.
 */
export function isRealDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const year = Number(s.slice(0, 4));
  const month = Number(s.slice(5, 7));
  const day = Number(s.slice(8, 10));
  const d = new Date(Date.UTC(year, month - 1, day));
  return (
    d.getUTCFullYear() === year &&
    d.getUTCMonth() === month - 1 &&
    d.getUTCDate() === day
  );
}

/**
 * True when `s` is a real month in "YYYY-MM" form with month 01–12.
 */
export function isRealMonth(s: string): boolean {
  if (!MONTH_RE.test(s)) return false;
  const month = Number(s.slice(5, 7));
  return month >= 1 && month <= 12;
}

/**
 * The last day of a period as a "YYYY-MM-DD" string, used for ordering and
 * "at or before" comparisons.
 *
 * - weekly: the period is already a date, returned unchanged.
 * - monthly: the last day of that month (leap years handled by Date.UTC with
 *   day 0 of the following month).
 */
export function periodEnd(period: string, type: PeriodType): string {
  if (type === "weekly") {
    return period;
  }
  const year = Number(period.slice(0, 4));
  const month = Number(period.slice(5, 7));
  // Day 0 of the next month is the last day of this month.
  const d = new Date(Date.UTC(year, month, 0));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}
