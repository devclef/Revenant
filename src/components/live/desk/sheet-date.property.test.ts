// Feature: 14-write-desk, Property 6 (design.md "Correctness Properties").
//
// The date text on the Write step names the calendar day of the instant in the
// visitor's zone, never the UTC day. `formatSheetDate` and `formatDatedDay` are
// checked against an independent calendar: the weekday and month names are
// written out here, and the zone's calendar day is read through en-CA, which
// prints YYYY-MM-DD.
//
// Validates: Requirements W4.2, W12.2.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  formatDatedDay,
  formatSheetDate,
  localCalendarDay,
} from "./sheet-date";

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const ZONES = [
  "UTC",
  "Europe/Stockholm",
  "America/Los_Angeles",
  "Pacific/Kiritimati",
  "Pacific/Pago_Pago",
] as const;

const instantArb = fc.date({
  min: new Date("2000-01-01T00:00:00.000Z"),
  max: new Date("2100-12-31T23:59:59.999Z"),
  noInvalidDate: true,
});
const zoneArb = fc.constantFrom(...ZONES);

/** The calendar day in the zone, read through en-CA (YYYY-MM-DD). */
function zoneDayIndependent(instant: Date, zone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: zone,
  }).format(instant);
}

/** The "{day} {Month} {year}" text, written out from a YYYY-MM-DD day. */
function expectedDated(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

/** The "{Weekday}, {day} {Month} {year}" text, weekday taken from the day. */
function expectedSheet(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${weekday}, ${expectedDated(day)}`;
}

describe("sheet date formatters (Property 6, spec 14 W4.2, W12.2)", () => {
  it("names the calendar day of the instant in the zone, for any instant from 2000 to 2100", () => {
    fc.assert(
      fc.property(instantArb, zoneArb, (instant, zone) => {
        const day = localCalendarDay(instant, zone);

        expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(day).toBe(zoneDayIndependent(instant, zone));

        expect(formatSheetDate(instant, zone)).toBe(expectedSheet(day));
        expect(formatDatedDay(day)).toBe(expectedDated(day));
      }),
      { numRuns: 1000 },
    );
  });

  it("gives the same dated text for the day as for the sheet's day part", () => {
    fc.assert(
      fc.property(instantArb, zoneArb, (instant, zone) => {
        const day = localCalendarDay(instant, zone);
        const sheet = formatSheetDate(instant, zone);
        expect(sheet.endsWith(`, ${formatDatedDay(day)}`)).toBe(true);
      }),
      { numRuns: 500 },
    );
  });

  it("uses the zone's day at the edges of the zone's day, not the UTC day", () => {
    // 23:30 UTC on 17 November is already 18 November in Kiritimati (UTC+14).
    const kiritimati = new Date("2026-11-17T23:30:00.000Z");
    expect(localCalendarDay(kiritimati, "Pacific/Kiritimati")).toBe(
      "2026-11-18",
    );
    expect(formatSheetDate(kiritimati, "Pacific/Kiritimati")).toBe(
      "Wednesday, 18 November 2026",
    );

    // 10:00 UTC on 18 November is still 17 November in Pago Pago (UTC-11).
    const pagoPago = new Date("2026-11-18T10:00:00.000Z");
    expect(localCalendarDay(pagoPago, "Pacific/Pago_Pago")).toBe("2026-11-17");
    expect(formatSheetDate(pagoPago, "Pacific/Pago_Pago")).toBe(
      "Tuesday, 17 November 2026",
    );
  });

  it("returns an empty string for a day that is not a real calendar day", () => {
    expect(formatDatedDay("2026-02-30")).toBe("");
    expect(formatDatedDay("2026-13-01")).toBe("");
    expect(formatDatedDay("17/11/2026")).toBe("");
    expect(formatDatedDay("")).toBe("");
  });

  it("returns an empty string for an invalid instant", () => {
    const invalid = new Date("not a date");
    expect(formatSheetDate(invalid, "UTC")).toBe("");
    expect(localCalendarDay(invalid, "UTC")).toBe("");
  });
});
