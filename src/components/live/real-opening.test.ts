import { describe, expect, it } from "vitest";

import { earliestOpeningDate, opensAtFor } from "@/lib/seal-format";

import { checkRealOpening, resolveTimeZone } from "./real-opening";

// 6 November 2026, 12:00 UTC: a fixed clock for every case.
const NOW = Date.parse("2026-11-06T12:00:00.000Z");

describe("resolveTimeZone", () => {
  it("keeps a zone the runtime knows", () => {
    expect(resolveTimeZone("Europe/Stockholm")).toEqual({ timeZone: "Europe/Stockholm", fallback: false });
  });

  it("falls back to UTC for a zone it does not know", () => {
    expect(resolveTimeZone("Not/A_Zone")).toEqual({ timeZone: "UTC", fallback: true });
  });
});

describe("checkRealOpening", () => {
  const tz = "Europe/Stockholm";
  const earliest = earliestOpeningDate(NOW, tz);

  it("accepts the earliest allowed date and gives opensAt at 00:00 of that date in the zone", () => {
    const check = checkRealOpening({ opensOn: earliest, timeZone: tz }, NOW);
    expect(check.ok).toBe(true);
    if (!check.ok) return;
    expect(check.opensAt).toBe(opensAtFor(earliest, tz));
    expect(check.opensAt).not.toBe(new Date(NOW + 30_000).toISOString());
  });

  it("names the passkey for the opening date in R15.1 form", () => {
    const check = checkRealOpening({ opensOn: "2027-05-12", timeZone: tz }, NOW);
    expect(check).toEqual({
      ok: true,
      opensAt: opensAtFor("2027-05-12", tz),
      userName: "Revenant letter · opens 12 May 2027",
    });
  });

  it("refuses a date one day before the earliest allowed date as too early", () => {
    const earlier = addOneDay(earliest, -1);
    expect(checkRealOpening({ opensOn: earlier, timeZone: tz }, NOW)).toEqual({
      ok: false,
      kind: "too_early",
    });
  });

  it("refuses a missing date as invalid", () => {
    expect(checkRealOpening({ opensOn: null, timeZone: tz }, NOW)).toEqual({
      ok: false,
      kind: "invalid_date",
    });
  });

  it("refuses a date that is not a real calendar day", () => {
    expect(checkRealOpening({ opensOn: "2027-02-31", timeZone: tz }, NOW)).toEqual({
      ok: false,
      kind: "invalid_date",
    });
  });
});

/** The calendar day after (or before) `key`, in `YYYY-MM-DD`, read in UTC. */
function addOneDay(key: string, days: number): string {
  const ms = Date.parse(`${key}T00:00:00.000Z`) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}
