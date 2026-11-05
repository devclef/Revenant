// Per-series validation (spec 08-judge-polish, task 2; R20.3 to R20.6). Each
// check fails the whole series with its fixed reason token. Figures here are
// clearly fake test values; none is a real published number.

import { describe, expect, it } from "vitest";

import type { FreshSeries } from "./refresh";
import { validateFreshSeries } from "./validate";

const GASOLINE = "us-gasoline-regular";
const MONTHLY = "us-diesel";
const URL_ = "https://example.invalid/reference";
const AT = "2026-11-01T12:00:00Z";

function series(
  metricId: string,
  points: { period: string; value: string }[],
  overrides: Partial<Pick<FreshSeries, "downloadedAt" | "sourceUrl">> = {},
): FreshSeries {
  return {
    metricId,
    points,
    downloadedAt: overrides.downloadedAt ?? AT,
    sourceUrl: overrides.sourceUrl ?? URL_,
  };
}

describe("validateFreshSeries", () => {
  it("accepts a well-formed weekly series", () => {
    const result = validateFreshSeries(
      series(GASOLINE, [
        { period: "2026-10-19", value: "3.100" },
        { period: "2026-10-26", value: "3.200" },
      ]),
    );
    expect(result).toEqual({ ok: true });
  });

  it("rejects a series with zero figures", () => {
    expect(validateFreshSeries(series(GASOLINE, []))).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("rejects an unknown metric id", () => {
    expect(
      validateFreshSeries(series("not-a-metric", [{ period: "2026-10-26", value: "1" }])),
    ).toEqual({ ok: false, reason: "unknown series" });
  });

  it("rejects a missing provenance field (empty source_url or retrieved_at)", () => {
    const points = [{ period: "2026-10-26", value: "3.2" }];
    expect(validateFreshSeries(series(GASOLINE, points, { sourceUrl: "" }))).toEqual({
      ok: false,
      reason: "malformed source_url",
    });
    expect(
      validateFreshSeries(series(GASOLINE, points, { downloadedAt: "" })),
    ).toEqual({ ok: false, reason: "malformed retrieved_at" });
    expect(
      validateFreshSeries(series(GASOLINE, points, { downloadedAt: "yesterday" })),
    ).toEqual({ ok: false, reason: "malformed retrieved_at" });
  });

  it("rejects a non-finite or empty value", () => {
    for (const value of ["", "   ", "NaN", "Infinity", "abc"]) {
      expect(
        validateFreshSeries(series(GASOLINE, [{ period: "2026-10-26", value }])),
      ).toEqual({ ok: false, reason: "malformed value" });
    }
  });

  it("rejects a weekly period that is not a real date", () => {
    expect(
      validateFreshSeries(series(GASOLINE, [{ period: "2026-02-30", value: "1" }])),
    ).toEqual({ ok: false, reason: "malformed period" });
    expect(
      validateFreshSeries(series(GASOLINE, [{ period: "2026-10", value: "1" }])),
    ).toEqual({ ok: false, reason: "malformed period" });
  });

  it("rejects a period that does not fit the series' period_type", () => {
    // us-diesel is also weekly in the Catalogue, so a monthly-shaped period
    // is wrong for it.
    expect(
      validateFreshSeries(series(MONTHLY, [{ period: "2026-10", value: "1" }])),
    ).toEqual({ ok: false, reason: "malformed period" });
  });

  it("rejects two figures with the same period", () => {
    expect(
      validateFreshSeries(
        series(GASOLINE, [
          { period: "2026-10-26", value: "3.1" },
          { period: "2026-10-26", value: "3.2" },
        ]),
      ),
    ).toEqual({ ok: false, reason: "duplicate period" });
  });
});
