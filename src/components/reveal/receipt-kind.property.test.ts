// Feature: 14-write-desk, Property 13: The change line shows only for comparable, different figures
//
// For any sealed figure then, any optional now figure (the same record, the same
// record with one field changed, or a different record) and any letter kind,
// showsChangeLine(receiptKindFor(then, now, computeChange(then, now), kind)) is
// true if and only if a now figure exists, computeChange reports the pair
// comparable and isSameFigure(then, now) is false. A Same_Figure gives "single"
// for a persona letter and "same_period" for a live or real letter. A same-period
// pair with different values gives "not_comparable".
//
// Validates R7.1, R7.4, Q2.8.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import type { FigureV1 } from "@/lib/seal-format";

/** The official branch of a sealed figure, the only kind these cases build. */
type OfficialFigure = Extract<FigureV1, { kind: "official" }>;
import { computeChange, isSameFigure } from "@/lib/figures";

import type { LetterKind } from "./FigureLine";
import { receiptKindFor, showsChangeLine } from "./receipt-kind";

const MICRO = 1_000_000n;

const unitArb = fc.constantFrom("USD per gallon", "EUR per 1,000 litres");
const regionArb = fc.constantFrom("U.S. city average", "EU27, weighted average");
const periodArb = fc.constantFrom(
  "2024-09",
  "2026-09",
  "2026-10",
  "2024-09-30",
  "2026-09-14",
  "not-a-period",
);
const kindArb = fc.constantFrom<LetterKind>("persona", "live", "real");

/** A decimal string with exactly `scale` fraction digits, from micro-units. */
function textOf(micro: bigint, scale: number): string {
  const q = micro / 10n ** BigInt(6 - scale);
  const whole = q / 10n ** BigInt(scale);
  const frac = (q % 10n ** BigInt(scale)).toString().padStart(scale, "0");
  return `${whole}.${frac}`;
}

const valueArb = fc
  .tuple(fc.bigInt({ min: 0n, max: 500n * MICRO }), fc.constantFrom(2, 3))
  .map(([micro, scale]) => textOf(micro, scale));

const officialArb: fc.Arbitrary<OfficialFigure> = fc
  .record({
    value: valueArb,
    unit: unitArb,
    region: regionArb,
    period: periodArb,
    source: fc.constantFrom("U.S. EIA", "European Commission"),
    series_id: fc.constantFrom("SERIES-A", "SERIES-B"),
  })
  .map(
    (r) =>
      ({
        kind: "official",
        metric_id: "prop13",
        ...r,
        retrieved_at: "2026-10-30T14:02:11Z",
        source_url: "https://example.test/series",
      }) as OfficialFigure,
  );

/** The same record with one field changed to a different valid value. */
function changeOneField(figure: OfficialFigure, field: number): OfficialFigure {
  switch (field) {
    case 0:
      return { ...figure, value: `${figure.value}1` };
    case 1:
      return {
        ...figure,
        period: figure.period === "2026-09" ? "2024-09" : "2026-09",
      };
    case 2:
      return { ...figure, source: `${figure.source} (other)` };
    case 3:
      return { ...figure, series_id: `${figure.series_id}-X` };
    case 4:
      return {
        ...figure,
        unit:
          figure.unit === "USD per gallon" ? "EUR per 1,000 litres" : "USD per gallon",
      };
    default:
      return {
        ...figure,
        region:
          figure.region === "U.S. city average"
            ? "EU27, weighted average"
            : "U.S. city average",
      };
  }
}

type NowShape = "none" | "same" | "one-field" | "different";

/**
 * Build the now figure for one case: none, the same record, the same record
 * with one field changed, or the other (different) record.
 */
function nowFor(
  then: OfficialFigure,
  shape: NowShape,
  field: number,
  other: OfficialFigure,
): OfficialFigure | undefined {
  switch (shape) {
    case "none":
      return undefined;
    case "same":
      return { ...then };
    case "one-field":
      return changeOneField(then, field);
    case "different":
      return other;
  }
}

const caseArb = fc.record({
  then: officialArb,
  shape: fc.constantFrom<NowShape>("none", "same", "one-field", "different"),
  field: fc.integer({ min: 0, max: 5 }),
  other: officialArb,
  kind: kindArb,
});

describe("Property 13: the change line shows only for comparable, different figures", () => {
  it("shows the change line if and only if the pair is comparable and not a Same_Figure", () => {
    fc.assert(
      fc.property(caseArb, ({ then, shape, field, other, kind }) => {
        const now = nowFor(then, shape, field, other);
        const change = now === undefined ? undefined : computeChange(then, now);
        const kindOf = receiptKindFor(then, now, change, kind);

        const expected =
          now !== undefined &&
          change !== undefined &&
          change.comparable &&
          !isSameFigure(then, now);
        expect(showsChangeLine(kindOf)).toBe(expected);
      }),
      { numRuns: 300 },
    );
  });

  it("gives single for a persona Same_Figure and same_period for a live or real one", () => {
    fc.assert(
      fc.property(officialArb, kindArb, (then, kind) => {
        const now: OfficialFigure = { ...then };
        const change = computeChange(then, now);
        const kindOf = receiptKindFor(then, now, change, kind);
        expect(kindOf).toBe(kind === "persona" ? "single" : "same_period");
        expect(showsChangeLine(kindOf)).toBe(false);
      }),
      { numRuns: 200 },
    );
  });

  it("gives not_comparable for a same-period pair with different values", () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: 0n, max: 400n * MICRO }),
        fc.bigInt({ min: 1n, max: 50n }),
        officialArb,
        kindArb,
        (base, steps, template, kind) => {
          // Three fraction digits, so each step is one thousandth and the two
          // values differ at the stored precision.
          const then: OfficialFigure = {
            ...template,
            value: textOf(base, 3),
            kind: "official",
          };
          const now: OfficialFigure = {
            ...then,
            value: textOf(base + steps * 1000n, 3),
          };
          expect(isSameFigure(then, now)).toBe(false);
          const change = computeChange(then, now);
          expect(receiptKindFor(then, now, change, kind)).toBe("not_comparable");
        },
      ),
      { numRuns: 200 },
    );
  });
});
