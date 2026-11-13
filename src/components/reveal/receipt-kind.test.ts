// Property tests for receiptKindFor (spec 12-submission-polish, Property 4;
// Z1.3, Z1.4, Z2.7).
//
// For any sealed figure and any now figure or none, receiptKindFor returns
// "no_now" with no now figure, "single" exactly when isSameFigure is true, and
// otherwise the kind computeChange gives: "compared" when comparable, and
// "not_comparable" otherwise. A revised figure (same period, different value)
// is not_comparable.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import type { FigureV1 } from "@/lib/seal-format";
import { computeChange, isSameFigure } from "@/lib/figures";

import { receiptKindFor } from "./receipt-kind";

// A fixed official figure used by the named checks.
function baseOfficial(overrides: Partial<FigureV1> = {}): FigureV1 {
  return {
    kind: "official",
    metric_id: "us-gasoline",
    value: "3.40",
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

// Decimal strings that parseDecimal accepts: ^-?[0-9]+(\.[0-9]+)?$.
const digit = fc.constantFrom("0", "1", "2", "3", "4", "5", "6", "7", "8", "9");
const valueArb: fc.Arbitrary<string> = fc
  .record({
    negative: fc.boolean(),
    intDigits: fc.string({ unit: digit, minLength: 1, maxLength: 6 }),
    fracDigits: fc.string({ unit: digit, minLength: 0, maxLength: 4 }),
  })
  .map(({ negative, intDigits, fracDigits }) => {
    const body =
      fracDigits.length === 0 ? intDigits : `${intDigits}.${fracDigits}`;
    return negative && /[1-9]/.test(body) ? `-${body}` : body;
  });

// Monthly periods in a fixed band so that later and earlier months both occur.
const periodArb: fc.Arbitrary<string> = fc
  .record({
    year: fc.integer({ min: 2020, max: 2026 }),
    month: fc.integer({ min: 1, max: 12 }),
  })
  .map(({ year, month }) => `${year}-${String(month).padStart(2, "0")}`);

// A sealed figure, and a now figure that is sometimes the same series, and
// sometimes differs in region so computeChange rejects it.
const figureArb: fc.Arbitrary<FigureV1> = fc
  .record({ value: valueArb, period: periodArb })
  .map(({ value, period }) => baseOfficial({ value, period }));

const nowArb: fc.Arbitrary<FigureV1 | undefined> = fc.option(
  fc
    .record({
      figure: figureArb,
      mismatchRegion: fc.boolean(),
    })
    .map(({ figure, mismatchRegion }) =>
      mismatchRegion ? { ...figure, region: "Other region" } : figure,
    ),
  { nil: undefined },
);

describe("receiptKindFor (Property 4)", () => {
  it("returns no_now when there is no now figure", () => {
    fc.assert(
      fc.property(figureArb, (then) => {
        expect(receiptKindFor(then, undefined, undefined)).toBe("no_now");
      }),
    );
  });

  it("returns single exactly when isSameFigure is true", () => {
    fc.assert(
      fc.property(figureArb, nowArb, (then, now) => {
        if (now === undefined) return;
        const kind = receiptKindFor(then, now, computeChange(then, now));
        expect(kind === "single").toBe(isSameFigure(then, now));
      }),
    );
  });

  it("otherwise returns compared when computeChange is comparable, and not_comparable when it is not", () => {
    fc.assert(
      fc.property(figureArb, nowArb, (then, now) => {
        if (now === undefined || isSameFigure(then, now)) return;
        const change = computeChange(then, now);
        const kind = receiptKindFor(then, now, change);
        expect(kind).toBe(change.comparable ? "compared" : "not_comparable");
      }),
    );
  });

  it("gives compared for a zero change across two periods", () => {
    const then = baseOfficial({ value: "3.40", period: "2024-09" });
    const now = baseOfficial({ value: "3.40", period: "2024-10" });
    const change = computeChange(then, now);
    expect(change.comparable).toBe(true);
    expect(receiptKindFor(then, now, change)).toBe("compared");
  });

  it("gives not_comparable for a revision in the same period", () => {
    const then = baseOfficial({ value: "3.40", period: "2024-09" });
    const now = baseOfficial({ value: "3.41", period: "2024-09" });
    const change = computeChange(then, now);
    expect(change.comparable).toBe(false);
    expect(receiptKindFor(then, now, change)).toBe("not_comparable");
  });
});
