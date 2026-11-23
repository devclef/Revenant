// Feature: 18-persona-dates, Property 13: Date_Forms come from the UI formatters
//
// The Date_Guard scans the repository for the forms a user can see for a
// persona date. Those forms must come from the same formatters the reveal
// uses, so the guard never checks a shape no screen shows.

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  formatCalendarDate,
  formatCalendarMonth,
  formatShortDate,
  formatWeekdayDate,
} from "./letter-date";

/** The five forms of a calendar date, built with the letter-date formatters. */
function dateFormsOf(date: string): string[] {
  return [
    date,
    `${date}T00:00:00.000Z`,
    formatCalendarDate(date),
    formatShortDate(`${date}T00:00:00.000Z`),
    formatCalendarMonth(date),
  ];
}

/** Real calendar dates from 2000 to 2099, as YYYY-MM-DD. */
const calendarDate = fc
  .date({
    min: new Date("2000-01-01T00:00:00.000Z"),
    max: new Date("2099-12-31T00:00:00.000Z"),
    noInvalidDate: true,
  })
  .map((value) => value.toISOString().slice(0, 10));

describe("Property 13: Date_Forms come from the UI formatters", () => {
  it("builds the five forms from the formatters for any real calendar date", () => {
    fc.assert(
      fc.property(calendarDate, (date) => {
        const [iso, instant, day, short, month] = dateFormsOf(date);
        expect(iso).toBe(date);
        expect(instant).toBe(`${date}T00:00:00.000Z`);
        expect(day).toBe(formatCalendarDate(date));
        expect(day).not.toBe("");
        expect(short).toBe(formatShortDate(`${date}T00:00:00.000Z`));
        expect(short).not.toBe("");
        expect(month).toBe(formatCalendarMonth(date));
        expect(month).not.toBe("");
      }),
      { numRuns: 100 },
    );
  });

  it("finds every weekday-date output for the date among its forms at UTC", () => {
    fc.assert(
      fc.property(calendarDate, (date) => {
        const forms = dateFormsOf(date);
        const weekdayDate = formatWeekdayDate(new Date(`${date}T00:00:00.000Z`), "UTC");
        expect(weekdayDate).not.toBe("");
        expect(forms.some((form) => weekdayDate.includes(form))).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
