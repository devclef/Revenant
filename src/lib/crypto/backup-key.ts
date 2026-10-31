// Backup key: generation, display formatting and strict parsing.
//
// A backup key is 16 random bytes. It is the second way to unwrap a letter's
// DEK (the first is the passkey). The bytes never leave the browser and are
// never logged (crypto.md). This module only turns bytes into the printable
// card form and back; the key derivation lives in kdf.ts.
//
// Card form (design.md "Backup key format and checksum"):
//   - Read the 16 bytes as a 128-bit big-endian integer.
//   - Write it as 26 Crockford Base32 digits, alphabet
//     "0123456789ABCDEFGHJKMNPQRSTVWXYZ". 128 bits = 25 full 5-bit digits
//     (125 bits) + 3 high bits, so the first digit is always 0-7.
//   - Append one GF(32) check digit, giving 27 characters.
//   - Display the 27 characters hyphenated in groups of four from the left:
//     XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXC (the last group has three characters).
//
// Checksum: GF(2^5) with the irreducible polynomial x^5 + x^2 + 1 and the
// generator alpha = x. c = XOR over i=1..26 of d_i * alpha^i, where d_i is the
// i-th data digit (1-indexed, left to right) and multiplication is in the
// field. A single substitution and a swap of two distinct adjacent digits are
// both always detected (see design.md for the proof).
//
// Parsing (R3.7, R3.8): uppercase, strip hyphens and spaces, map I/L -> 1 and
// O -> 0, then require exactly 27 characters all in the alphabet, a first digit
// of 7 or less, and a matching checksum. Any failure returns `mistyped_key`
// and never any bytes, so a log or a shoulder-surfer learns nothing.
//
// WebCrypto only, browser-safe: the one platform call is
// `globalThis.crypto.getRandomValues`. This module imports no `node:` module
// and nothing from src/lib/db.

import type { BackupKeyBytes, ParsedBackupKey } from "./errors";

/** Crockford Base32 alphabet. Index is the 5-bit digit value. */
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Reverse lookup: char code -> 5-bit value, or -1 when not in the alphabet. */
const DECODE_TABLE: Int8Array = (() => {
  const table = new Int8Array(128).fill(-1);
  for (let i = 0; i < CROCKFORD.length; i++) {
    table[CROCKFORD.charCodeAt(i)] = i;
  }
  return table;
})();

/** Number of data digits (excludes the trailing check digit). */
const DATA_DIGITS = 26;
/** Total card length in digits, check digit included. */
const TOTAL_DIGITS = 27;
/** Backup key length in bytes. */
const KEY_BYTES = 16;

// --- GF(2^5) arithmetic, polynomial x^5 + x^2 + 1 ----------------------------

// Reduction mask: when a product's bit 5 is set, XOR in (x^2 + 1) = 0b00101
// to fold it back into the field. 0b100101 is the full modulus; we only ever
// XOR the low five bits (0b00101) after shifting.
const GF_MODULUS_LOW = 0b00101;

/** Multiply two field elements (each 0..31) in GF(2^5). */
function gfMul(a: number, b: number): number {
  let result = 0;
  let x = a;
  let y = b;
  for (let bit = 0; bit < 5; bit++) {
    if (y & 1) {
      result ^= x;
    }
    y >>= 1;
    const overflow = x & 0x10; // bit 4; shifting left makes it bit 5
    x = (x << 1) & 0x1f;
    if (overflow) {
      x ^= GF_MODULUS_LOW;
    }
  }
  return result;
}

/**
 * Precomputed powers of alpha = x (value 2): ALPHA_POW[i] = alpha^i in GF(2^5).
 * The check sum needs alpha^1 .. alpha^26, so 27 entries (index 0 = alpha^0).
 */
const ALPHA_POW: number[] = (() => {
  const pow = new Array<number>(TOTAL_DIGITS);
  pow[0] = 1;
  for (let i = 1; i < TOTAL_DIGITS; i++) {
    pow[i] = gfMul(pow[i - 1], 2);
  }
  return pow;
})();

/**
 * Compute the check digit from the 26 data digits (each 0..31), 1-indexed in
 * the polynomial: c = XOR over i=1..26 of d_i * alpha^i.
 */
function checkDigit(digits: readonly number[]): number {
  let c = 0;
  for (let i = 0; i < DATA_DIGITS; i++) {
    // d_i is digits[i - 1] in 1-indexed terms; here digits[i] with exponent i+1.
    c ^= gfMul(digits[i], ALPHA_POW[i + 1]);
  }
  return c;
}

// --- Integer <-> digit conversion --------------------------------------------

/** Encode 16 bytes (big-endian) as 26 Crockford Base32 digit values. */
function bytesToDigits(bytes: Uint8Array): number[] {
  // 128-bit big-endian value held as a bit buffer; extract 5 bits per digit,
  // most-significant first. 26 digits cover 130 bits, so the top digit carries
  // the high 3 bits of the integer plus two leading zero bits -> value 0..7.
  const digits = new Array<number>(DATA_DIGITS).fill(0);
  // Copy bytes into a working array of bits via a running accumulator.
  // Process from the most significant digit (leftmost) downward.
  let acc = 0n;
  for (let i = 0; i < KEY_BYTES; i++) {
    acc = (acc << 8n) | BigInt(bytes[i]);
  }
  for (let i = DATA_DIGITS - 1; i >= 0; i--) {
    digits[i] = Number(acc & 0x1fn);
    acc >>= 5n;
  }
  return digits;
}

/** Decode 26 Crockford Base32 digit values (big-endian) back to 16 bytes. */
function digitsToBytes(digits: readonly number[]): Uint8Array {
  let acc = 0n;
  for (let i = 0; i < DATA_DIGITS; i++) {
    acc = (acc << 5n) | BigInt(digits[i]);
  }
  // acc holds 130 bits; the top 2 bits are zero because the first digit is 0..7.
  const out = new Uint8Array(KEY_BYTES);
  for (let i = KEY_BYTES - 1; i >= 0; i--) {
    out[i] = Number(acc & 0xffn);
    acc >>= 8n;
  }
  return out;
}

// --- Public API --------------------------------------------------------------

/** Generate a fresh backup key: 16 random bytes via WebCrypto. */
export function generateBackupKey(): BackupKeyBytes {
  const bytes = new Uint8Array(KEY_BYTES);
  globalThis.crypto.getRandomValues(bytes);
  return bytes as BackupKeyBytes;
}

/**
 * Format 16 bytes as the printable card string: 27 Crockford Base32 characters
 * (26 data digits plus one check digit) hyphenated in groups of four from the
 * left, e.g. "XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXC".
 */
export function formatBackupKey(bytes: Uint8Array): string {
  if (bytes.length !== KEY_BYTES) {
    throw new Error("backup key must be 16 bytes");
  }
  const digits = bytesToDigits(bytes);
  const c = checkDigit(digits);
  const chars = digits.map((d) => CROCKFORD[d]).join("") + CROCKFORD[c];

  // Group in fours from the left.
  const groups: string[] = [];
  for (let i = 0; i < chars.length; i += 4) {
    groups.push(chars.slice(i, i + 4));
  }
  return groups.join("-");
}

/**
 * Parse a user-typed backup key. Normalises then validates strictly:
 * uppercases, strips hyphens and spaces, maps I/L -> 1 and O -> 0, then
 * requires exactly 27 alphabet characters, a first digit of 7 or less, and a
 * matching checksum. Any failure yields `{ ok: false, error: { kind:
 * "mistyped_key" } }` and never the bytes.
 */
export function parseBackupKey(input: string): ParsedBackupKey {
  const mistyped: ParsedBackupKey = {
    ok: false,
    error: { kind: "mistyped_key" },
  };

  // Normalise: uppercase, drop hyphens and spaces, map confusable letters.
  let normalised = "";
  for (const raw of input.toUpperCase()) {
    if (raw === "-" || raw === " ") {
      continue;
    }
    let ch = raw;
    if (ch === "I" || ch === "L") {
      ch = "1";
    } else if (ch === "O") {
      ch = "0";
    }
    normalised += ch;
  }

  if (normalised.length !== TOTAL_DIGITS) {
    return mistyped;
  }

  // Decode every character to a 5-bit value; reject anything out of alphabet.
  const values = new Array<number>(TOTAL_DIGITS);
  for (let i = 0; i < TOTAL_DIGITS; i++) {
    const code = normalised.charCodeAt(i);
    const v = code < 128 ? DECODE_TABLE[code] : -1;
    if (v < 0) {
      return mistyped;
    }
    values[i] = v;
  }

  // First digit must be 0..7 (128 bits fit in 26 digits with 3 top bits).
  if (values[0] > 7) {
    return mistyped;
  }

  const data = values.slice(0, DATA_DIGITS);
  const providedCheck = values[DATA_DIGITS];
  if (checkDigit(data) !== providedCheck) {
    return mistyped;
  }

  return { ok: true, key: digitsToBytes(data) as BackupKeyBytes };
}
