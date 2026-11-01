// Property-based tests for the EIA adapter (04-real-figures, fast-check).
//
// Two properties exercise `parseEiaWorkbook` over randomly generated,
// EIA-shaped workbooks built with the clearly-fake `test-support/workbook.ts`
// writer, as BOTH legacy `.xls` and OOXML `.xlsx` bytes:
//
//  - Property 3 (EIA readback): the parse of an undamaged workbook returns
//    exactly the numeric rows at or after Coverage_Start (2023-06-01),
//    ascending by period, each carrying cellToDecimal's output, and nothing for
//    an earlier date. A workbook whose B2 series ID differs throws
//    series_mismatch; one whose B3 unit label differs throws unit_mismatch.
//
//  - Property 4 (EIA half): emptying or texting some in-window value cells moves
//    exactly those periods into gaps with the matching reason and out of points,
//    and leaves every remaining point identical to the undamaged parse — no
//    value is ever borrowed from a neighbouring row.
//
// Every number generated here is invented in the test and clearly fake; none of
// it reaches a Recorded_Excerpt, the Real_File, or any display
// (data-integrity.md). The parse is pure, so no fetch guard is needed: these
// tests never build a Fetcher or touch the network.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { cellToDecimal, type Cell } from "./decimal-rule";
import { parseEiaWorkbook } from "./eia";
import { SourceError } from "./errors";
import { serialToDate } from "./serial-date";
import type { SourceFigure, SourceGap } from "./types";
import {
  buildWorkbook,
  emptyCell,
  numberCell,
  serialCell,
  textCell,
  type CellSpec,
  type WorkbookFormat,
} from "./test-support/workbook";

const NUM_RUNS = 100;

/** Both workbook formats the adapter must read, exercised on every run. */
const FORMATS: readonly WorkbookFormat[] = ["xls", "xlsx"];

/** A clearly-fake series ID that matches the adapter's `^[A-Z0-9_]+$`. */
const SERIES_ID = "FAKE_EIA_SERIES";

/** A B3 title ending in the accepted unit suffix (R3.3). */
const UNIT_TITLE =
  "Fake Weekly Retail Fuel Prices  (Dollars per Gallon)";

/** The number format every generated value cell carries. It renders three
 *  fractional digits, matching the EIA files, and — because every generated
 *  value is produced with exactly three fractional digits — makes the cell's
 *  display text equal `String(value)`, so cellToDecimal returns that string. */
const VALUE_FORMAT = "0.000";

// ---------------------------------------------------------------------------
// Date serials. Coverage_Start is 2023-06-01, which is serial 45078 in the
// 1900 date system. The generator draws serials from a window that straddles
// it, so a run holds both kept and dropped rows.
// ---------------------------------------------------------------------------

/** Serial of 2023-06-01 (Coverage_Start) in the 1900 date system. */
const COVERAGE_START_SERIAL = 45_078;

/** The lowest serial generated: ~90 days before Coverage_Start, so some rows
 *  always fall before the cut. */
const MIN_SERIAL = COVERAGE_START_SERIAL - 90;

/** The highest serial generated: ~400 days after Coverage_Start. */
const MAX_SERIAL = COVERAGE_START_SERIAL + 400;

/** True when a serial is at or after Coverage_Start (its period is kept). */
function isInWindow(serial: number): boolean {
  return serial >= COVERAGE_START_SERIAL;
}

// ---------------------------------------------------------------------------
// Generated rows. Each row has a unique date serial and is either a numeric
// value, an empty value cell, or a text value cell. Every generated value is a
// clearly-fake price produced with exactly three fractional digits so its
// shortest round-trip string and its displayed text agree.
// ---------------------------------------------------------------------------

type RowKind = "number" | "empty" | "text";

interface GeneratedRow {
  serial: number;
  kind: RowKind;
  /** Present only when `kind === "number"`: the stored double. */
  value?: number;
  /** Present only when `kind === "text"`: the text in the value slot. */
  text?: string;
}

/** A price in [0.001, 999.999] with exactly three fractional digits, so
 *  `String(value)` is a plain decimal and the `0.000` display text matches it. */
const priceArb: fc.Arbitrary<number> = fc
  .integer({ min: 1, max: 999_999 })
  .map((thousandths) => thousandths / 1000);

/** The text that may sit in a value slot for the `not_a_number` case: a short,
 *  clearly non-numeric label. */
const valueTextArb: fc.Arbitrary<string> = fc.constantFrom("NA", "W", "n/a", "--");

/** One generated row, keyed by a serial supplied by the caller (so serials stay
 *  unique across the set). */
function rowArb(serial: number): fc.Arbitrary<GeneratedRow> {
  return fc.oneof(
    priceArb.map((value) => ({ serial, kind: "number" as const, value })),
    fc.constant({ serial, kind: "empty" as const }),
    valueTextArb.map((text) => ({ serial, kind: "text" as const, text })),
  );
}

/**
 * A set of rows with UNIQUE serials in a RANDOM order. Serials are first drawn
 * as a unique set, then each is given a random kind, then the whole list is
 * shuffled so order never matches the sorted order by construction.
 */
const rowsArb: fc.Arbitrary<GeneratedRow[]> = fc
  .uniqueArray(fc.integer({ min: MIN_SERIAL, max: MAX_SERIAL }), {
    minLength: 1,
    maxLength: 25,
  })
  .chain((serials) =>
    fc
      .tuple(...serials.map((serial) => rowArb(serial)))
      .chain((rows) => fc.shuffledSubarray(rows, { minLength: rows.length })),
  );

/** Turn a generated row into the two-cell spec row the builder expects. */
function rowToCells(row: GeneratedRow): CellSpec[] {
  const dateCell = serialCell(row.serial);
  if (row.kind === "number") {
    return [dateCell, numberCell(row.value as number, VALUE_FORMAT)];
  }
  if (row.kind === "text") {
    return [dateCell, textCell(row.text as string)];
  }
  return [dateCell, emptyCell()];
}

/**
 * Build EIA-shaped workbook bytes from generated data rows, in the given format.
 * Row 1 is the "Back to Contents" row, row 2 is Sourcekey / series ID, row 3 is
 * the unit title in column B, then the data rows. `seriesId` and `unitTitle`
 * can be overridden for the mismatch cases.
 */
function buildEia(
  rows: GeneratedRow[],
  format: WorkbookFormat,
  overrides: { seriesId?: string; unitTitle?: string } = {},
): Uint8Array {
  const seriesId = overrides.seriesId ?? SERIES_ID;
  const unitTitle = overrides.unitTitle ?? UNIT_TITLE;
  return buildWorkbook(
    {
      sheets: [
        {
          name: "Data 1",
          rows: [
            [textCell("Back to Contents"), textCell(`Data 1: ${unitTitle}`)],
            [textCell("Sourcekey"), textCell(seriesId)],
            [textCell("Date"), textCell(unitTitle)],
            ...rows.map(rowToCells),
          ],
        },
      ],
    },
    format,
  );
}

/**
 * The expected parse of a set of generated rows, computed INDEPENDENTLY of the
 * adapter: keep only in-window serials, sort by period ascending, split numeric
 * rows into points and empty/text rows into gaps. The numeric value is taken
 * through `cellToDecimal` on a reconstructed numeric cell whose display text is
 * `String(value)` — the same string the three-decimal format produces — so the
 * oracle agrees with the adapter without re-reading the workbook bytes.
 */
function expectedParse(rows: GeneratedRow[]): {
  points: SourceFigure[];
  gaps: SourceGap[];
} {
  const inWindow = rows.filter((row) => isInWindow(row.serial));
  inWindow.sort((a, b) => a.serial - b.serial);

  const points: SourceFigure[] = [];
  const gaps: SourceGap[] = [];

  for (const row of inWindow) {
    const period = serialToDate(row.serial);
    if (row.kind === "number") {
      const value = row.value as number;
      // The `0.000` number format renders the value with exactly three
      // fractional digits as the cell's display text, which is what the reader
      // hands cellToDecimal; reconstruct that same `w` here so the oracle takes
      // the identical Decimal_Rule branch without re-reading the workbook bytes.
      const cell: Cell = { t: "n", v: value, w: value.toFixed(3) };
      points.push({ period, value: cellToDecimal(cell) });
    } else if (row.kind === "text") {
      gaps.push({ period, reason: "not_a_number" });
    } else {
      gaps.push({ period, reason: "no_number" });
    }
  }

  return { points, gaps };
}

/** Points sorted the way gaps are compared: ascending by period. */
function sortGaps(gaps: readonly SourceGap[]): SourceGap[] {
  return [...gaps].sort((a, b) => (a.period < b.period ? -1 : a.period > b.period ? 1 : 0));
}

describe("Property 3: EIA readback — an undamaged workbook parses to its in-window numeric rows", () => {
  // Feature: 04-real-figures, Property 3: EIA readback
  it("returns exactly the in-window points ascending, each with cellToDecimal's output, over .xls and .xlsx", () => {
    fc.assert(
      fc.property(rowsArb, (rows) => {
        const expected = expectedParse(rows);
        for (const format of FORMATS) {
          const bytes = buildEia(rows, format);
          const { points, gaps } = parseEiaWorkbook(bytes, SERIES_ID);

          // Points: exactly the in-window numeric rows, ascending, verbatim.
          expect(points).toEqual(expected.points);
          // Ascending by period, with no duplicate (serials were unique).
          const periods = points.map((p) => p.period);
          expect(periods).toEqual([...periods].sort());
          // No point for a date before Coverage_Start.
          for (const p of points) {
            expect(p.period >= "2023-06-01").toBe(true);
          }
          // Gaps: exactly the in-window empty/text rows, matching reasons.
          expect(sortGaps(gaps)).toEqual(sortGaps(expected.gaps));
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  // Feature: 04-real-figures, Property 3: EIA readback
  it("throws series_mismatch when B2 differs and unit_mismatch when B3 differs", () => {
    fc.assert(
      fc.property(rowsArb, (rows) => {
        for (const format of FORMATS) {
          // A different B2 series ID: series_mismatch.
          const wrongSeries = buildEia(rows, format, { seriesId: "OTHER_FAKE_SERIES" });
          try {
            parseEiaWorkbook(wrongSeries, SERIES_ID);
            expect.unreachable("expected series_mismatch");
          } catch (error) {
            expect(error).toBeInstanceOf(SourceError);
            expect((error as SourceError).kind).toBe("series_mismatch");
          }

          // A B3 title that does not end in the unit suffix: unit_mismatch.
          const wrongUnit = buildEia(rows, format, {
            unitTitle: "Fake Weekly Retail Fuel Prices",
          });
          try {
            parseEiaWorkbook(wrongUnit, SERIES_ID);
            expect.unreachable("expected unit_mismatch");
          } catch (error) {
            expect(error).toBeInstanceOf(SourceError);
            expect((error as SourceError).kind).toBe("unit_mismatch");
          }
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("Property 4: EIA half — emptying or texting in-window value cells only moves those periods to gaps", () => {
  // Feature: 04-real-figures, Property 4: EIA half
  it("damaged periods become matching gaps and every surviving point is unchanged (no borrowing)", () => {
    // Generate an all-numeric set of rows, then a damage plan that empties or
    // texts a subset of the IN-WINDOW rows. The surviving points must be byte
    // for byte what the undamaged workbook produced.
    const numericRowsArb: fc.Arbitrary<GeneratedRow[]> = fc
      .uniqueArray(fc.integer({ min: MIN_SERIAL, max: MAX_SERIAL }), {
        minLength: 1,
        maxLength: 25,
      })
      .chain((serials) =>
        fc.tuple(...serials.map((serial) => priceArb.map((value) => ({ serial, kind: "number" as const, value })))),
      );

    const damageArb: fc.Arbitrary<("empty" | "text")[]> = fc.array(
      fc.constantFrom("empty" as const, "text" as const),
      { minLength: 0, maxLength: 25 },
    );
    const textPickArb: fc.Arbitrary<string[]> = fc.array(valueTextArb, {
      minLength: 0,
      maxLength: 25,
    });

    fc.assert(
      fc.property(
        numericRowsArb,
        damageArb,
        textPickArb,
        fc.double({ min: 0, max: 1, noNaN: true }),
        (undamaged, damagePlan, textPicks, startFrac) => {
          const undamagedExpected = expectedParse(undamaged);

          // Choose which in-window rows to damage: a contiguous slice chosen by
          // a random start, so the kept rows surrounding it test non-borrowing.
          const inWindowIndices = undamaged
            .map((row, index) => ({ row, index }))
            .filter(({ row }) => isInWindow(row.serial))
            .map(({ index }) => index);

          const damaged: GeneratedRow[] = undamaged.map((row) => ({ ...row }));
          const start = Math.floor(startFrac * inWindowIndices.length);
          for (let k = 0; k < inWindowIndices.length; k += 1) {
            const plan = damagePlan[k];
            if (plan === undefined) {
              continue;
            }
            // Only damage from `start` onward, so some in-window rows always
            // survive to prove their points are untouched.
            if (k < start) {
              continue;
            }
            const targetIndex = inWindowIndices[k];
            if (plan === "empty") {
              damaged[targetIndex] = { serial: damaged[targetIndex].serial, kind: "empty" };
            } else {
              const text = textPicks[k % Math.max(textPicks.length, 1)] ?? "NA";
              damaged[targetIndex] = { serial: damaged[targetIndex].serial, kind: "text", text };
            }
          }

          const damagedExpected = expectedParse(damaged);

          for (const format of FORMATS) {
            const bytes = buildEia(damaged, format);
            const { points, gaps } = parseEiaWorkbook(bytes, SERIES_ID);

            // The parse matches the independent oracle for the damaged set.
            expect(points).toEqual(damagedExpected.points);
            expect(sortGaps(gaps)).toEqual(sortGaps(damagedExpected.gaps));

            // Every surviving point equals the value it had undamaged: no value
            // was borrowed from a neighbour when a sibling row was emptied.
            for (const point of points) {
              const original = undamagedExpected.points.find((p) => p.period === point.period);
              expect(original).toBeDefined();
              expect(point.value).toBe((original as SourceFigure).value);
            }

            // Every damaged in-window period is a gap and absent from points.
            for (const gap of damagedExpected.gaps) {
              expect(gaps).toContainEqual(gap);
              expect(points.find((p) => p.period === gap.period)).toBeUndefined();
            }
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
