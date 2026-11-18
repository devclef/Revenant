/**
 * The "you wrote this on {date}" day for a live or real letter's recall
 * counter (spec 14, T1.2). Pure module: it takes the instant it formats, so the
 * same input always gives the same text.
 *
 * The Intl formatting lives in `components/ui/letter-date.ts`, the one
 * letter-date module (spec 08 R15.5). This file only picks the calendar day
 * and calls it.
 */

import { calendarDayIn, formatCalendarDate } from "@/components/ui/letter-date";

/**
 * "17 November 2026": the calendar day of the ISO instant in `timeZone`, in
 * the en-GB long form. Returns "" when the instant is not a date.
 */
export function formatWrittenOn(sealedAtIso: string, timeZone: string): string {
  const ms = Date.parse(sealedAtIso);
  if (Number.isNaN(ms)) return "";
  const day = calendarDayIn(new Date(ms), timeZone);
  return formatCalendarDate(day);
}
