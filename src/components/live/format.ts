// Display formatting for the Seal_Page and sealed view. Display only: nothing
// here decides whether a letter is open. Pure module: no I/O.
//
// Letter DATES are written one way, by the one letter-date module
// (`@/components/ui/letter-date`), so this file never formats a date itself
// (spec 08 R15.1, R15.5). What stays here is the TIME-of-day half of a live
// seal/open line: `formatLocalTime` is the only `Intl.DateTimeFormat` the R15.5
// source scan allows under `live/`, and it formats a time and its zone name
// only, never a date.

import {
  browserTimeZone,
  formatLetterDate,
  letterZoneFor,
} from "@/components/ui/letter-date";

// Time of day and short zone name in the reader's local zone, e.g. "12:00 CET".
// Left zone-unset so it follows the runtime's own zone, which is the browser's
// on the client. Its resolved zone is reused for the date half, so the date and
// time of a live seal line always read in the same zone.
const LOCAL_TIME = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  timeZoneName: "short",
});

/**
 * Formats the time of day of a UTC ISO instant in the reader's local zone, for
 * example "12:00 CET". Times only: it never writes a date (letter dates go
 * through the letter-date module). Returns "" when the input is not a date.
 */
export function formatLocalTime(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  return LOCAL_TIME.format(new Date(ms));
}

/**
 * Formats a UTC ISO instant as a live letter's local date and time, for example
 * "30 October 2026, 12:00 CET". The date half comes from the one letter-date
 * module in the browser's own zone (a Live_Letter opens on the same device it
 * was sealed on); the time half comes from `formatLocalTime`. Returns "" when
 * the input is not a date.
 */
export function formatLocalDateTime(iso: string): string {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "";
  // The browser's own zone, so the date and the local time agree.
  const zone = letterZoneFor("live", iso, browserTimeZone());
  return `${formatLetterDate(iso, zone)}, ${formatLocalTime(iso)}`;
}

function plural(count: number, unit: string): string {
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

/**
 * Formats a number of seconds as plain words, for example "1 minute 5
 * seconds". Fractions are dropped and negative values read as zero.
 */
export function formatRemaining(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(plural(hours, "hour"));
  if (minutes > 0) parts.push(plural(minutes, "minute"));
  if (secs > 0 || parts.length === 0) parts.push(plural(secs, "second"));
  return parts.join(" ");
}
