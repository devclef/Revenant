// The opening date of a Real_Letter in the browser (spec 08, R15.1). Pure
// module: no React, no storage, no console.
//
// The date is picked as a calendar day. `opensAt` is 00:00 of that day in the
// visitor's zone. The server still decides whether the letter may open; these
// checks only stop a request that is certain to be refused, and they run again
// at each press so a date that became too early is refused before any request.

import { earliestOpeningDate, opensAtFor } from "@/lib/seal-format";
import { formatCalendarDate } from "@/components/ui/letter-date";

import { REAL_COPY } from "./copy";

/** The date the visitor picked, and the zone it opens in. */
export interface RealOpening {
  /** `YYYY-MM-DD`, or null while no date is chosen. */
  opensOn: string | null;
  /** A valid IANA zone (see `resolveTimeZone`). */
  timeZone: string;
}

export type RealOpeningCheck =
  | { ok: true; opensAt: string; userName: string }
  | { ok: false; kind: "invalid_date" | "too_early" };

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The zone to use, or UTC when the candidate is not a zone the runtime knows.
 * `fallback` is true in that case, so the picker can say the opening is at
 * midnight UTC.
 */
export function resolveTimeZone(candidate: string): { timeZone: string; fallback: boolean } {
  try {
    opensAtFor("2000-01-01", candidate);
    return { timeZone: candidate, fallback: false };
  } catch {
    return { timeZone: "UTC", fallback: true };
  }
}

/**
 * Checks the picked date against the three-month rule at `nowMs`.
 *
 * - No date, a malformed date, or a date that is not a real calendar day:
 *   `invalid_date`.
 * - A date before the earliest allowed opening date: `too_early`.
 * - Otherwise `opensAt` (00:00 of the date in the zone) and the passkey's user
 *   name, which carries the date in R15.1 form.
 */
export function checkRealOpening(opening: RealOpening, nowMs: number): RealOpeningCheck {
  const { opensOn, timeZone } = opening;
  if (opensOn === null || !DATE_KEY.test(opensOn)) {
    return { ok: false, kind: "invalid_date" };
  }
  let opensAt: string;
  try {
    // Throws a RangeError for a day that does not exist, such as 31 February.
    opensAt = opensAtFor(opensOn, timeZone);
  } catch {
    return { ok: false, kind: "invalid_date" };
  }
  if (opensOn < earliestOpeningDate(nowMs, timeZone)) {
    return { ok: false, kind: "too_early" };
  }
  return {
    ok: true,
    opensAt,
    userName: REAL_COPY.passkeyUserName.replace("{date}", formatCalendarDate(opensOn)),
  };
}
