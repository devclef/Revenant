// Spreadsheet date-serial conversion for the data-source adapters
// (04-real-figures).
//
// Pure runtime module: no process.env, no console, and no import of
// @/lib/crypto, @/lib/db or @/lib/letter-store. Nothing outside
// src/lib/sources imports this folder (enforced by boundary.test.ts, R6.7).
//
// A spreadsheet stores a date as the number of days since the 1900 date
// system's epoch. `serialToDate` turns such a serial into a calendar date
// string, reading the resulting instant with UTC getters only, so the output
// never depends on the machine's timezone (R3.4, R4.5). The parser package's
// own date helpers are deliberately not used.

/**
 * The lowest serial we accept. Serials below 61 fall at or before the 1900
 * leap-year quirk (the 1900 date system treats 1900 as a leap year, so serial
 * 60 maps to the non-existent 1900-02-29). Refusing anything below 61 keeps the
 * conversion unambiguous.
 */
const MIN_SERIAL = 61;

/**
 * The highest serial we accept: 2,958,465 is 9999-12-31 in the 1900 date
 * system. Anything above would spill past year 9999.
 */
const MAX_SERIAL = 2_958_465;

/** Milliseconds in one day. */
const MS_PER_DAY = 86_400_000;

/**
 * The 1900 date-system epoch as a UTC instant: 1899-12-30. Adding
 * `serial * MS_PER_DAY` to it yields the serial's instant at UTC midnight.
 */
const EPOCH_MS = Date.UTC(1899, 11, 30);

/** Left-pad a non-negative integer to the given width with zeros. */
function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

/**
 * Convert a spreadsheet date serial to a `YYYY-MM-DD` calendar date.
 *
 * Accepts an integer from {@link MIN_SERIAL} to {@link MAX_SERIAL} inclusive.
 * Throws `RangeError` for a fraction, a non-number (including `NaN`), a value
 * below the minimum, or a value past the maximum (year 9999). The adapters turn
 * this `RangeError` into a `bad_date` source error with the row number.
 */
export function serialToDate(serial: number): string {
  if (typeof serial !== "number" || !Number.isFinite(serial)) {
    throw new RangeError(`serial must be a finite number, got ${String(serial)}`);
  }
  if (!Number.isInteger(serial)) {
    throw new RangeError(`serial must be an integer, got ${serial}`);
  }
  if (serial < MIN_SERIAL || serial > MAX_SERIAL) {
    throw new RangeError(
      `serial out of range [${MIN_SERIAL}, ${MAX_SERIAL}], got ${serial}`,
    );
  }

  const instant = new Date(EPOCH_MS + serial * MS_PER_DAY);
  const year = instant.getUTCFullYear();
  const month = instant.getUTCMonth() + 1;
  const day = instant.getUTCDate();

  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}
