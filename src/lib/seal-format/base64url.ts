// Unpadded base64url codec for the sealed-letter format.
//
// Alphabet: A-Z a-z 0-9 - _  (RFC 4648 §5, "URL and filename safe"), no
// padding. Decoding is strict so that every byte string has exactly one
// canonical encoding: padding, out-of-alphabet characters and non-zero
// trailing bits are all rejected. This matters for the envelope hash, where
// an ambiguous encoding would let two distinct strings describe the same
// bytes.
//
// This module imports nothing from src/lib/crypto or src/lib/db. It is pure
// and safe to import from either the browser or the server.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

// Reverse lookup: char code -> 6-bit value, or -1 when not in the alphabet.
const DECODE_TABLE: Int8Array = (() => {
  const table = new Int8Array(128).fill(-1);
  for (let i = 0; i < ALPHABET.length; i++) {
    table[ALPHABET.charCodeAt(i)] = i;
  }
  return table;
})();

/** Encode bytes as unpadded base64url. */
export function encodeBase64url(bytes: Uint8Array): string {
  let out = "";
  let i = 0;

  // Process full 3-byte groups -> 4 chars.
  for (; i + 3 <= bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out +=
      ALPHABET[(n >>> 18) & 0x3f] +
      ALPHABET[(n >>> 12) & 0x3f] +
      ALPHABET[(n >>> 6) & 0x3f] +
      ALPHABET[n & 0x3f];
  }

  const remaining = bytes.length - i;
  if (remaining === 1) {
    // 8 bits -> 2 chars (12 bits, 4 trailing zero bits dropped with padding).
    const n = bytes[i] << 16;
    out += ALPHABET[(n >>> 18) & 0x3f] + ALPHABET[(n >>> 12) & 0x3f];
  } else if (remaining === 2) {
    // 16 bits -> 3 chars (18 bits, 2 trailing zero bits dropped).
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out +=
      ALPHABET[(n >>> 18) & 0x3f] +
      ALPHABET[(n >>> 12) & 0x3f] +
      ALPHABET[(n >>> 6) & 0x3f];
  }

  return out;
}

/**
 * Decode unpadded base64url strictly. Rejects:
 *  - padding ('=') and any character outside the alphabet,
 *  - lengths that cannot come from any byte string (a group of exactly 1 char),
 *  - non-zero trailing bits in the final partial group,
 * so each byte string has exactly one valid encoding.
 *
 * When `expectedLength` is given, the decoded byte count must equal it.
 */
export function decodeBase64url(s: string, expectedLength?: number): Uint8Array {
  const len = s.length;

  // A base64 group is 4 chars -> 3 bytes; the final group may be 2 chars (1
  // byte) or 3 chars (2 bytes). A remainder of 1 char is impossible.
  const remainder = len % 4;
  if (remainder === 1) {
    throw new Error("invalid base64url: bad length");
  }

  const fullBytes = Math.floor(len / 4) * 3;
  const tailBytes = remainder === 0 ? 0 : remainder - 1;
  const byteLength = fullBytes + tailBytes;

  if (expectedLength !== undefined && byteLength !== expectedLength) {
    throw new Error("invalid base64url: unexpected length");
  }

  const sextet = (index: number): number => {
    const code = s.charCodeAt(index);
    const v = code < 128 ? DECODE_TABLE[code] : -1;
    if (v < 0) {
      throw new Error("invalid base64url: character out of alphabet");
    }
    return v;
  };

  const out = new Uint8Array(byteLength);
  let outIndex = 0;
  let i = 0;

  // Full 4-char groups.
  for (; i + 4 <= len; i += 4) {
    const n = (sextet(i) << 18) | (sextet(i + 1) << 12) | (sextet(i + 2) << 6) | sextet(i + 3);
    out[outIndex++] = (n >>> 16) & 0xff;
    out[outIndex++] = (n >>> 8) & 0xff;
    out[outIndex++] = n & 0xff;
  }

  if (remainder === 2) {
    // 2 chars -> 1 byte; the low 4 bits of the second char must be zero.
    const c0 = sextet(i);
    const c1 = sextet(i + 1);
    if ((c1 & 0x0f) !== 0) {
      throw new Error("invalid base64url: non-zero trailing bits");
    }
    out[outIndex++] = (c0 << 2) | (c1 >>> 4);
  } else if (remainder === 3) {
    // 3 chars -> 2 bytes; the low 2 bits of the third char must be zero.
    const c0 = sextet(i);
    const c1 = sextet(i + 1);
    const c2 = sextet(i + 2);
    if ((c2 & 0x03) !== 0) {
      throw new Error("invalid base64url: non-zero trailing bits");
    }
    out[outIndex++] = (c0 << 2) | (c1 >>> 4);
    out[outIndex++] = ((c1 & 0x0f) << 4) | (c2 >>> 2);
  }

  return out;
}

// A letter ID is 16 random bytes encoded as unpadded base64url: 22 chars.
// 16 bytes = 128 bits = 21 full sextets (126 bits) + 1 char carrying the
// final 2 data bits with 4 trailing zero bits. Those 4 zero bits mean the
// last char is one of A (000000), Q (010000), g (100000) or w (110000).
const LETTER_ID_RE = /^[A-Za-z0-9_-]{21}[AQgw]$/;

/** True when `s` is a canonical unpadded-base64url encoding of 16 bytes. */
export function isLetterId(s: string): boolean {
  return LETTER_ID_RE.test(s);
}
