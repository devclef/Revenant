// Tests for the spreadsheet date-serial conversion (04-real-figures).
//
// serialToDate turns a 1900-date-system serial into a YYYY-MM-DD string using
// UTC getters only, so the output never depends on the machine timezone
// (R3.4, R4.5). It accepts integers from 61 to 2,958,465 inclusive and throws
// RangeError for a fraction, a non-integer, a value below the minimum, or a
// value past the maximum. The adapters turn that RangeError into a bad_date
// source error with the row number.

import { describe, expect, it } from "vitest";

import { serialToDate } from "./serial-date";

const MIN_SERIAL = 61;
const MAX_SERIAL = 2_958_465;

describe("serialToDate", () => {
  describe("known serial-to-date mappings", () => {
    const MAPPINGS: ReadonlyArray<{ serial: number; date: string }> = [
      // Worked example from the task: 45418 is 2024-05-06.
      { serial: 45_418, date: "2024-05-06" },
      // The lowest accepted serial, 61, is 1900-03-01 (the day after the
      // phantom 1900-02-29 that the 1900 date system invents at serial 60).
      { serial: MIN_SERIAL, date: "1900-03-01" },
      // 1901-01-01 — well clear of the leap-year quirk.
      { serial: 367, date: "1901-01-01" },
      // A round modern date: 2000-01-01.
      { serial: 36_526, date: "2000-01-01" },
      // The highest accepted serial, 2,958,465, is 9999-12-31.
      { serial: MAX_SERIAL, date: "9999-12-31" },
    ];

    for (const { serial, date } of MAPPINGS) {
      it(`maps serial ${serial} to ${date}`, () => {
        expect(serialToDate(serial)).toBe(date);
      });
    }

    it("always returns a zero-padded YYYY-MM-DD string", () => {
      expect(serialToDate(MIN_SERIAL)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(serialToDate(45_418)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(serialToDate(MAX_SERIAL)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe("bounds are inclusive", () => {
    it("accepts the lower bound 61", () => {
      expect(() => serialToDate(MIN_SERIAL)).not.toThrow();
      expect(serialToDate(MIN_SERIAL)).toBe("1900-03-01");
    });

    it("accepts the upper bound 2,958,465", () => {
      expect(() => serialToDate(MAX_SERIAL)).not.toThrow();
      expect(serialToDate(MAX_SERIAL)).toBe("9999-12-31");
    });
  });

  describe("throws for invalid input", () => {
    it("throws RangeError for a fractional serial", () => {
      expect(() => serialToDate(45_418.5)).toThrow(RangeError);
    });

    it("throws RangeError for a non-integer just off a valid serial", () => {
      expect(() => serialToDate(61.000_1)).toThrow(RangeError);
    });

    it("throws RangeError for NaN", () => {
      expect(() => serialToDate(Number.NaN)).toThrow(RangeError);
    });

    it("throws RangeError for a non-finite value", () => {
      expect(() => serialToDate(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    });

    it("throws RangeError just below the lower bound (60)", () => {
      expect(() => serialToDate(MIN_SERIAL - 1)).toThrow(RangeError);
    });

    it("throws RangeError just above the upper bound", () => {
      expect(() => serialToDate(MAX_SERIAL + 1)).toThrow(RangeError);
    });

    it("throws RangeError for a far-below value", () => {
      expect(() => serialToDate(0)).toThrow(RangeError);
    });
  });
});
