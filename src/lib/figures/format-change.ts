// Display formatting for figures and the then-vs-now change
// (spec 03-persona-demo, design.md; R11.7–R11.9, R12.9).
//
// This module turns exact decimal-string values and raw period strings into
// English display text. Every magnitude is rendered with
// Intl.NumberFormat(locale, { ..., roundingMode: "halfExpand" }).format(str),
// where `str` is a decimal STRING produced by decimal.ts: format() uses the
// exact value the string represents and never converts it to a binary number.
// There is no Number(), parseFloat, parseInt or unary + on any value anywhere
// in this module, and a source-scan test enforces that.
//
// The sign of the change comes from the exact difference computed in
// change.ts, never from the rounded display text. The direction words
// (rose / fell / unchanged) are produced only here, so the copy module never
// duplicates them (R12.9).
//
// Pure module: imports only sibling figure helpers, nothing from
// src/lib/crypto, src/lib/db or Node built-ins.

import type { ChangeResult } from "./change";
import { localeForRegion } from "./locale";

const MINUS = "\u2212"; // U+2212 MINUS SIGN, not the hyphen-minus "-".

const MONTH_RE = /^\d{4}-\d{2}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The then-vs-now change, formatted for display. */
export interface ChangeDisplay {
  /** `"rose"`, `"fell"` or `"unchanged"`, from the exact difference. */
  direction: "rose" | "fell" | "unchanged";
  /** The signed magnitude, e.g. `"+3.00"`, `"−3.00"` (U+2212), `"0.00"`. */
  difference: string;
  /** The signed percentage to one fraction digit, or `null` when undefined. */
  percent: string | null;
  /** The then period, formatted for display. */
  thenPeriod: string;
  /** The now period, formatted for display. */
  nowPeriod: string;
}

// The number of fractional digits in a canonical decimal string, i.e. the
// digit count after the point. Pure string work, no numeric parsing of value.
function fractionDigits(value: string): number {
  const dot = value.indexOf(".");
  return dot === -1 ? 0 : value.length - dot - 1;
}

// The larger of two fraction-digit counts.
function maxFractionDigits(a: string, b: string): number {
  const fa = fractionDigits(a);
  const fb = fractionDigits(b);
  return fa > fb ? fa : fb;
}

// Strip a leading "-" (hyphen-minus) from a canonical decimal string so the
// magnitude can be formatted and the sign applied separately. Canonical "0" is
// never negative, so this only ever removes a real leading minus.
function magnitude(value: string): string {
  return value.charCodeAt(0) === 0x2d ? value.slice(1) : value;
}

/**
 * Format a decimal-string magnitude for display in the figure's region.
 *
 * The value is passed to `Intl.NumberFormat(...).format(value)` as a STRING, so
 * the exact decimal is rendered without ever becoming a binary float. Rounding,
 * when `fractionDigits` forces it, is half away from zero (`"halfExpand"`).
 * When `fractionDigits` is omitted the value is shown at its own precision.
 *
 * `signDisplay: "negative"` shows a minus only on a genuinely negative result:
 * a value that rounds to zero at the requested digits (e.g. `"-0.4"` at 0
 * digits) is formatted as negative zero, and the formatter then omits the sign,
 * yielding `"0"` rather than `"-0"`. A non-zero negative keeps its minus. This
 * is the only place the sign of a direct `formatValue` call is decided; the
 * callers pass magnitudes here and apply U+2212 themselves.
 */
export function formatValue(
  value: string,
  region: string,
  fractionDigits?: number,
): string {
  const locale = localeForRegion(region);
  const options: Intl.NumberFormatOptions = {
    roundingMode: "halfExpand",
    signDisplay: "negative",
  };
  if (fractionDigits !== undefined) {
    options.minimumFractionDigits = fractionDigits;
    options.maximumFractionDigits = fractionDigits;
  }
  // Intl.NumberFormat.format accepts a decimal string and uses the exact value
  // it represents (ECMA-402 FormatNumeric → the string number value), never a
  // binary float. TypeScript's lib types brand that overload argument as
  // `StringNumericLiteral`, a nominal type a plain string is not assignable to,
  // so the formatter is widened to accept a string here. This is a type-only
  // cast: the real argument stays the decimal string, which is the whole point
  // (design.md).
  const formatter = new Intl.NumberFormat(locale, options) as Intl.NumberFormat & {
    format(value: string): string;
  };
  return formatter.format(value);
}

/**
 * Format a raw period string for display in the figure's region.
 *
 * - `"YYYY-MM"` becomes a month and year, e.g. `"September 2024"`.
 * - `"YYYY-MM-DD"` becomes a full date, e.g. `"October 26, 2026"`.
 * - Anything else is returned exactly as stored.
 *
 * Uses `Intl.DateTimeFormat` with `timeZone: "UTC"` so the displayed month and
 * day match the stored period regardless of where the viewer is.
 */
export function formatPeriod(period: string, region: string): string {
  const locale = localeForRegion(region);

  if (MONTH_RE.test(period)) {
    const date = new Date(`${period}-01T00:00:00Z`);
    return new Intl.DateTimeFormat(locale, {
      timeZone: "UTC",
      year: "numeric",
      month: "long",
    }).format(date);
  }

  if (DATE_RE.test(period)) {
    const date = new Date(`${period}T00:00:00Z`);
    return new Intl.DateTimeFormat(locale, {
      timeZone: "UTC",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  }

  return period;
}

/**
 * Format a comparable {@link ChangeResult} for display.
 *
 * The direction and sign come from the exact `difference` in `result`, never
 * from the rounded text. The difference magnitude is shown with the larger
 * fraction-digit count of the two input values; the percent is shown with
 * exactly one fraction digit. A positive change is prefixed `+`, a negative one
 * `−` (U+2212), and an unchanged one carries no sign.
 */
export function formatChange(
  result: Extract<ChangeResult, { comparable: true }>,
  region: string,
): ChangeDisplay {
  // result.difference is already canonical from change.ts (toDecimalString),
  // so zero is exactly "0" and a negative value starts with a hyphen-minus.
  const diffSign = result.difference;

  let direction: ChangeDisplay["direction"];
  let numericSign: "" | "+" | typeof MINUS;
  if (diffSign === "0") {
    direction = "unchanged";
    numericSign = "";
  } else if (diffSign.charCodeAt(0) === 0x2d) {
    direction = "fell";
    numericSign = MINUS;
  } else {
    direction = "rose";
    numericSign = "+";
  }

  const diffDigits = maxFractionDigits(result.then.value, result.now.value);
  const differenceText =
    numericSign + formatValue(magnitude(result.difference), region, diffDigits);

  let percentText: string | null = null;
  if (result.percent !== null) {
    const p = result.percent.value;
    let percentSign: "" | "+" | typeof MINUS;
    if (p === "0") {
      percentSign = "";
    } else if (p.charCodeAt(0) === 0x2d) {
      percentSign = MINUS;
    } else {
      percentSign = "+";
    }
    percentText = `${percentSign}${formatValue(magnitude(p), region, 1)}%`;
  }

  return {
    direction,
    difference: differenceText,
    percent: percentText,
    thenPeriod: formatPeriod(result.then.period, region),
    nowPeriod: formatPeriod(result.now.period, region),
  };
}
