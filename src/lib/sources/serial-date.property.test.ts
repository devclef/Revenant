// Feature: 04-real-figures, Property 2: Date serials convert to the right calendar date in any timezone
//
// Property-based test (fast-check, numRuns: 100) for serialToDate, the
// spreadsheet date-serial conversion. For any integer serial in [61,
// 2,958,465]:
//
//   1. serialToDate(serial) equals an INDEPENDENT BigInt civil-from-days
//      computation (Howard Hinnant's algorithm, pure integer arithmetic, no
//      Date object), so the two paths agree across the whole accepted range.
//   2. the result passes isRealDate (it is a real YYYY-MM-DD calendar date).
//   3. the result is identical with process.env.TZ set to UTC,
//      Pacific/Kiritimati (+14:00, earliest civil zone) and America/Adak
//      (-10:00, among the latest), so the output never depends on the viewer's
//      timezone (R3.4, R4.5; mirrors the figures Property 21 date tests).
//
// Non-integer, below 61 and above 2,958,465 serials throw RangeError.

import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";

import { isRealDate } from "@/lib/figures";

import { serialToDate } from "./serial-date";

const NUM_RUNS = 100;

const MIN_SERIAL = 61;
const MAX_SERIAL = 2_958_465;

/**
 * Days from the 1900 date-system serial epoch (1899-12-30) to the Unix epoch
 * (1970-01-01): serial 25569 is 1970-01-01. Subtracting it turns a serial into
 * days-since-Unix-epoch, the input the civil-from-days algorithm expects.
 */
const SERIAL_UNIX_OFFSET = 25_569n;

/**
 * Howard Hinnant's `civil_from_days`, in BigInt. Given `z` = days since the
 * Unix epoch (1970-01-01), returns the proleptic Gregorian { year, month, day }.
 * This is a deliberately independent implementation path from `serialToDate`,
 * which goes through `Date.UTC` + UTC getters — the two must agree.
 */
function civilFromDays(z: bigint): { year: bigint; month: bigint; day: bigint } {
  const shifted = z + 719_468n; // shift the epoch from 1970-01-01 to 0000-03-01
  const era = (shifted >= 0n ? shifted : shifted - 146_096n) / 146_097n;
  const doe = shifted - era * 146_097n; // day-of-era, [0, 146096]
  const yoe = (doe - doe / 1_460n + doe / 36_524n - doe / 146_096n) / 365n; // [0, 399]
  const y = yoe + era * 400n;
  const doy = doe - (365n * yoe + yoe / 4n - yoe / 100n); // day-of-year (Mar-based), [0, 365]
  const mp = (5n * doy + 2n) / 153n; // month index, Mar = 0, [0, 11]
  const day = doy - (153n * mp + 2n) / 5n + 1n; // [1, 31]
  const month = mp < 10n ? mp + 3n : mp - 9n; // [1, 12]
  const year = month <= 2n ? y + 1n : y;
  return { year, month, day };
}

function pad(value: bigint, width: number): string {
  return String(value).padStart(width, "0");
}

/**
 * Convert a serial to YYYY-MM-DD using the independent BigInt path above.
 * Nothing here touches a Date object or the ambient timezone.
 */
function serialToDateIndependent(serial: number): string {
  const days = BigInt(serial) - SERIAL_UNIX_OFFSET;
  const { year, month, day } = civilFromDays(days);
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/** The three timezones Property 21 uses: UTC, the earliest and a latest zone. */
const TIMEZONES = ["UTC", "Pacific/Kiritimati", "America/Adak"] as const;

describe("Property 2: date serials convert to the right calendar date in any timezone", () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    if (originalTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTz;
    }
  });

  const underTz = <T>(tz: string, fn: () => T): T => {
    process.env.TZ = tz;
    // serialToDate reads the instant with UTC getters only, so a correct
    // implementation is unaffected by the ambient zone; a buggy one that read
    // the local zone would diverge here.
    return fn();
  };

  it("equals the independent BigInt civil-from-days computation for every accepted serial", () => {
    fc.assert(
      fc.property(fc.integer({ min: MIN_SERIAL, max: MAX_SERIAL }), (serial) => {
        expect(serialToDate(serial)).toBe(serialToDateIndependent(serial));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("always returns a real calendar date (isRealDate) in YYYY-MM-DD form", () => {
    fc.assert(
      fc.property(fc.integer({ min: MIN_SERIAL, max: MAX_SERIAL }), (serial) => {
        const result = serialToDate(serial);
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(isRealDate(result)).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("is identical under UTC, Pacific/Kiritimati and America/Adak", () => {
    fc.assert(
      fc.property(fc.integer({ min: MIN_SERIAL, max: MAX_SERIAL }), (serial) => {
        const results = TIMEZONES.map((tz) => underTz(tz, () => serialToDate(serial)));
        expect(new Set(results).size).toBe(1);
        // And the single value is the one the independent computation gives.
        expect(results[0]).toBe(serialToDateIndependent(serial));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("throws RangeError for a non-integer serial in range", () => {
    fc.assert(
      fc.property(
        fc
          .double({
            min: MIN_SERIAL,
            max: MAX_SERIAL,
            noNaN: true,
            noDefaultInfinity: true,
          })
          .filter((n) => !Number.isInteger(n)),
        (serial) => {
          expect(() => serialToDate(serial)).toThrow(RangeError);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("throws RangeError for any serial below the lower bound (< 61)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: Number.MIN_SAFE_INTEGER, max: MIN_SERIAL - 1 }),
        (serial) => {
          expect(() => serialToDate(serial)).toThrow(RangeError);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("throws RangeError for any serial above the upper bound (> 2,958,465)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MAX_SERIAL + 1, max: Number.MAX_SAFE_INTEGER }),
        (serial) => {
          expect(() => serialToDate(serial)).toThrow(RangeError);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
