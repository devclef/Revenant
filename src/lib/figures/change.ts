// Then-vs-now change calculator (spec 03-persona-demo, design.md).
//
// computeChange compares two sealed figures and, when they are comparable,
// returns the exact difference (now − then) and the percentage change
// (now − then) ÷ then × 100, both as canonical decimal strings. All arithmetic
// is exact BigInt work in decimal.ts: there is no Number(), parseFloat,
// parseInt or unary + on any value in this module, and a source-scan test
// enforces that.
//
// This module imports nothing from src/lib/crypto, src/lib/db or Node
// built-ins, so it is pure and safe to use in the browser and on the server.

import type { FigureV1 } from "@/lib/seal-format";
import { isZero, parseDecimal, ratioPercent, sub, toDecimalString } from "./decimal";
import { isRealDate, isRealMonth, periodEnd } from "./periods";

/**
 * The formula identifier stored on a comparable {@link ChangeResult}.
 * `difference = now − then`; `percent = (now − then) ÷ then × 100`.
 */
export const CHANGE_FORMULA_ID = "then-now-change-v1";

/**
 * Why two figures cannot be compared, named for the first failing check in the
 * order `kind`, `source`, `series_id`, `unit`, `region`, `unreadable_period`,
 * `no_newer_figure`.
 */
export type NotComparableReason =
  | "kind"
  | "source"
  | "series_id"
  | "unit"
  | "region"
  | "unreadable_period"
  | "no_newer_figure";

/**
 * The result of {@link computeChange}. When `comparable` is false, only the
 * `reason` is present and no numbers are produced. When it is true, the then
 * and now value and period strings are copied from the inputs exactly, the
 * `difference` is the exact canonical `now − then`, and `percent` is the
 * percentage change, or `null` when the then value is zero.
 */
export type ChangeResult =
  | { comparable: false; reason: NotComparableReason }
  | {
      comparable: true;
      formula: typeof CHANGE_FORMULA_ID;
      then: { value: string; period: string };
      now: { value: string; period: string };
      difference: string;
      percent: { value: string; exact: boolean } | null;
    };

// The period end as a "YYYY-MM-DD" string, or null when the period is neither a
// real date nor a real month. A real YYYY-MM-DD uses the weekly rule (itself);
// a real YYYY-MM uses the monthly rule (last day of the month).
function periodEndOrNull(period: string): string | null {
  if (isRealDate(period)) {
    return periodEnd(period, "weekly");
  }
  if (isRealMonth(period)) {
    return periodEnd(period, "monthly");
  }
  return null;
}

/**
 * Compare two sealed figures and compute the then-vs-now change.
 *
 * Comparability checks run in exactly this order, and the first failure is the
 * reason:
 *
 * 1. `kind` — either figure is not `official`, or the two kinds differ.
 * 2. `source` — the sources differ.
 * 3. `series_id` — the series identifiers differ.
 * 4. `unit` — the units differ.
 * 5. `region` — the regions differ.
 * 6. `unreadable_period` — either period is neither a real `YYYY-MM-DD` nor a
 *    real `YYYY-MM`.
 * 7. `no_newer_figure` — the now period end is not later than the then period
 *    end.
 *
 * On success the difference is `now − then` (exact) and the percent is
 * `(now − then) ÷ then × 100`, or `null` when the then value is zero. Value and
 * period strings are copied from the inputs as given. The inputs are never
 * mutated.
 */
export function computeChange(then: FigureV1, now: FigureV1): ChangeResult {
  if (then.kind !== "official" || now.kind !== "official") {
    return { comparable: false, reason: "kind" };
  }
  if (then.source !== now.source) {
    return { comparable: false, reason: "source" };
  }
  if (then.series_id !== now.series_id) {
    return { comparable: false, reason: "series_id" };
  }
  if (then.unit !== now.unit) {
    return { comparable: false, reason: "unit" };
  }
  if (then.region !== now.region) {
    return { comparable: false, reason: "region" };
  }

  const thenEnd = periodEndOrNull(then.period);
  const nowEnd = periodEndOrNull(now.period);
  if (thenEnd === null || nowEnd === null) {
    return { comparable: false, reason: "unreadable_period" };
  }
  if (nowEnd <= thenEnd) {
    return { comparable: false, reason: "no_newer_figure" };
  }

  const thenValue = parseDecimal(then.value);
  const nowValue = parseDecimal(now.value);
  const difference = sub(nowValue, thenValue);

  const percent = isZero(thenValue) ? null : ratioPercent(difference, thenValue);

  return {
    comparable: true,
    formula: CHANGE_FORMULA_ID,
    then: { value: then.value, period: then.period },
    now: { value: now.value, period: now.period },
    difference: toDecimalString(difference),
    percent,
  };
}
