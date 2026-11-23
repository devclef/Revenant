// Feature: 14-write-desk, Property 6: The date formatters name the calendar day of the instant

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  formatDatedDay,
  localCalendarDay,
} from "@/components/live/desk/sheet-date";
import { formatWrittenOn } from "./written-on";

const ZONES = [
  "UTC",
  "Europe/Stockholm",
  "America/Los_Angeles",
  "Pacific/Kiritimati",
  "Pacific/Pago_Pago",
] as const;

const MIN_MS = Date.parse("2000-01-01T00:00:00.000Z");
const MAX_MS = Date.parse("2100-12-31T23:59:59.999Z");

describe("formatWrittenOn (Property 6)", () => {
  it("names the same calendar day as the instant in the zone", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MIN_MS, max: MAX_MS }),
        fc.constantFrom(...ZONES),
        (ms, zone) => {
          const instant = new Date(ms);
          const expected = formatDatedDay(localCalendarDay(instant, zone));
          expect(formatWrittenOn(instant.toISOString(), zone)).toBe(expected);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("returns an empty string for an input that is not an instant", () => {
    expect(formatWrittenOn("not a date", "UTC")).toBe("");
  });

  it("uses the reader's zone at the day boundary", () => {
    // 23:30 UTC on 18 Nov is already 19 Nov in Stockholm (UTC+1 in November).
    const iso = "2026-11-18T23:30:00.000Z";
    expect(formatWrittenOn(iso, "UTC")).toBe("18 November 2026");
    expect(formatWrittenOn(iso, "Europe/Stockholm")).toBe("19 November 2026");
  });
});
