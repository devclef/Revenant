// Tests for the period helpers (spec 02-demo-figures).

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { isRealDate, isRealMonth, periodEnd } from "./periods";
import { loadFigureFile, FigureDataError } from "./load";
import { CATALOGUE } from "./catalogue";
import type { FigureFile } from "./types";

describe("isRealDate", () => {
  it("accepts real calendar dates", () => {
    for (const s of [
      "2024-01-01",
      "2024-02-29", // leap year
      "2023-02-28",
      "2024-12-31",
      "1900-01-01",
      "2100-12-31",
    ]) {
      expect(isRealDate(s)).toBe(true);
    }
  });

  it("rejects impossible days", () => {
    expect(isRealDate("2024-02-30")).toBe(false);
    expect(isRealDate("2023-02-29")).toBe(false); // not a leap year
    expect(isRealDate("2024-04-31")).toBe(false);
    expect(isRealDate("2024-00-10")).toBe(false);
    expect(isRealDate("2024-13-01")).toBe(false);
  });

  it("rejects the wrong shape", () => {
    for (const s of [
      "2024-1-1",
      "24-01-01",
      "2024/01/01",
      "2024-01",
      "2024-01-01T00:00:00Z",
      "not-a-date",
      "",
    ]) {
      expect(isRealDate(s)).toBe(false);
    }
  });
});

describe("isRealMonth", () => {
  it("accepts months 01 through 12", () => {
    for (let m = 1; m <= 12; m++) {
      const mm = m < 10 ? `0${m}` : `${m}`;
      expect(isRealMonth(`2024-${mm}`)).toBe(true);
    }
  });

  it("rejects month 00 and 13", () => {
    expect(isRealMonth("2024-00")).toBe(false);
    expect(isRealMonth("2024-13")).toBe(false);
  });

  it("rejects the wrong shape", () => {
    for (const s of [
      "2024-1",
      "24-01",
      "2024/01",
      "2024-01-01",
      "2024",
      "not-a-month",
      "",
    ]) {
      expect(isRealMonth(s)).toBe(false);
    }
  });
});

describe("periodEnd", () => {
  it("returns a weekly period unchanged", () => {
    expect(periodEnd("2024-02-14", "weekly")).toBe("2024-02-14");
    expect(periodEnd("2024-12-31", "weekly")).toBe("2024-12-31");
  });

  it("returns the last day of the month, including leap years", () => {
    expect(periodEnd("2024-02", "monthly")).toBe("2024-02-29"); // leap
    expect(periodEnd("2023-02", "monthly")).toBe("2023-02-28"); // non-leap
    expect(periodEnd("2024-04", "monthly")).toBe("2024-04-30");
    expect(periodEnd("2024-12", "monthly")).toBe("2024-12-31");
    expect(periodEnd("2024-01", "monthly")).toBe("2024-01-31");
  });
});

// The real last day of a month, computed independently of periodEnd so the
// property test checks periodEnd against a second implementation.
function lastDayOfMonth(year: number, month: number): number {
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month - 1];
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

// A minimal valid fixture file: one FIXTURE-prefixed monthly series with one
// figure. Rebuilt per run so mutations do not leak between property samples.
function buildFile(period: string): FigureFile {
  return {
    fixture: true,
    note: "fast-check minimal file",
    series: [
      {
        metric: {
          id: "fixture-monthly",
          display_name: "Fixture monthly series",
          unit: "FIXTURE unit",
          region: "FIXTURE region",
          source: "FIXTURE source",
          series_id: "FIXTURE-SERIES",
        },
        period_type: "monthly",
      },
    ],
    figures: [
      {
        kind: "official",
        metric_id: "fixture-monthly",
        value: "1.000",
        unit: "FIXTURE unit",
        region: "FIXTURE region",
        period,
        source: "FIXTURE source",
        series_id: "FIXTURE-SERIES",
        retrieved_at: "2026-10-30T14:02:11Z",
        source_url: "https://example.invalid/fixture",
      },
    ],
  };
}

// Feature: 02-demo-figures, Property 4: Period end and date checks
describe("Property 4: Period end and date checks", () => {
  it("periodEnd monthly is the real last day of the month", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1900, max: 2100 }),
        fc.integer({ min: 1, max: 12 }),
        (year, month) => {
          const key = `${year}-${pad2(month)}`;
          expect(periodEnd(key, "monthly")).toBe(
            `${year}-${pad2(month)}-${pad2(lastDayOfMonth(year, month))}`,
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("periodEnd weekly returns any real date unchanged", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1900, max: 2100 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 31 }),
        (year, month, day) => {
          const d = `${year}-${pad2(month)}-${pad2(day)}`;
          fc.pre(isRealDate(d));
          expect(periodEnd(d, "weekly")).toBe(d);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("the loader rejects a malformed period with bad_period", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          "2024-13", // month out of range
          "2024-00",
          "2024", // wrong shape for monthly
          "2024-02-30", // not a date, not a month
          "not-a-period",
        ),
        (badPeriod) => {
          const file = buildFile(badPeriod);
          try {
            loadFigureFile(file, CATALOGUE);
            throw new Error("expected loadFigureFile to throw");
          } catch (err) {
            expect(err).toBeInstanceOf(FigureDataError);
            expect((err as FigureDataError).rule).toBe("bad_period");
            expect((err as FigureDataError).path).toBe("figures.0.period");
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
