// Feature: 06-lock-and-unlock, Property 18 (design.md "Correctness Properties").
//
// Any formatting of a valid backup key is accepted before any request is made:
// `readBackupKeyField` accepts the key in grouped, ungrouped, lower-case,
// space-separated and dash-separated forms. For any single-character change
// that breaks the checksum it returns `mistyped_key`. Neither case calls fetch.
//
// Validates: Requirements 17.10, 21.6.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import { readBackupKeyField } from "./unlock";

// The crypto sub-modules are loaded dynamically (the barrel scan and the
// import-boundary test allow only dynamic loads of crypto under src/components).
type BackupKeyModule = typeof import("@/lib/crypto/backup-key");

let backup: BackupKeyModule;

/** Crockford Base32 alphabet, as the card form uses it. */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
/** Characters a card can contain that the parser would map to another digit. */
const CONFUSABLE = new Set(["I", "L", "O"]);
/** Substitution candidates: alphabet characters that the parser keeps as they are. */
const SAFE_SUBSTITUTES = ALPHABET.split("").filter((c) => !CONFUSABLE.has(c));

const keyBytes = fc.uint8Array({ minLength: 16, maxLength: 16 });

/** The 27 raw characters of a card (no hyphens). */
const raw = (card: string): string => card.replace(/-/g, "");

/** Group 27 raw characters in fours from the left, joined by `sep`. */
const grouped = (chars: string, sep: string): string => {
  const groups: string[] = [];
  for (let i = 0; i < chars.length; i += 4) {
    groups.push(chars.slice(i, i + 4));
  }
  return groups.join(sep);
};

beforeEach(async () => {
  backup = await import("@/lib/crypto/backup-key");
  // Any fetch during parsing is a defect: the key must be checked locally.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("readBackupKeyField must not make a request");
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Property 18: any formatting of a valid backup key is accepted", () => {
  it("accepts grouped, ungrouped, lower-case, space-separated and dash-separated forms", () => {
    fc.assert(
      fc.property(keyBytes, (bytes) => {
        const key = Uint8Array.from(bytes);
        const card = backup.formatBackupKey(key);
        const chars = raw(card);
        const forms = [
          card,
          chars,
          chars.toLowerCase(),
          grouped(chars, " "),
          grouped(chars, "-"),
          grouped(chars.toLowerCase(), " "),
        ];
        for (const form of forms) {
          const result = readBackupKeyField({ parseBackupKey: backup.parseBackupKey }, form);
          expect(result.ok).toBe(true);
          if (result.ok) {
            expect(Array.from(result.key)).toEqual(Array.from(key));
          }
        }
      }),
      { numRuns: 100 },
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("returns mistyped_key for any single-character substitution that breaks the checksum", () => {
    fc.assert(
      fc.property(
        keyBytes,
        fc.integer({ min: 0, max: 26 }),
        fc.integer({ min: 0, max: SAFE_SUBSTITUTES.length - 1 }),
        (bytes, position, pick) => {
          const card = backup.formatBackupKey(Uint8Array.from(bytes));
          const chars = raw(card).split("");
          const original = chars[position];
          // Choose a substitute that differs from the original character.
          const candidates = SAFE_SUBSTITUTES.filter((c) => c !== original);
          chars[position] = candidates[pick % candidates.length];
          const mutated = grouped(chars.join(""), "-");

          const result = readBackupKeyField({ parseBackupKey: backup.parseBackupKey }, mutated);
          expect(result).toEqual({ ok: false, notice: "mistyped_key" });
        },
      ),
      { numRuns: 100 },
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
