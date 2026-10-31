import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  formatBackupKey,
  generateBackupKey,
  parseBackupKey,
} from "./backup-key";

// The Crockford Base32 alphabet, index = 5-bit digit value. Used to build and
// mutate card strings directly in the checksum tests.
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** Strip the display hyphens so a card string becomes 27 raw characters. */
const rawChars = (card: string): string => card.replace(/-/g, "");

/** Reassemble 27 raw characters into the hyphenated groups-of-four form. */
const groupFours = (chars: string): string => {
  const groups: string[] = [];
  for (let i = 0; i < chars.length; i += 4) {
    groups.push(chars.slice(i, i + 4));
  }
  return groups.join("-");
};

describe("generateBackupKey / formatBackupKey", () => {
  it("generates 16 bytes that format to 27 chars in groups of four", () => {
    const key = generateBackupKey();
    expect(key).toHaveLength(16);
    const card = formatBackupKey(key);
    // 27 characters, six groups of four plus a final group of three.
    expect(rawChars(card)).toHaveLength(27);
    expect(card).toMatch(
      /^[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{3}$/,
    );
  });

  it("always emits a leading data digit of 7 or less (128 bits in 26 digits)", () => {
    for (let i = 0; i < 50; i++) {
      const card = formatBackupKey(generateBackupKey());
      const first = CROCKFORD.indexOf(rawChars(card)[0]);
      expect(first).toBeGreaterThanOrEqual(0);
      expect(first).toBeLessThanOrEqual(7);
    }
  });

  it("formats a known all-zero key and parses it back", () => {
    const zero = new Uint8Array(16);
    const card = formatBackupKey(zero);
    // 26 zero data digits -> checksum of zero; all 27 chars are "0".
    expect(rawChars(card)).toBe("0".repeat(27));
    const parsed = parseBackupKey(card);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.key).toEqual(zero);
    }
  });

  it("rejects a non-16-byte input to formatBackupKey", () => {
    expect(() => formatBackupKey(new Uint8Array(15))).toThrow();
    expect(() => formatBackupKey(new Uint8Array(17))).toThrow();
  });
});

// Feature: 02-sealed-letters, Property 7: parse is the inverse of format, and
// normalisation (case, hyphen/space handling, I/L->1, O->0) does not change the
// parsed bytes.
describe("Property 7: round trip and normalisation", () => {
  it("parseBackupKey(formatBackupKey(bytes)) === bytes", () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 16, maxLength: 16 }), (bytes) => {
        const card = formatBackupKey(bytes);
        const parsed = parseBackupKey(card);
        expect(parsed.ok).toBe(true);
        if (parsed.ok) {
          expect(parsed.key).toEqual(bytes);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("random case, stripped/extra hyphens and spaces all parse to the same bytes", () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 16, maxLength: 16 }),
        // A per-character coin flip picks lower/upper case; booleans decide
        // whether to drop all separators and whether to sprinkle extra ones.
        fc.array(fc.boolean(), { minLength: 27, maxLength: 27 }),
        fc.boolean(),
        fc.boolean(),
        (bytes, caseFlips, dropSeparators, addSpaces) => {
          const canonical = parseBackupKey(formatBackupKey(bytes));
          expect(canonical.ok).toBe(true);

          const raw = rawChars(formatBackupKey(bytes));
          // Apply random case per character.
          let cased = "";
          for (let i = 0; i < raw.length; i++) {
            cased += caseFlips[i] ? raw[i].toLowerCase() : raw[i].toUpperCase();
          }
          // Either strip every separator, or add spaces between every char.
          let noisy: string;
          if (dropSeparators) {
            noisy = cased;
          } else if (addSpaces) {
            noisy = cased.split("").join("  ");
          } else {
            noisy = groupFours(cased);
          }

          const parsed = parseBackupKey(noisy);
          expect(parsed.ok).toBe(true);
          if (parsed.ok && canonical.ok) {
            expect(parsed.key).toEqual(canonical.key);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("I/L map to 1 and O maps to 0 without changing the parsed bytes", () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 16, maxLength: 16 }), (bytes) => {
        const raw = rawChars(formatBackupKey(bytes));
        const canonical = parseBackupKey(raw);
        expect(canonical.ok).toBe(true);

        // Replace every "1" with a randomly chosen confusable (I/L/i/l) and
        // every "0" with O/o. The normaliser must fold them back.
        let confused = "";
        for (const ch of raw) {
          if (ch === "1") {
            confused += "ILil"[Math.floor(Math.random() * 4)];
          } else if (ch === "0") {
            confused += Math.random() < 0.5 ? "O" : "o";
          } else {
            confused += ch;
          }
        }
        const parsed = parseBackupKey(confused);
        expect(parsed.ok).toBe(true);
        if (parsed.ok && canonical.ok) {
          expect(parsed.key).toEqual(canonical.key);
        }
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: 02-sealed-letters, Property 8: the GF(32) checksum catches a single
// substitution, an adjacent swap of two distinct characters, a wrong length and
// an out-of-alphabet character. Every corruption returns mistyped_key.
describe("Property 8: checksum and length detection", () => {
  it("rejects a single-character substitution", () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 16, maxLength: 16 }),
        fc.nat({ max: 26 }),
        fc.nat({ max: 30 }),
        (bytes, pos, shift) => {
          const raw = rawChars(formatBackupKey(bytes));
          const original = raw[pos];
          const origVal = CROCKFORD.indexOf(original);
          // Pick a different alphabet character at this position.
          const newVal = (origVal + 1 + shift) % 32;
          const mutated =
            raw.slice(0, pos) + CROCKFORD[newVal] + raw.slice(pos + 1);
          // A substitution at the leading digit may raise it above 7 (also a
          // reject) or change the checksum; either way it must not parse ok.
          const parsed = parseBackupKey(groupFours(mutated));
          expect(parsed.ok).toBe(false);
          if (!parsed.ok) {
            expect(parsed.error.kind).toBe("mistyped_key");
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("rejects an adjacent swap of two distinct characters", () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 16, maxLength: 16 }),
        fc.nat({ max: 25 }),
        (bytes, pos) => {
          const raw = rawChars(formatBackupKey(bytes));
          // Only exercise positions where the two chars actually differ; a swap
          // of identical chars is a no-op and must still parse (checked below).
          fc.pre(raw[pos] !== raw[pos + 1]);
          const swapped =
            raw.slice(0, pos) + raw[pos + 1] + raw[pos] + raw.slice(pos + 2);
          const parsed = parseBackupKey(groupFours(swapped));
          expect(parsed.ok).toBe(false);
          if (!parsed.ok) {
            expect(parsed.error.kind).toBe("mistyped_key");
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("rejects a wrong-length key", () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 16, maxLength: 16 }),
        fc.boolean(),
        (bytes, dropFromFront) => {
          const raw = rawChars(formatBackupKey(bytes));
          // Drop one character -> 26, or duplicate one -> 28. Both are wrong.
          const short = dropFromFront ? raw.slice(1) : raw.slice(0, -1);
          const long = dropFromFront ? raw[0] + raw : raw + raw[raw.length - 1];
          expect(parseBackupKey(short).ok).toBe(false);
          expect(parseBackupKey(long).ok).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("rejects an out-of-alphabet character", () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 16, maxLength: 16 }),
        fc.nat({ max: 26 }),
        // Characters that are not in the Crockford alphabet and are not mapped
        // confusables (I/L/O) or separators (-/space). U and $ and ! qualify.
        fc.constantFrom("U", "$", "!", "@", "#"),
        (bytes, pos, badChar) => {
          const raw = rawChars(formatBackupKey(bytes));
          const mutated = raw.slice(0, pos) + badChar + raw.slice(pos + 1);
          const parsed = parseBackupKey(mutated);
          expect(parsed.ok).toBe(false);
          if (!parsed.ok) {
            expect(parsed.error.kind).toBe("mistyped_key");
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
