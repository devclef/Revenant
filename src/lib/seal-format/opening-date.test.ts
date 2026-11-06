// Tests for the 3-calendar-month rule (spec 08-judge-polish, Property 5 and
// Property 26, R24.2, R24.3, R24.4, R24.5, R30.5).

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  REAL_LOCK_MONTHS,
  SEAL_MARGIN_MS,
  addCalendarMonthsLocal,
  addCalendarMonthsUtc,
  earliestOpeningDate,
  meetsRealLock,
  opensAtFor,
} from "./opening-date";
import * as sealFormat from "./index";

const ZONES = Intl.supportedValuesOf("timeZone");
const MIN_2026 = Date.parse("2026-01-01T00:00:00Z");
const MAX_2040 = Date.parse("2040-12-31T23:59:59Z");
const DAY_MS = 86_400_000;

// Test-only helpers that read the wall clock back out with Intl, independently
// of the module under test.
function wallKey(ms: number, timeZone: string): string {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  return f.format(new Date(ms)).replace(", ", "T");
}

function dateKey(ms: number, timeZone: string): string {
  return wallKey(ms, timeZone).slice(0, 10);
}

function addDays(dateKeyValue: string, days: number): string {
  const [y, m, d] = dateKeyValue.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + days * DAY_MS).toISOString().slice(0, 10);
}

describe("addCalendarMonthsUtc", () => {
  it("keeps the time of day and the day when the month allows it", () => {
    expect(addCalendarMonthsUtc(Date.parse("2026-11-06T14:27:44.913Z"), 3)).toBe(
      Date.parse("2027-02-06T14:27:44.913Z"),
    );
  });

  it("clamps to the last day of a shorter month, including leap years", () => {
    expect(addCalendarMonthsUtc(Date.parse("2026-11-30T10:00:00Z"), 3)).toBe(
      Date.parse("2027-02-28T10:00:00Z"),
    );
    expect(addCalendarMonthsUtc(Date.parse("2027-11-30T10:00:00Z"), 3)).toBe(
      Date.parse("2028-02-29T10:00:00Z"),
    );
    expect(addCalendarMonthsUtc(Date.parse("2026-01-31T00:00:00Z"), 1)).toBe(
      Date.parse("2026-02-28T00:00:00Z"),
    );
  });
});

describe("addCalendarMonthsLocal", () => {
  it("adds months on the zone's calendar, keeping the local time", () => {
    // 31 January 01:00 in Asia/Karachi (UTC+5) is 30 January 20:00 UTC.
    const now = Date.parse("2026-01-30T20:00:00Z");
    expect(addCalendarMonthsLocal(now, 3, "Asia/Karachi")).toBe(
      Date.parse("2026-04-29T20:00:00Z"), // 30 April 01:00 local, clamped
    );
  });

  it("follows the zone's offset at the result, so a DST change is handled", () => {
    // 6 November 2026 14:27 in Stockholm (CET, UTC+1). Three months later it is
    // 6 February 2027 14:27 CET, which is 13:27 UTC. The local time of day is kept.
    const now = Date.parse("2026-11-06T13:27:44.913Z");
    expect(addCalendarMonthsLocal(now, 3, "Europe/Stockholm")).toBe(
      Date.parse("2027-02-06T13:27:44.913Z"),
    );
  });
});

describe("opensAtFor", () => {
  it("returns 00:00 of the picked date in the zone", () => {
    expect(opensAtFor("2026-10-25", "Europe/Stockholm")).toBe("2026-10-24T22:00:00.000Z");
    expect(opensAtFor("2026-03-29", "Europe/Stockholm")).toBe("2026-03-28T23:00:00.000Z");
    expect(opensAtFor("2026-11-06", "UTC")).toBe("2026-11-06T00:00:00.000Z");
  });

  it("returns the first instant of the day when midnight does not exist", () => {
    // Chile moves its clocks at midnight on the first Sunday of September:
    // 00:00 becomes 01:00. The day starts at 04:00 UTC, when the clock jumps.
    expect(opensAtFor("2026-09-06", "America/Santiago")).toBe("2026-09-06T04:00:00.000Z");
  });

  it("rejects text that is not a real calendar date", () => {
    expect(() => opensAtFor("2026-02-30", "UTC")).toThrow(RangeError);
    expect(() => opensAtFor("6 Nov 2026", "UTC")).toThrow(RangeError);
  });
});

describe("earliestOpeningDate", () => {
  it("is the first date at or after the later of the two rules plus the margin", () => {
    // 6 November 2026 14:27 in Stockholm. The local and UTC rules both give
    // 6 February 2027 14:27, plus 15 minutes. 6 February 00:00 is too early,
    // so the earliest date is 7 February.
    const now = Date.parse("2026-11-06T13:27:44.913Z");
    expect(earliestOpeningDate(now, "Europe/Stockholm")).toBe("2027-02-07");
  });

  it("takes the UTC rule when it is later than the local rule", () => {
    // 31 January 01:00 in Asia/Karachi. The local rule gives 30 April 01:00
    // local (29 April 20:00 UTC). The UTC rule gives 30 April 20:00 UTC, plus the
    // margin. So 1 May 00:00 local (30 April 19:00 UTC) is too early, and the
    // earliest date is 2 May. A local-only rule would wrongly give 1 May.
    const now = Date.parse("2026-01-30T20:00:00Z");
    expect(earliestOpeningDate(now, "Asia/Karachi")).toBe("2026-05-02");
    expect(Date.parse(opensAtFor("2026-05-01", "Asia/Karachi"))).toBeLessThan(
      Math.max(
        addCalendarMonthsLocal(now, REAL_LOCK_MONTHS, "Asia/Karachi"),
        addCalendarMonthsUtc(now, REAL_LOCK_MONTHS),
      ) + SEAL_MARGIN_MS,
    );
  });
});

describe("meetsRealLock", () => {
  it("accepts the boundary and rejects one millisecond before it", () => {
    const now = Date.parse("2026-11-30T12:00:00Z");
    const boundary = addCalendarMonthsUtc(now, REAL_LOCK_MONTHS);
    expect(boundary).toBe(Date.parse("2027-02-28T12:00:00Z"));
    expect(meetsRealLock(boundary, now)).toBe(true);
    expect(meetsRealLock(boundary - 1, now)).toBe(false);
  });

  it("uses 29 February for a leap-year month end", () => {
    const now = Date.parse("2027-11-30T12:00:00Z");
    expect(meetsRealLock(Date.parse("2028-02-29T12:00:00Z"), now)).toBe(true);
    expect(meetsRealLock(Date.parse("2028-02-28T23:59:59.999Z"), now)).toBe(false);
  });
});

describe("module exports", () => {
  it("re-exports the rules from the seal-format barrel", () => {
    expect(sealFormat.REAL_LOCK_MONTHS).toBe(3);
    expect(sealFormat.SEAL_MARGIN_MS).toBe(900_000);
    expect(sealFormat.opensAtFor).toBe(opensAtFor);
    expect(sealFormat.earliestOpeningDate).toBe(earliestOpeningDate);
    expect(sealFormat.meetsRealLock).toBe(meetsRealLock);
    expect(sealFormat.addCalendarMonthsUtc).toBe(addCalendarMonthsUtc);
    expect(sealFormat.addCalendarMonthsLocal).toBe(addCalendarMonthsLocal);
  });
});

// Feature: 08-judge-polish, Property 5: Opening dates are local midnight and at least 3 calendar months away
describe("Property 5: opening dates are local midnight and at least 3 calendar months away", () => {
  it("holds for every zone, sealing instant and picked date from the earliest date on", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ZONES),
        fc.integer({ min: MIN_2026, max: MAX_2040 }),
        fc.integer({ min: 0, max: 40 }),
        (timeZone, now, extraDays) => {
          const earliest = earliestOpeningDate(now, timeZone);
          const picked = addDays(earliest, extraDays);
          const opensAt = opensAtFor(picked, timeZone);
          const opensMs = Date.parse(opensAt);

          // Local midnight: the picked date starts at this instant. One second
          // earlier is still the previous date.
          expect(dateKey(opensMs, timeZone)).toBe(picked);
          expect(dateKey(opensMs - 1000, timeZone)).toBe(addDays(picked, -1));

          // At least 3 calendar months away on both calendars.
          const localRule = addCalendarMonthsLocal(now, REAL_LOCK_MONTHS, timeZone);
          const utcRule = addCalendarMonthsUtc(now, REAL_LOCK_MONTHS);
          expect(opensMs).toBeGreaterThanOrEqual(localRule);
          expect(opensMs).toBeGreaterThanOrEqual(utcRule);
          expect(meetsRealLock(opensMs, now)).toBe(true);

          // The date before the earliest date fails the bound, so the earliest
          // date is the first one that passes.
          const threshold = Math.max(localRule, utcRule) + SEAL_MARGIN_MS;
          expect(Date.parse(opensAtFor(earliest, timeZone))).toBeGreaterThanOrEqual(threshold);
          expect(Date.parse(opensAtFor(addDays(earliest, -1), timeZone))).toBeLessThan(
            threshold,
          );
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: 08-judge-polish, Property 26: The server's real lock boundary
describe("Property 26: the server's real lock boundary", () => {
  it("is true from addCalendarMonthsUtc(serverNow, 3) on, and false before it", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MIN_2026, max: MAX_2040 }),
        fc.integer({ min: 1, max: 10 * DAY_MS }),
        (serverNow, laterBy) => {
          const boundary = addCalendarMonthsUtc(serverNow, REAL_LOCK_MONTHS);
          expect(meetsRealLock(boundary, serverNow)).toBe(true);
          expect(meetsRealLock(boundary + laterBy, serverNow)).toBe(true);
          expect(meetsRealLock(boundary - 1, serverNow)).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});
