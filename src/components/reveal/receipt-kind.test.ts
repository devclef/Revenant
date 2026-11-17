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

import {
  receiptKindFor,
  showsChangeLine,
  type ReceiptKind,
} from "./receipt-kind";
import { REVEAL_COPY } from "./copy";
import { samePeriodLine } from "./same-period";

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

// Spec 14 R7.1 and R7.4: the letter kind decides between single and same_period
// for a Same_Figure, and only a compared card shows the change line.
describe("receiptKindFor letter kind (spec 14 R7.1)", () => {
  const then = baseOfficial({ value: "3.40", period: "2024-09" });
  const sameNow = baseOfficial({ value: "3.40", period: "2024-09" });

  it("keeps single for a persona Same_Figure, with or without the kind argument", () => {
    const change = computeChange(then, sameNow);
    expect(receiptKindFor(then, sameNow, change)).toBe("single");
    expect(receiptKindFor(then, sameNow, change, "persona")).toBe("single");
  });

  it("gives same_period for a live or real Same_Figure", () => {
    const change = computeChange(then, sameNow);
    expect(receiptKindFor(then, sameNow, change, "live")).toBe("same_period");
    expect(receiptKindFor(then, sameNow, change, "real")).toBe("same_period");
  });

  it("keeps a same-period revision as not_comparable for a live or real letter", () => {
    const revised = baseOfficial({ value: "3.41", period: "2024-09" });
    const change = computeChange(then, revised);
    expect(receiptKindFor(then, revised, change, "live")).toBe(
      "not_comparable",
    );
    expect(receiptKindFor(then, revised, change, "real")).toBe(
      "not_comparable",
    );
  });

  it("gives no_now for a live letter with no now figure", () => {
    expect(receiptKindFor(then, undefined, undefined, "live")).toBe("no_now");
  });
});

describe("showsChangeLine (spec 14 R7.4)", () => {
  it("is true only for a compared card", () => {
    const kinds: ReceiptKind[] = [
      "no_now",
      "single",
      "same_period",
      "compared",
      "not_comparable",
    ];
    for (const kind of kinds) {
      expect(showsChangeLine(kind)).toBe(kind === "compared");
    }
  });

  it("is true for a comparable change and false for a Same_Figure on a live letter", () => {
    const then = baseOfficial({ value: "3.40", period: "2024-09" });
    const later = baseOfficial({ value: "3.50", period: "2024-10" });
    const sameNow = baseOfficial({ value: "3.40", period: "2024-09" });
    expect(
      showsChangeLine(
        receiptKindFor(then, later, computeChange(then, later), "live"),
      ),
    ).toBe(true);
    expect(
      showsChangeLine(
        receiptKindFor(then, sameNow, computeChange(then, sameNow), "live"),
      ),
    ).toBe(false);
  });
});

describe("samePeriodLine (spec 14 R7.2)", () => {
  it("reads a YYYY-MM-DD period as a week", () => {
    expect(samePeriodLine("2024-09-02")).toBe(REVEAL_COPY.samePeriodWeek);
  });

  it("reads a YYYY-MM period as a month", () => {
    expect(samePeriodLine("2024-09")).toBe(REVEAL_COPY.samePeriodMonth);
  });

  it("reads any other period string as a plain period", () => {
    expect(samePeriodLine("2024")).toBe(REVEAL_COPY.samePeriodOther);
    expect(samePeriodLine("2024-Q3")).toBe(REVEAL_COPY.samePeriodOther);
    expect(samePeriodLine("")).toBe(REVEAL_COPY.samePeriodOther);
  });
});
