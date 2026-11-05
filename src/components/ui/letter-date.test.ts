import { afterEach, describe, expect, it } from "vitest";

import {
  formatCalendarDate,
  formatLetterDate,
  letterZoneFor,
  type LetterZone,
} from "./letter-date";

describe("formatCalendarDate", () => {
  it('formats a YYYY-MM-DD calendar date as "12 May 2024"', () => {
    expect(formatCalendarDate("2024-05-12")).toBe("12 May 2024");
  });

  it("returns an empty string for input that is not a date", () => {
    expect(formatCalendarDate("not a date")).toBe("");
  });
});

describe("formatLetterDate", () => {
  it('formats a UTC instant in UTC as "5 November 2024"', () => {
    expect(
      formatLetterDate("2024-11-05T00:00:00.000Z", { kind: "utc" }),
    ).toBe("5 November 2024");
  });

  it('reads an instant "30 October 2026" style with a day, long month and year', () => {
    expect(
      formatLetterDate("2026-10-30T10:00:00.000Z", { kind: "utc" }),
    ).toBe("30 October 2026");
  });

  it("returns an empty string for input that is not a date", () => {
    expect(formatLetterDate("not a date", { kind: "utc" })).toBe("");
  });

  it("names the calendar date of a fixed offset, not UTC", () => {
    // 23:00 UTC on 4 Nov is 00:00 on 5 Nov at +01:00, and still 4 Nov in UTC.
    const instant = "2024-11-04T23:00:00.000Z";
    expect(formatLetterDate(instant, { kind: "utc" })).toBe("4 November 2024");
    expect(
      formatLetterDate(instant, { kind: "fixed", offsetMinutes: 60 }),
    ).toBe("5 November 2024");
  });

  it("names the calendar date of an IANA zone", () => {
    // Midnight UTC on 1 Jan is still 31 Dec in New York (−05:00).
    const instant = "2024-01-01T00:00:00.000Z";
    expect(
      formatLetterDate(instant, {
        kind: "iana",
        timeZone: "America/New_York",
      }),
    ).toBe("31 December 2023");
  });

  it("matches the always-named form of the design (day month year)", () => {
    const text = formatLetterDate("2026-10-30T00:00:00.000Z", { kind: "utc" });
    expect(text).toMatch(
      /^[1-9][0-9]? (January|February|March|April|May|June|July|August|September|October|November|December) [0-9]{4}$/,
    );
  });
});

describe("letterZoneFor", () => {
  it("returns utc for a persona", () => {
    expect(
      letterZoneFor("persona", "2024-11-05T00:00:00.000Z", "America/New_York"),
    ).toEqual({ kind: "utc" });
  });

  it("returns the browser IANA zone for a live letter", () => {
    expect(
      letterZoneFor("live", "2026-10-30T12:00:30.000Z", "Europe/Stockholm"),
    ).toEqual({ kind: "iana", timeZone: "Europe/Stockholm" });
  });

  it("uses the browser zone for a real letter whose opens_at is local midnight there", () => {
    // 05:00 UTC is 00:00 in New York (−05:00, no DST on this winter date).
    const zone = letterZoneFor(
      "real",
      "2026-01-15T05:00:00.000Z",
      "America/New_York",
    );
    expect(zone).toEqual({ kind: "iana", timeZone: "America/New_York" });
  });

  it("derives a west fixed offset for a real letter when the browser zone is not local midnight", () => {
    // opens_at at 07:00 UTC with an unrelated browser zone: t = 420 minutes,
    // west offset = -420 (−07:00), which reaches local midnight.
    const zone = letterZoneFor(
      "real",
      "2026-05-15T07:00:00.000Z",
      "UTC",
    ) as Extract<LetterZone, { kind: "fixed" }>;
    expect(zone.kind).toBe("fixed");
    expect(zone.offsetMinutes).toBe(-420);
    // That offset names the opening as 15 May.
    expect(formatLetterDate("2026-05-15T07:00:00.000Z", zone)).toBe(
      "15 May 2026",
    );
  });

  it("derives an east fixed offset for a real letter past the west band", () => {
    // opens_at at 14:00 UTC: west offset -840 is out of range, so the east
    // offset 1440-840 = +600 (+10:00) is chosen, naming 16 May.
    const zone = letterZoneFor(
      "real",
      "2026-05-15T14:00:00.000Z",
      "UTC",
    ) as Extract<LetterZone, { kind: "fixed" }>;
    expect(zone.kind).toBe("fixed");
    expect(zone.offsetMinutes).toBe(600);
    expect(formatLetterDate("2026-05-15T14:00:00.000Z", zone)).toBe(
      "16 May 2026",
    );
  });
});

/**
 * Property 21 / spec 08 R15: a letter date in UTC must not depend on the
 * viewer's timezone. Run each formatter with `process.env.TZ` set to UTC, the
 * earliest civil timezone (Pacific/Kiritimati, +14:00) and one of the latest
 * (America/Adak, −10:00), and assert the output is identical across all three.
 */
describe("Property 21: UTC output is independent of the viewer timezone", () => {
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

  it("formatLetterDate in UTC is identical across timezones", () => {
    const results = timezones.map((tz) =>
      underTz(tz, () =>
        formatLetterDate("2024-11-05T00:00:00.000Z", { kind: "utc" }),
      ),
    );
    expect(new Set(results).size).toBe(1);
    expect(results[0]).toBe("5 November 2024");
  });

  it("a midnight-UTC calendar date never shifts to the previous or next day", () => {
    for (const date of ["2024-05-01", "2024-05-31"] as const) {
      const results = timezones.map((tz) =>
        underTz(tz, () => formatCalendarDate(date)),
      );
      expect(new Set(results).size).toBe(1);
    }
  });
});
