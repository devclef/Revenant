// Tests for the then-vs-now change calculator (spec 03-persona-demo, design.md).

import { describe, expect, it } from "vitest";

import type { FigureV1 } from "@/lib/seal-format";

import { CHANGE_FORMULA_ID, computeChange } from "./change";

// A valid official figure with every provenance field present. Overrides let a
// test vary one field at a time while every other field stays comparable.
function official(overrides: Partial<FigureV1> = {}): FigureV1 {
  return {
    kind: "official",
    metric_id: "us-gasoline",
    value: "2.00",
    unit: "USD per gallon",
    region: "U.S. city average",
    period: "2024-09",
    source: "U.S. EIA",
    series_id: "EMM_EPMR_PTE_NUS_DPG",
    retrieved_at: "2026-10-30T14:02:11Z",
    source_url: "https://www.eia.gov/series",
    ...overrides,
  } as FigureV1;
}

describe("computeChange", () => {
  it("gasoline 2.00 -> 5.00 gives +3 and an exact 150 percent", () => {
    const then = official({ value: "2.00", period: "2024-09" });
    const now = official({ value: "5.00", period: "2026-09" });

    const result = computeChange(then, now);

    expect(result.comparable).toBe(true);
    if (!result.comparable) return;
    expect(result.formula).toBe(CHANGE_FORMULA_ID);
    // then/now values and periods are copied from the inputs exactly.
    expect(result.then).toEqual({ value: "2.00", period: "2024-09" });
    expect(result.now).toEqual({ value: "5.00", period: "2026-09" });
    // difference is exact canonical now - then.
    expect(result.difference).toBe("3");
    expect(result.percent).toEqual({ value: "150", exact: true });
  });

  it("diesel 9.00 -> 6.00 gives -3 and a non-exact -33.3... percent", () => {
    const then = official({ value: "9.00", period: "2024-09" });
    const now = official({ value: "6.00", period: "2026-09" });

    const result = computeChange(then, now);

    expect(result.comparable).toBe(true);
    if (!result.comparable) return;
    expect(result.difference).toBe("-3");
    // -3 / 9 * 100 = -33.333... carried to 20 significant digits, not terminating.
    expect(result.percent).not.toBeNull();
    expect(result.percent?.exact).toBe(false);
    expect(result.percent?.value).toBe("-33.333333333333333333");
  });

  it("returns a null percent when the then value is zero", () => {
    const then = official({ value: "0", period: "2024-09" });
    const now = official({ value: "5.00", period: "2026-09" });

    const result = computeChange(then, now);

    expect(result.comparable).toBe(true);
    if (!result.comparable) return;
    expect(result.difference).toBe("5");
    expect(result.percent).toBeNull();
  });

  it("compares a YYYY-MM then against a YYYY-MM-DD now by period end", () => {
    // 2024-09 ends 2024-09-30; 2024-10-01 is one day later, so it is newer.
    const then = official({ period: "2024-09" });
    const now = official({ value: "5.00", period: "2024-10-01" });

    const result = computeChange(then, now);

    expect(result.comparable).toBe(true);
    if (!result.comparable) return;
    expect(result.then.period).toBe("2024-09");
    expect(result.now.period).toBe("2024-10-01");
  });

  it("reports unreadable_period when either period is not a real date or month", () => {
    const badThen = computeChange(
      official({ period: "2024-13" }),
      official({ value: "5.00", period: "2026-09" }),
    );
    expect(badThen).toEqual({ comparable: false, reason: "unreadable_period" });

    const badNow = computeChange(
      official({ period: "2024-09" }),
      official({ value: "5.00", period: "2026-02-30" }),
    );
    expect(badNow).toEqual({ comparable: false, reason: "unreadable_period" });
  });

  it("reports no_newer_figure when the period ends are equal", () => {
    // Both periods end 2024-09-30: the month and the last day are the same end.
    const then = official({ period: "2024-09" });
    const now = official({ value: "5.00", period: "2024-09-30" });

    const result = computeChange(then, now);

    expect(result).toEqual({ comparable: false, reason: "no_newer_figure" });
  });

  it("reports no_newer_figure when now is older than then", () => {
    const then = official({ period: "2026-09" });
    const now = official({ value: "5.00", period: "2024-09" });

    expect(computeChange(then, now)).toEqual({
      comparable: false,
      reason: "no_newer_figure",
    });
  });

  it("checks comparability fields in the specified priority order", () => {
    // kind beats every later mismatch: a self-reported figure fails on kind
    // even when source/series_id/unit/region also differ.
    const selfReported: FigureV1 = {
      kind: "self-reported",
      metric_id: "my-rent",
      value: "5.00",
      unit: "SEK per month",
      region: "Sweden",
      period: "2026-09",
      source: "self-reported",
      series_id: "mine",
      retrieved_at: "2026-10-30T14:02:11Z",
    };
    expect(computeChange(official(), selfReported)).toEqual({
      comparable: false,
      reason: "kind",
    });

    // source beats series_id/unit/region.
    expect(
      computeChange(
        official(),
        official({
          source: "other",
          series_id: "other",
          unit: "other",
          region: "other",
          period: "2026-09",
        }),
      ),
    ).toEqual({ comparable: false, reason: "source" });

    // series_id beats unit/region.
    expect(
      computeChange(
        official(),
        official({
          series_id: "other",
          unit: "other",
          region: "other",
          period: "2026-09",
        }),
      ),
    ).toEqual({ comparable: false, reason: "series_id" });

    // unit beats region.
    expect(
      computeChange(
        official(),
        official({ unit: "other", region: "other", period: "2026-09" }),
      ),
    ).toEqual({ comparable: false, reason: "unit" });

    // region alone.
    expect(
      computeChange(
        official(),
        official({ region: "other", period: "2026-09" }),
      ),
    ).toEqual({ comparable: false, reason: "region" });
  });

  it("does not mutate either input", () => {
    const then = official({ value: "2.00", period: "2024-09" });
    const now = official({ value: "5.00", period: "2026-09" });
    const thenBefore = structuredClone(then);
    const nowBefore = structuredClone(now);

    computeChange(then, now);

    expect(then).toEqual(thenBefore);
    expect(now).toEqual(nowBefore);
  });
});
