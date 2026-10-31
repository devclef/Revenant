import { afterEach, describe, expect, it } from "vitest";

import { formatCalendarDate, formatUtcDate } from "./dates";

describe("formatCalendarDate", () => {
  it('formats a YYYY-MM-DD calendar date as "12 May 2024"', () => {
    expect(formatCalendarDate("2024-05-12")).toBe("12 May 2024");
  });
});

describe("formatUtcDate", () => {
  it('formats an ISO UTC instant as "5 November 2024"', () => {
    expect(formatUtcDate("2024-11-05T00:00:00.000Z")).toBe("5 November 2024");
  });
});

/**
 * Property 21: the formatted calendar string must not depend on the viewer's
 * timezone. Run each formatter with `process.env.TZ` set to UTC, the earliest
 * civil timezone (Pacific/Kiritimati, +14:00) and one of the latest
 * (America/Adak, -10:00), and assert the output is identical across all three.
 * Validates R6.3, R10.2, R13.3.
 */
describe("Property 21: output is independent of the viewer timezone", () => {
  const originalTz = process.env.TZ;
  const timezones = ["UTC", "Pacific/Kiritimati", "America/Adak"] as const;

  afterEach(() => {
    if (originalTz === undefined) {
      delete process.env.TZ;
    } else {
      process.env.TZ = originalTz;
    }
  });

  const underTz = <T>(tz: string, fn: () => T): T => {
    process.env.TZ = tz;
    // Force the Date/Intl runtime to pick up the new TZ for this evaluation.
    // The formatters pin timeZone: "UTC", so a correct implementation is
    // unaffected; a buggy one reading the ambient zone would diverge here.
    return fn();
  };

  it("formatCalendarDate is identical across timezones", () => {
    const results = timezones.map((tz) =>
      underTz(tz, () => formatCalendarDate("2024-05-12")),
    );
    expect(new Set(results).size).toBe(1);
    expect(results[0]).toBe("12 May 2024");
  });

  it("formatUtcDate is identical across timezones", () => {
    const results = timezones.map((tz) =>
      underTz(tz, () => formatUtcDate("2024-11-05T00:00:00.000Z")),
    );
    expect(new Set(results).size).toBe(1);
    expect(results[0]).toBe("5 November 2024");
  });

  it("a midnight-UTC calendar date never shifts to the previous or next day", () => {
    // A date at UTC midnight is the classic case where an ambient-TZ bug flips
    // the day. Check both the first and last day of a month under every zone.
    for (const date of ["2024-05-01", "2024-05-31"] as const) {
      const results = timezones.map((tz) =>
        underTz(tz, () => formatCalendarDate(date)),
      );
      expect(new Set(results).size).toBe(1);
    }
  });
});
