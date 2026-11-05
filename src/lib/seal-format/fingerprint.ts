// Human-readable fingerprint of a sealed-letter envelope hash.
//
// A SHA-256 envelope hash is 64 lowercase hex characters. To make it easy to
// read aloud or compare by eye, it is shown as 16 groups of 4 characters
// separated by single spaces. formatFingerprint and parseFingerprint are exact
// inverses: parse(format(h)) === h for every valid hash.
//
// This module imports nothing. It is pure and safe to import from the browser
// or the server.

const HASH_PATTERN = /^[0-9a-f]{64}$/;
const FINGERPRINT_PATTERN = /^[0-9a-f]{4}( [0-9a-f]{4}){15}$/;

/**
 * Format a 64-character lowercase hex hash as 16 space-separated groups of 4
 * characters. Returns null when `hash` is not exactly 64 lowercase hex
 * characters.
 */
export function formatFingerprint(hash: string): string | null {
  if (!HASH_PATTERN.test(hash)) return null;
  const groups: string[] = [];
  for (let i = 0; i < 64; i += 4) {
    groups.push(hash.slice(i, i + 4));
  }
  return groups.join(" ");
}

/**
 * Parse a fingerprint produced by formatFingerprint back into the 64-character
 * lowercase hex hash. Returns null for any text that is not exactly that
 * format (wrong group count, wrong group length, uppercase, extra whitespace).
 */
export function parseFingerprint(text: string): string | null {
  if (!FINGERPRINT_PATTERN.test(text)) return null;
  return text.replace(/ /g, "");
}
