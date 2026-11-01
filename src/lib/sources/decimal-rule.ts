// Cell-to-decimal conversion for the data-source adapters (04-real-figures).
//
// Pure runtime module: no process.env, no console, and no import of
// @/lib/crypto, @/lib/db or @/lib/letter-store. Nothing outside
// src/lib/sources imports this folder (enforced by boundary.test.ts, R6.7).
//
// A spreadsheet cell carries both the stored double (`v`) and the text the
// publisher chose to display (`w`). The Decimal_Rule turns a numeric cell into
// a decimal string at full published precision WITHOUT any arithmetic: the
// output is always one of two strings that already exist — the ECMAScript
// shortest round-trip form of the stored double, or the publisher's displayed
// text — so no rounding, scaling or `toFixed` is ever applied (R5.3,
// data-integrity.md: "Store values at full published precision … round only
// for display").

/**
 * A spreadsheet cell as the parser produces it with text generation on.
 * `t` is the cell type (`"n"` for numeric), `v` the stored value and `w` the
 * formatted display text.
 */
export interface Cell {
  t: string;
  v?: unknown;
  w?: string;
}

/**
 * A decimal string: an optional sign, digits, and an optional fractional part.
 * This deliberately excludes exponent forms (`1e21`, `1e-7`), which a value of
 * 1e21 or more, or below 1e-6, would produce via `String(v)` — those are
 * rejected as errors rather than stored.
 */
const DECIMAL_PATTERN = /^-?[0-9]+(\.[0-9]+)?$/;

/** The longest decimal string we store. */
const MAX_LENGTH = 40;

/**
 * Convert a numeric spreadsheet cell to a decimal string at full published
 * precision. Throws a plain `Error` (which the Adapters wrap as `bad_cell`,
 * naming the series ID, period and raw cell text) when the cell is not a finite
 * number or the result is not a plain decimal of at most 40 characters.
 *
 * The output is never computed: it is either `String(cell.v)` (the shortest
 * round-trip decimal for the stored double) or the publisher's displayed text
 * with spaces and thousands commas removed. The display text is preferred only
 * when it is a plain decimal that agrees with the stored value to Excel's own
 * 15 significant digits — i.e. the stored double is that display value plus
 * floating-point noise below the publisher's precision. `toPrecision` is used
 * only to compare the two; it never produces the returned string.
 */
export function cellToDecimal(cell: Cell): string {
  // 1. Numeric cell with a finite stored value, or error.
  if (cell.t !== "n" || typeof cell.v !== "number" || !Number.isFinite(cell.v)) {
    throw new Error(
      `cell is not a finite number (t=${JSON.stringify(cell.t)}, v=${JSON.stringify(cell.v)})`,
    );
  }
  const v = cell.v;

  // 2. The shortest round-trip decimal for the stored double.
  const s = String(v);

  // 3. The displayed text with spaces and thousands commas removed.
  const d = typeof cell.w === "string" ? cell.w.replace(/[\s,]/g, "") : "";

  // 4. Noise guard: prefer the display text only when it is a plain decimal
  //    that differs from `s` yet agrees with the stored value to 15 digits.
  let result = s;
  if (
    d !== "" &&
    d !== s &&
    DECIMAL_PATTERN.test(d) &&
    v.toPrecision(15) === Number(d).toPrecision(15)
  ) {
    result = d;
  }

  // 5. The result must be a plain decimal of at most 40 characters. This
  //    rejects exponent forms like `1e21` and `1e-7`.
  if (!DECIMAL_PATTERN.test(result) || result.length > MAX_LENGTH) {
    throw new Error(`value is not a plain decimal: ${JSON.stringify(result)}`);
  }

  return result;
}
