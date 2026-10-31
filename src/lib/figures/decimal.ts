// Exact decimal arithmetic for figure values (spec 03-persona-demo, design.md).
//
// A value string matching ^-?[0-9]+(\.[0-9]+)?$ is parsed into
// { int: bigint, scale: number }, where the value is int / 10^scale. All
// arithmetic is exact BigInt work on aligned scales. There is no Number(),
// parseFloat, parseInt or unary + on any value anywhere in this module, and a
// source-scan test enforces that. No dependency is needed; BigInt is in every
// browser the app supports and in Node 22.
//
// This module imports nothing from src/lib/crypto, src/lib/db or Node
// built-ins, so it is pure and safe to use in the browser and on the server.

// value = int / 10^scale. `scale` is a non-negative integer.
export interface Decimal {
  int: bigint;
  scale: number;
}

const VALUE_PATTERN = /^-?[0-9]+(\.[0-9]+)?$/;

const TEN = 10n;

function pow10(n: number): bigint {
  // n is a non-negative integer. Repeated multiply keeps everything in BigInt.
  let result = 1n;
  for (let i = 0; i < n; i += 1) {
    result *= TEN;
  }
  return result;
}

/**
 * Parse a canonical decimal value string into an exact {@link Decimal}.
 *
 * Throws {@link RangeError} when `s` does not match
 * `^-?[0-9]+(\.[0-9]+)?$`. The sign is folded into `int`, so `-0` parses to the
 * zero decimal (`int === 0n`).
 */
export function parseDecimal(s: string): Decimal {
  if (!VALUE_PATTERN.test(s)) {
    throw new RangeError(`not a decimal string: ${JSON.stringify(s)}`);
  }

  const negative = s.charCodeAt(0) === 0x2d; // "-"
  const body = negative ? s.slice(1) : s;

  const dot = body.indexOf(".");
  let digits: string;
  let scale: number;
  if (dot === -1) {
    digits = body;
    scale = 0;
  } else {
    digits = body.slice(0, dot) + body.slice(dot + 1);
    scale = body.length - dot - 1;
  }

  const magnitude = BigInt(digits);
  const int = negative ? -magnitude : magnitude;
  return { int, scale };
}

/**
 * Canonical decimal string for `d`: no trailing fractional zeros, and the zero
 * value is always `"0"` (never `"-0"`).
 */
export function toDecimalString(d: Decimal): string {
  if (d.int === 0n) {
    return "0";
  }

  const negative = d.int < 0n;
  let digits = (negative ? -d.int : d.int).toString();

  if (d.scale === 0) {
    return negative ? `-${digits}` : digits;
  }

  // Left-pad so there is at least one integer digit before the point.
  if (digits.length <= d.scale) {
    digits = "0".repeat(d.scale - digits.length + 1) + digits;
  }

  const cut = digits.length - d.scale;
  const intPart = digits.slice(0, cut);
  let fracPart = digits.slice(cut);

  // Trim trailing fractional zeros.
  let end = fracPart.length;
  while (end > 0 && fracPart.charCodeAt(end - 1) === 0x30) {
    end -= 1;
  }
  fracPart = fracPart.slice(0, end);

  const body = fracPart.length === 0 ? intPart : `${intPart}.${fracPart}`;
  return negative ? `-${body}` : body;
}

// Align two decimals to a common scale, returning both scaled ints and that
// scale. Exact: only BigInt multiplication by a power of ten.
function align(a: Decimal, b: Decimal): { ai: bigint; bi: bigint; scale: number } {
  if (a.scale === b.scale) {
    return { ai: a.int, bi: b.int, scale: a.scale };
  }
  if (a.scale > b.scale) {
    return { ai: a.int, bi: b.int * pow10(a.scale - b.scale), scale: a.scale };
  }
  return { ai: a.int * pow10(b.scale - a.scale), bi: b.int, scale: b.scale };
}

/** Exact sum `a + b`. */
export function add(a: Decimal, b: Decimal): Decimal {
  const { ai, bi, scale } = align(a, b);
  return { int: ai + bi, scale };
}

/** Exact difference `a - b`. */
export function sub(a: Decimal, b: Decimal): Decimal {
  const { ai, bi, scale } = align(a, b);
  return { int: ai - bi, scale };
}

/** True when `d` represents zero. */
export function isZero(d: Decimal): boolean {
  return d.int === 0n;
}

/** Result of {@link ratioPercent}: a canonical value string and whether the
 * long division terminated within the significant-digit budget. */
export interface RatioPercent {
  value: string;
  exact: boolean;
}

/**
 * Compute `(num ÷ den) × 100` as a canonical decimal string, via BigInt long
 * division carried to `sig` significant digits and rounded half-to-even at the
 * last digit. `exact` is `true` only when the division terminated within the
 * budget (no remainder left to round).
 *
 * `den` must be non-zero; the caller (change.ts) guards the then = 0 case.
 */
export function ratioPercent(num: Decimal, den: Decimal, sig = 20): RatioPercent {
  if (den.int === 0n) {
    throw new RangeError("ratioPercent: division by zero");
  }

  // numerator / denominator as exact integer fractions, each × its scale
  // factor, with the ×100 folded into the numerator.
  //   num = num.int / 10^num.scale
  //   den = den.int / 10^den.scale
  //   num/den = (num.int * 10^den.scale) / (den.int * 10^num.scale)
  //   ×100   => numerator × 100
  let numerator = num.int * pow10(den.scale) * 100n;
  let denominator = den.int * pow10(num.scale);

  // Work with sign separated so rounding is symmetric about zero.
  let negative = false;
  if (numerator < 0n) {
    numerator = -numerator;
    negative = !negative;
  }
  if (denominator < 0n) {
    denominator = -denominator;
    negative = !negative;
  }

  if (numerator === 0n) {
    return { value: "0", exact: true };
  }

  // Generate significant digits one at a time via long division. Track the
  // decimal exponent of the first digit so we can place the point afterwards.
  const digits: number[] = [];
  let remainder = numerator;

  // Normalise so remainder < denominator * 10, i.e. the first produced digit is
  // the leading significant digit. exponent is the power of ten of that first
  // digit (value ≈ firstDigit × 10^exponent).
  let exponent = 0;
  while (remainder >= denominator) {
    denominator *= TEN;
    exponent += 1;
  }
  // Now remainder < denominator. First significant digit has place value
  // 10^(exponent - 1).
  exponent -= 1;

  // Produce sig + 1 digits: sig to keep, one guard digit for rounding.
  const wanted = sig + 1;
  while (digits.length < wanted && remainder !== 0n) {
    remainder *= TEN;
    let digit = 0;
    while (remainder >= denominator) {
      remainder -= denominator;
      digit += 1;
    }
    digits.push(digit);
  }

  const terminated = remainder === 0n;

  // Round half-to-even at `sig` digits using the guard digit and any remainder.
  let kept = digits.slice(0, sig);
  const guard = digits.length > sig ? digits[sig] : 0;
  const hasMoreAfterGuard = remainder !== 0n || digits.length > sig + 1;

  let roundUp = false;
  if (guard > 5) {
    roundUp = true;
  } else if (guard === 5) {
    if (hasMoreAfterGuard) {
      roundUp = true;
    } else {
      // Exactly halfway: round to even.
      const lastKept = kept.length > 0 ? kept[kept.length - 1] : 0;
      roundUp = lastKept % 2 === 1;
    }
  }

  if (roundUp) {
    let i = kept.length - 1;
    while (i >= 0) {
      if (kept[i] === 9) {
        kept[i] = 0;
        i -= 1;
      } else {
        kept[i] += 1;
        break;
      }
    }
    if (i < 0) {
      // Carry rippled past the front: value became 1.000... × 10^(exponent+1).
      kept = [1, ...kept];
      exponent += 1;
    }
  }

  const exact = terminated && !roundUp && guard === 0;

  // Build a Decimal from the kept significant digits and the exponent, then
  // canonicalise. The first kept digit has place value 10^exponent, so the
  // whole integer `kept` has scale (digits.length - 1 - exponent).
  const digitString = kept.join("");
  const value = BigInt(digitString === "" ? "0" : digitString);
  const scale = kept.length - 1 - exponent;

  let decimal: Decimal;
  if (scale < 0) {
    decimal = { int: value * pow10(-scale), scale: 0 };
  } else {
    decimal = { int: value, scale };
  }
  if (negative) {
    decimal = { int: -decimal.int, scale: decimal.scale };
  }

  return { value: toDecimalString(decimal), exact };
}
