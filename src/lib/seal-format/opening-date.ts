// The 3-calendar-month rule for real letters (spec 08-judge-polish, R24.2,
// R24.3, R24.4 and design.md "Real sealing").
//
// A real letter opens at 00:00 of a picked date in the user's zone, and the
// server accepts it only when that instant is at least three calendar months
// after the server's UTC clock. The browser uses the same rules to offer the
// earliest date, so the route and the browser agree.
//
// Pure module: no imports, safe for browser and server. Changing a constant
// here changes which letters the server accepts.

/** Time between picking a date and storing the letter, in milliseconds (15 minutes). */
export const SEAL_MARGIN_MS = 900_000;

/** Minimum calendar months between sealing and opening for a real letter. */
export const REAL_LOCK_MONTHS = 3;

const DAY_MS = 86_400_000;

// One formatter per zone. Creating one is slow, and the binary search calls it often.
const formatterCache = new Map<string, Intl.DateTimeFormat>();

interface WallParts {
  year: number;
  month: number; // 1-12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

// Adds whole calendar months to a wall-clock time, clamping the day to the
// last day of the target month. Returns the wall-clock time as if it were UTC.
function addMonthsWall(p: WallParts, ms: number, months: number): number {
  const first = new Date(Date.UTC(p.year, p.month - 1 + months, 1));
  const year = first.getUTCFullYear();
  const monthIndex = first.getUTCMonth();
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const day = Math.min(p.day, lastDay);
  return Date.UTC(year, monthIndex, day, p.hour, p.minute, p.second) + ms;
}

// Wall-clock parts of an instant in a zone. Uses Intl parts, so it follows
// the zone's current rules, DST included.
function zoneParts(instantMs: number, timeZone: string): WallParts {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatterCache.set(timeZone, formatter);
  }
  const parts: Record<string, number> = {};
  for (const part of formatter.formatToParts(new Date(instantMs))) {
    if (part.type !== "literal") parts[part.type] = Number(part.value);
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second,
  };
}

// Offset of a zone from UTC at an instant, in milliseconds. Positive east of UTC.
function zoneOffsetMs(instantMs: number, timeZone: string): number {
  const p = zoneParts(instantMs, timeZone);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const wholeSecond = Math.floor(instantMs / 1000) * 1000;
  return wallAsUtc - wholeSecond;
}

// Date key "YYYY-MM-DD" of an instant in a zone. Lexical order equals date order.
function localDateKey(instantMs: number, timeZone: string): string {
  const p = zoneParts(instantMs, timeZone);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

// Converts a wall-clock time in a zone to an instant. Two passes, so the offset
// is read at the instant it applies to rather than at the wall-clock value.
function wallToInstant(wallMs: number, timeZone: string): number {
  const firstGuess = wallMs - zoneOffsetMs(wallMs, timeZone);
  return wallMs - zoneOffsetMs(firstGuess, timeZone);
}

function parseDateKey(date: string): { year: number; month: number; day: number } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    throw new RangeError(`Expected a YYYY-MM-DD date, got "${date}"`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new RangeError(`"${date}" is not a real calendar date`);
  }
  return { year, month, day };
}

/**
 * Adds calendar months to an instant on the UTC calendar. The time of day is
 * kept. When the target month is shorter, the result is that month's last day.
 */
export function addCalendarMonthsUtc(instantMs: number, months: number): number {
  const wallParts = utcParts(instantMs);
  const ms = ((instantMs % 1000) + 1000) % 1000;
  return addMonthsWall(wallParts, ms, months);
}

/**
 * Adds calendar months to an instant on the calendar of `timeZone`. The local
 * time of day is kept, and the result is converted back to an instant. When the
 * target month is shorter, the result is that month's last day.
 */
export function addCalendarMonthsLocal(
  instantMs: number,
  months: number,
  timeZone: string,
): number {
  const p = zoneParts(instantMs, timeZone);
  const ms = instantMs - Math.floor(instantMs / 1000) * 1000;
  return wallToInstant(addMonthsWall(p, ms, months), timeZone);
}

/**
 * The instant of 00:00 on the picked date `YYYY-MM-DD` in `timeZone`, as an ISO
 * UTC string with milliseconds. When 00:00 does not exist that day (a DST gap
 * at midnight), the result is the first instant of that day.
 */
export function opensAtFor(date: string, timeZone: string): string {
  const { year, month, day } = parseDateKey(date);
  // Local dates are monotone in time, so binary search finds the first instant
  // whose local date is the picked date. For a normal midnight this is exactly
  // 00:00. For a gap at midnight it is the first instant after the gap.
  let lo = Date.UTC(year, month - 1, day) - 26 * 3_600_000; // local date is before date
  let hi = Date.UTC(year, month - 1, day) + 26 * 3_600_000; // local date is date or later
  while (hi - lo > 1) {
    const mid = Math.floor((lo + hi) / 2);
    if (localDateKey(mid, timeZone) >= date) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return new Date(hi).toISOString();
}

/**
 * The first date `YYYY-MM-DD`, in `timeZone`, whose `opensAtFor` is at or after
 * the real lock threshold for a seal at `nowMs`. The threshold is the later of
 * the local and the UTC three-month rules, plus `SEAL_MARGIN_MS`. The later of
 * the two is taken because a browser east of UTC near a month end could
 * otherwise offer a date that the server rejects.
 */
export function earliestOpeningDate(nowMs: number, timeZone: string): string {
  const threshold =
    Math.max(
      addCalendarMonthsLocal(nowMs, REAL_LOCK_MONTHS, timeZone),
      addCalendarMonthsUtc(nowMs, REAL_LOCK_MONTHS),
    ) + SEAL_MARGIN_MS;
  // The date that contains the threshold, one day earlier for safety.
  const start = localDateKey(threshold, timeZone);
  let candidate = addDaysToKey(start, -1);
  for (let guard = 0; guard < 10; guard++) {
    if (Date.parse(opensAtFor(candidate, timeZone)) >= threshold) {
      return candidate;
    }
    candidate = addDaysToKey(candidate, 1);
  }
  throw new Error("earliestOpeningDate did not converge");
}

/**
 * True when a real letter's `opens_at` is at or after the server's UTC clock
 * plus REAL_LOCK_MONTHS calendar months. Matches the `letters_opens_at_min_lock`
 * database check (`sealed_at + interval '3 months'`).
 */
export function meetsRealLock(opensAtMs: number, serverNowMs: number): boolean {
  return opensAtMs >= addCalendarMonthsUtc(serverNowMs, REAL_LOCK_MONTHS);
}

function utcParts(instantMs: number): WallParts {
  const d = new Date(instantMs);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
    hour: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    second: d.getUTCSeconds(),
  };
}

function addDaysToKey(key: string, days: number): string {
  const { year, month, day } = parseDateKey(key);
  const next = new Date(Date.UTC(year, month - 1, day) + days * DAY_MS);
  return next.toISOString().slice(0, 10);
}
