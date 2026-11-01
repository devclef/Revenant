// Feature: 04-real-figures, Property 5: The Bulletin columns are found by
// header key, wherever they are
//
// Property 4 (Bulletin half): Gaps are reported and never filled.
//
// Property-based tests (fast-check, numRuns: 100) for parseBulletinWorkbook.
//
// Property 5 generates Bulletin-shaped workbooks where the two header keys sit
// in any two distinct columns, surrounded by other columns, headers and row-1
// text. The parser must return the SAME series for any placement and report
// each key's ACTUAL column letter (by name, never by letter or position,
// R4.1/R4.4). Removing a key throws header_missing; repeating a key in a second
// column throws header_duplicated; a unit label other than `1000 l` throws
// unit_mismatch; two rows with the same date throw duplicate_date.
//
// Property 4 (Bulletin half) generates workbooks where some in-window value
// cells are emptied or text-replaced, then asserts every damaged period appears
// in `gaps` with the matching reason, appears in no `points`, and the undamaged
// periods' points are byte-for-byte those of the clean workbook — no value is
// ever borrowed from a neighbouring period (R3.5, R4.6, R14.4,
// data-integrity.md).
//
// Every number generated here is invented by the test and is clearly fake: it
// never reaches the Real_File or any display (data-integrity.md: "Seed and test
// data must be clearly fake and must never reach production or a demo presented
// as real"). No network is touched; this drives the pure parser only.

import fc from "fast-check";
import { describe, expect, it } from "vitest";
import * as XLSX from "@e965/xlsx";

import { SourceError } from "./errors";
import {
  parseBulletinWorkbook,
  type BulletinKey,
} from "./oil-bulletin";
import {
  buildXlsx,
  emptyCell,
  numberCell,
  serialCell,
  textCell,
  type CellSpec,
  type WorkbookDescription,
} from "./test-support/workbook";

const NUM_RUNS = 100;

const EURO95: BulletinKey = "EU_price_with_tax_euro95";
const DIESEL: BulletinKey = "EU_price_with_tax_diesel";
const KEYS: readonly BulletinKey[] = [EURO95, DIESEL] as const;

const SHEET_NAME = "Prices with taxes";
const UNIT = "1000 l";
const MARKER = "EU_";

// The in-window serial range. Coverage_Start is 2023-06-01 (serial 45078), so
// every generated serial lands safely on or after it: 45082 is 2023-06-05 and
// 47848 is 2030-12-31. Dates are read through serialToDate from column A.
const MIN_SERIAL = 45_082;
const MAX_SERIAL = 47_848;

/** The fixed layout columns: A is Date, B is the EU_ marker (read by position). */
const DATE_COLUMN = 0;
const MARKER_COLUMN = 1;

// --- Generators ------------------------------------------------------------

/**
 * A clearly-fake value cell: a plain non-negative decimal that round-trips
 * through the Decimal_Rule to `String(v)`. Kept to at most two fractional
 * digits so the stored double equals its shortest decimal, which makes the
 * "undamaged points are exactly equal" assertion deterministic. Every number
 * is invented here and never reaches a real figure.
 */
const fakeValue = fc
  .integer({ min: 0, max: 999_999 })
  .chain((whole) =>
    fc.integer({ min: 0, max: 99 }).map((cents) => whole + cents / 100),
  );

/** A distinct set of in-window date serials, newest-first order shuffled. */
function uniqueSerials(count: number): fc.Arbitrary<number[]> {
  return fc
    .uniqueArray(fc.integer({ min: MIN_SERIAL, max: MAX_SERIAL }), {
      minLength: count,
      maxLength: count,
    });
}

/**
 * One generated data row: its date serial and the euro95/diesel fake values.
 * How each value cell is rendered (a number, a blank gap or a text gap) is
 * decided by the `valueKind` callback passed to {@link buildBulletin}, so the
 * same rows drive both the clean and the damaged workbook.
 */
interface GenRow {
  serial: number;
  euro95: number;
  diesel: number;
}

// --- Workbook assembly -----------------------------------------------------

type ValueKind = "number" | "empty" | "text";

interface Placement {
  /** 0-based column index for the euro95 key (>= 2, never A or B). */
  euro95Col: number;
  /** 0-based column index for the diesel key (>= 2, distinct from euro95Col). */
  dieselCol: number;
  /** Extra leading/trailing filler columns of row-1 noise (kept simple). */
  rightPadding: number;
}

/**
 * Build a Bulletin-shaped workbook.
 *
 * Column A holds the date (found by its `Date` label in row 3), column B the
 * `EU_` marker (read by position). The two header keys sit in `placement`'s two
 * distinct columns, both at index >= 2, with filler text in every other column
 * of rows 1 and 3. Rows 4+ carry the data. `valueKind(row, key)` chooses
 * whether that cell is a number, empty, or text, so one builder makes both the
 * clean and the damaged workbook from the same rows.
 */
function buildBulletin(
  rows: GenRow[],
  placement: Placement,
  valueKind: (rowIndex: number, key: BulletinKey) => ValueKind,
  overrides: {
    omitKey?: BulletinKey;
    duplicateKey?: BulletinKey;
    badUnitKey?: BulletinKey;
  } = {},
): Uint8Array {
  const colOf: Record<BulletinKey, number> = {
    EU_price_with_tax_euro95: placement.euro95Col,
    EU_price_with_tax_diesel: placement.dieselCol,
  };

  // The rightmost column we will touch: the furthest key column, plus padding.
  const lastCol =
    Math.max(placement.euro95Col, placement.dieselCol) +
    1 +
    placement.rightPadding;

  const blankRow = (): CellSpec[] =>
    Array.from({ length: lastCol + 1 }, () => emptyCell());

  // Row 1 (index 0): the header keys in their columns, filler elsewhere. A
  // removed key leaves its cell filler; a duplicated key is written into one
  // extra trailing column too.
  const headerRow = blankRow();
  for (const key of KEYS) {
    headerRow[colOf[key]] =
      overrides.omitKey === key ? textCell(`other-${key}`) : textCell(key);
  }
  if (overrides.duplicateKey !== undefined) {
    headerRow[lastCol] = textCell(overrides.duplicateKey);
  }
  // Scatter some row-1 noise text in still-empty columns so the key is never
  // the only text in row 1.
  headerRow[0] = textCell(
    "Consumer prices inclusive of duties and taxes (fake test data)",
  );

  // Row 2 (index 1): product labels, harmless filler.
  const productRow = blankRow();
  productRow[colOf[EURO95]] = textCell("Euro-super 95 (I)");
  productRow[colOf[DIESEL]] = textCell("Automotive gas oil (I)");

  // Row 3 (index 2): the `Date` label in column A and the unit labels under the
  // two key columns. A bad-unit override replaces one key's label.
  const unitRow = blankRow();
  unitRow[DATE_COLUMN] = textCell("Date");
  for (const key of KEYS) {
    unitRow[colOf[key]] =
      overrides.badUnitKey === key ? textCell("1000 m") : textCell(UNIT);
  }

  // Data rows (index 3+): date in A, marker EU_ in B, value cells in the key
  // columns per `valueKind`, filler nowhere that matters.
  const dataRows: CellSpec[][] = rows.map((row, rowIndex) => {
    const cells = blankRow();
    cells[DATE_COLUMN] = serialCell(row.serial, "dd/mm/yy");
    cells[MARKER_COLUMN] = textCell(MARKER);
    const valueOf: Record<BulletinKey, number> = {
      EU_price_with_tax_euro95: row.euro95,
      EU_price_with_tax_diesel: row.diesel,
    };
    for (const key of KEYS) {
      const kind = valueKind(rowIndex, key);
      cells[colOf[key]] =
        kind === "number"
          ? numberCell(valueOf[key])
          : kind === "text"
            ? textCell("n/a")
            : emptyCell();
    }
    return cells;
  });

  const description: WorkbookDescription = {
    sheets: [{ name: SHEET_NAME, rows: [headerRow, productRow, unitRow, ...dataRows] }],
  };
  return buildXlsx(description);
}

/** Placement arbitrary: two distinct columns at index >= 2, plus padding. */
const placementArb: fc.Arbitrary<Placement> = fc
  .record({
    a: fc.integer({ min: 2, max: 8 }),
    gap: fc.integer({ min: 1, max: 6 }),
    swap: fc.boolean(),
    rightPadding: fc.integer({ min: 0, max: 3 }),
  })
  .map(({ a, gap, swap, rightPadding }) => {
    const first = a;
    const second = a + gap; // distinct from first
    return {
      euro95Col: swap ? second : first,
      dieselCol: swap ? first : second,
      rightPadding,
    };
  });

/** Rows arbitrary: between 1 and 6 rows, each with distinct in-window serials. */
const rowsArb: fc.Arbitrary<GenRow[]> = fc
  .integer({ min: 1, max: 6 })
  .chain((count) =>
    fc
      .tuple(
        uniqueSerials(count),
        fc.array(fakeValue, { minLength: count, maxLength: count }),
        fc.array(fakeValue, { minLength: count, maxLength: count }),
      )
      .map(([serials, euros, diesels]) =>
        serials.map((serial, i) => ({
          serial,
          euro95: euros[i],
          diesel: diesels[i],
        })),
      ),
  );

/** The expected ascending period for a value, as the parser would compute it. */
function serialPeriod(serial: number): string {
  const MS_PER_DAY = 86_400_000;
  const EPOCH_MS = Date.UTC(1899, 11, 30);
  const d = new Date(EPOCH_MS + serial * MS_PER_DAY);
  const pad = (n: number, w: number) => String(n).padStart(w, "0");
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1, 2)}-${pad(
    d.getUTCDate(),
    2,
  )}`;
}

/** Catch and return a SourceError, failing if none (or the wrong kind) thrown. */
function expectKind(run: () => unknown, kind: string): SourceError {
  try {
    run();
  } catch (err) {
    expect(err).toBeInstanceOf(SourceError);
    expect((err as SourceError).kind).toBe(kind);
    return err as SourceError;
  }
  throw new Error(`expected a SourceError of kind "${kind}", none thrown`);
}

// ---------------------------------------------------------------------------

describe("Property 5: the Bulletin columns are found by header key, wherever they are", () => {
  it("returns the same series for any column placement and reports the actual letters", () => {
    fc.assert(
      fc.property(rowsArb, placementArb, placementArb, (rows, placeA, placeB) => {
        const allNumbers = (): ValueKind => "number";
        const bytesA = buildBulletin(rows, placeA, () => allNumbers());
        const bytesB = buildBulletin(rows, placeB, () => allNumbers());

        const a = parseBulletinWorkbook(bytesA);
        const b = parseBulletinWorkbook(bytesB);

        // The series are identical regardless of where the keys sit.
        expect(a.series).toEqual(b.series);

        // Each reported column letter is the key's ACTUAL column, by name.
        expect(a.columns[EURO95]).toBe(XLSX.utils.encode_col(placeA.euro95Col));
        expect(a.columns[DIESEL]).toBe(XLSX.utils.encode_col(placeA.dieselCol));
        expect(b.columns[EURO95]).toBe(XLSX.utils.encode_col(placeB.euro95Col));
        expect(b.columns[DIESEL]).toBe(XLSX.utils.encode_col(placeB.dieselCol));

        // The points carry exactly the generated periods, ascending.
        const expectedPeriods = rows
          .map((r) => serialPeriod(r.serial))
          .sort((x, y) => (x < y ? -1 : 1));
        for (const key of KEYS) {
          expect(a.series[key].points.map((p) => p.period)).toEqual(
            expectedPeriods,
          );
          expect(a.series[key].gaps).toEqual([]);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("throws header_missing when a key is absent from every column", () => {
    fc.assert(
      fc.property(rowsArb, placementArb, fc.constantFrom(EURO95, DIESEL), (rows, place, omit) => {
        const bytes = buildBulletin(rows, place, () => "number", { omitKey: omit });
        expectKind(() => parseBulletinWorkbook(bytes), "header_missing");
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("throws header_duplicated when a key appears in a second column", () => {
    fc.assert(
      fc.property(rowsArb, placementArb, fc.constantFrom(EURO95, DIESEL), (rows, place, dup) => {
        const bytes = buildBulletin(rows, place, () => "number", {
          duplicateKey: dup,
        });
        expectKind(() => parseBulletinWorkbook(bytes), "header_duplicated");
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("throws unit_mismatch when a unit label is not '1000 l'", () => {
    fc.assert(
      fc.property(rowsArb, placementArb, fc.constantFrom(EURO95, DIESEL), (rows, place, bad) => {
        const bytes = buildBulletin(rows, place, () => "number", {
          badUnitKey: bad,
        });
        const err = expectKind(() => parseBulletinWorkbook(bytes), "unit_mismatch");
        expect(err.detail.foundUnit).toBe("1000 m");
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("throws duplicate_date when two rows carry the same date", () => {
    fc.assert(
      fc.property(
        placementArb,
        fc.integer({ min: MIN_SERIAL, max: MAX_SERIAL }),
        fakeValue,
        fakeValue,
        (place, serial, v1, v2) => {
          const rows: GenRow[] = [
            { serial, euro95: v1, diesel: v2 },
            { serial, euro95: v2, diesel: v1 },
          ];
          const bytes = buildBulletin(rows, place, () => "number");
          const err = expectKind(
            () => parseBulletinWorkbook(bytes),
            "duplicate_date",
          );
          expect(err.detail.date).toBe(serialPeriod(serial));
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

describe("Property 4 (Bulletin half): gaps are reported and never filled", () => {
  it("every damaged cell becomes a gap with the matching reason; undamaged points are unchanged", () => {
    fc.assert(
      fc.property(
        rowsArb,
        placementArb,
        // For each (row, key) choose keep / empty / text damage. The outer
        // array indexes rows; the inner tuple is [euro95 kind, diesel kind].
        fc.array(
          fc.tuple(
            fc.constantFrom<ValueKind>("number", "empty", "text"),
            fc.constantFrom<ValueKind>("number", "empty", "text"),
          ),
          { minLength: 6, maxLength: 6 },
        ),
        (rows, place, damage) => {
          const kindOf = (rowIndex: number, key: BulletinKey): ValueKind => {
            const pair = damage[rowIndex] ?? (["number", "number"] as const);
            return key === EURO95 ? pair[0] : pair[1];
          };

          const clean = parseBulletinWorkbook(
            buildBulletin(rows, place, () => "number"),
          );
          const damaged = parseBulletinWorkbook(
            buildBulletin(rows, place, kindOf),
          );

          for (const key of KEYS) {
            // Build the expected gaps and surviving points directly from the
            // generated damage, independently of the parser.
            const expectedGaps: { period: string; reason: string }[] = [];
            const survivingPeriods: string[] = [];
            rows.forEach((row, rowIndex) => {
              const period = serialPeriod(row.serial);
              const kind = kindOf(rowIndex, key);
              if (kind === "empty") {
                expectedGaps.push({ period, reason: "no_number" });
              } else if (kind === "text") {
                expectedGaps.push({ period, reason: "not_a_number" });
              } else {
                survivingPeriods.push(period);
              }
            });
            const ascending = (xs: string[]) =>
              [...xs].sort((a, b) => (a < b ? -1 : 1));

            // Gaps match exactly, in ascending period order (gaps are pushed in
            // row-encounter order, which is the ascending data order here).
            expect(
              [...damaged.series[key].gaps].sort((a, b) =>
                a.period < b.period ? -1 : 1,
              ),
            ).toEqual(
              [...expectedGaps].sort((a, b) => (a.period < b.period ? -1 : 1)),
            );

            // No damaged period appears in points.
            const damagedPeriods = new Set(
              expectedGaps.map((g) => g.period),
            );
            for (const point of damaged.series[key].points) {
              expect(damagedPeriods.has(point.period)).toBe(false);
            }

            // The surviving points are EXACTLY the clean points for those same
            // periods — no value borrowed from a neighbour, nothing shifted.
            expect(damaged.series[key].points.map((p) => p.period)).toEqual(
              ascending(survivingPeriods),
            );
            const cleanByPeriod = new Map(
              clean.series[key].points.map((p) => [p.period, p.value]),
            );
            for (const point of damaged.series[key].points) {
              expect(point.value).toBe(cleanByPeriod.get(point.period));
            }
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
