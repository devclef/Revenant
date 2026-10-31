// Feature: 02-sealed-letters, Property 3: Header strictness.
//
// Property 3: for any valid v1 header, every single mutation from the
// design.md generator set is rejected by parseEnvelope, and the rejection
// names the failed rule (a concrete field path, or the unrecognized key).
// Separately: any positive integer formatVersion not in the registry yields
// `unsupported_format`, and headerWithoutCiphertext drops only
// `payloadCiphertext`.
//
// fast-check numRuns 100.

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { encodeBase64url } from "../base64url";
import { parseEnvelope } from "../registry";
import {
  headerV1Schema,
  headerWithoutCiphertext,
  type EnvelopeV1,
} from "./header";

// --- Byte helpers ------------------------------------------------------------

// A canonical base64url string for `n` bytes, content derived from a seed so
// different fields get different (but deterministic) values.
function bytesB64(n: number, seed: number): string {
  const b = new Uint8Array(n);
  for (let i = 0; i < n; i++) b[i] = (seed + i * 31) & 0xff;
  return encodeBase64url(b);
}

const letterIdArb: fc.Arbitrary<string> = fc
  .uint8Array({ minLength: 16, maxLength: 16 })
  .map((b) => encodeBase64url(b));

// A millisecond Z timestamp from a real instant.
const millisZArb: fc.Arbitrary<string> = fc
  .date({
    min: new Date("2000-01-01T00:00:00.000Z"),
    max: new Date("2099-12-31T23:59:59.999Z"),
    noInvalidDate: true,
  })
  .map((d) => d.toISOString());

const nonceArb = fc
  .uint8Array({ minLength: 12, maxLength: 12 })
  .map((b) => encodeBase64url(b));
const wrappedKeyArb = fc
  .uint8Array({ minLength: 48, maxLength: 48 })
  .map((b) => encodeBase64url(b));

// Payload ciphertext: 16 bytes to a small-but-varied size (full range is
// 16..1 MiB; a few KiB is enough to exercise the schema).
const ciphertextArb = fc
  .uint8Array({ minLength: 16, maxLength: 4096 })
  .map((b) => encodeBase64url(b));

// Optional passkey fields.
const rpIdArb = fc.constantFrom(
  "localhost",
  "revenant.devclef.se",
  "example.com",
  "a.b.c.example.org",
);
const credentialIdArb = fc
  .uint8Array({ minLength: 1, maxLength: 256 })
  .map((b) => encodeBase64url(b));
const prfSaltArb = fc
  .uint8Array({ minLength: 32, maxLength: 32 })
  .map((b) => encodeBase64url(b));

// --- Valid header generator --------------------------------------------------

// A backup wrap and an optional passkey wrap. When a passkey wrap exists, the
// three passkey fields are present; otherwise they are absent. Wraps are always
// emitted in sorted order (backup before passkey).
const validHeaderArb: fc.Arbitrary<EnvelopeV1> = fc
  .record({
    letterId: letterIdArb,
    sealedAt: millisZArb,
    opensAt: millisZArb,
    payloadNonce: nonceArb,
    payloadCiphertext: ciphertextArb,
    backupNonce: nonceArb,
    backupKey: wrappedKeyArb,
    withPasskey: fc.boolean(),
    passkeyNonce: nonceArb,
    passkeyKey: wrappedKeyArb,
    rpId: rpIdArb,
    credentialId: credentialIdArb,
    prfSalt: prfSaltArb,
  })
  .map((r): EnvelopeV1 => {
    const wrappedDeks: EnvelopeV1["wrappedDeks"] = [
      { factor: "backup", nonce: r.backupNonce, wrappedKey: r.backupKey },
    ];
    if (r.withPasskey) {
      wrappedDeks.push({
        factor: "passkey",
        nonce: r.passkeyNonce,
        wrappedKey: r.passkeyKey,
      });
    }
    const base = {
      letterId: r.letterId,
      formatVersion: 1 as const,
      sealedAt: r.sealedAt,
      opensAt: r.opensAt,
      payloadNonce: r.payloadNonce,
      payloadCiphertext: r.payloadCiphertext,
      wrappedDeks,
    };
    return (
      r.withPasskey
        ? {
            ...base,
            rpId: r.rpId,
            credentialId: r.credentialId,
            prfSalt: r.prfSalt,
          }
        : base
    ) as EnvelopeV1;
  });

// Sanity: the generator only ever emits headers the schema accepts, so a
// failing mutation test means the mutation, not the baseline.
describe("validHeaderArb baseline", () => {
  it("every generated header parses", () => {
    fc.assert(
      fc.property(validHeaderArb, (h) => {
        const r = parseEnvelope(h);
        expect(r.ok).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});

// --- Mutations ---------------------------------------------------------------

// A mutation returns an invalid variant of a valid header, or undefined when it
// cannot apply (for example "unsort the wraps" on a backup-only header).
type Mutation = (h: EnvelopeV1) => unknown | undefined;

// A mutation entry: [label, mutate, rootUnknownKey?]. parseEnvelope names the
// failed rule as a '.'-joined field path. For most mutations that path is
// non-empty. An unrecognized key at the object ROOT is the one exception: Zod
// reports it with an empty path but names the key in the issue's `keys`, so the
// joined field is "". The flag marks that case so the test asserts the rule is
// still named (via an unrecognized_keys issue naming the key) rather than
// demanding a non-empty path.
type MutationEntry = readonly [string, Mutation, boolean?];

function clone(h: EnvelopeV1): Record<string, unknown> {
  return JSON.parse(JSON.stringify(h)) as Record<string, unknown>;
}

const asWraps = (v: unknown): Record<string, unknown>[] =>
  v as Record<string, unknown>[];

const mutations: ReadonlyArray<MutationEntry> = [
  // --- Missing required fields ---
  [
    "missing letterId",
    (h) => {
      const c = clone(h);
      delete c.letterId;
      return c;
    },
  ],
  [
    "missing sealedAt",
    (h) => {
      const c = clone(h);
      delete c.sealedAt;
      return c;
    },
  ],
  [
    "missing opensAt",
    (h) => {
      const c = clone(h);
      delete c.opensAt;
      return c;
    },
  ],
  [
    "missing payloadNonce",
    (h) => {
      const c = clone(h);
      delete c.payloadNonce;
      return c;
    },
  ],
  [
    "missing payloadCiphertext",
    (h) => {
      const c = clone(h);
      delete c.payloadCiphertext;
      return c;
    },
  ],
  [
    "missing wrappedDeks",
    (h) => {
      const c = clone(h);
      delete c.wrappedDeks;
      return c;
    },
  ],
  [
    "missing wrap nonce",
    (h) => {
      const c = clone(h);
      delete asWraps(c.wrappedDeks)[0].nonce;
      return c;
    },
  ],
  [
    "missing wrap wrappedKey",
    (h) => {
      const c = clone(h);
      delete asWraps(c.wrappedDeks)[0].wrappedKey;
      return c;
    },
  ],

  // --- Unknown fields ---
  [
    "unknown key at header root",
    (h) => {
      const c = clone(h);
      c.extra = "nope";
      return c;
    },
    true, // root-level unrecognized key: joined field path is empty, key named in issue.keys
  ],
  [
    "unknown key on a wrap",
    (h) => {
      const c = clone(h);
      asWraps(c.wrappedDeks)[0].surprise = 1;
      return c;
    },
  ],

  // --- binary wrong length / padding / non-canonical trailing bits ---
  [
    "payloadNonce wrong length",
    (h) => {
      const c = clone(h);
      c.payloadNonce = bytesB64(11, 7); // 11 bytes, not 12
      return c;
    },
  ],
  [
    "wrap nonce wrong length",
    (h) => {
      const c = clone(h);
      asWraps(c.wrappedDeks)[0].nonce = bytesB64(13, 9); // 13 bytes, not 12
      return c;
    },
  ],
  [
    "wrappedKey wrong length",
    (h) => {
      const c = clone(h);
      asWraps(c.wrappedDeks)[0].wrappedKey = bytesB64(47, 3); // 47 bytes, not 48
      return c;
    },
  ],
  [
    "payloadNonce with padding",
    (h) => {
      const c = clone(h);
      // A canonical 12-byte nonce is 16 chars; adding '=' padding is rejected.
      c.payloadNonce = `${bytesB64(12, 1)}==`;
      return c;
    },
  ],
  [
    "payloadNonce out-of-alphabet character",
    (h) => {
      const c = clone(h);
      const good = bytesB64(12, 1);
      // Swap the last char for '+', which is base64 (not base64url) alphabet.
      c.payloadNonce = `${good.slice(0, -1)}+`;
      return c;
    },
  ],
  [
    "prfSalt non-canonical trailing bits",
    (h) => {
      // Only meaningful on a passkey header, where prfSalt (32 bytes = 43
      // chars) is present. 32 bytes -> 43 chars, final char carries 2 data
      // bits + 4 trailing bits that must be zero. Replace the last char with
      // one whose low bits are set.
      if ((h as { prfSalt?: string }).prfSalt === undefined) return undefined;
      const c = clone(h);
      const salt = c.prfSalt as string;
      // Base64url index of 'B' = 1 -> lowest bit set -> non-zero trailing bits
      // for a 43-char (remainder-3) group final char.
      c.prfSalt = `${salt.slice(0, -1)}B`;
      return c;
    },
  ],
  [
    "letterId wrong byte length",
    (h) => {
      const c = clone(h);
      c.letterId = bytesB64(15, 5); // 15 bytes, not 16
      return c;
    },
  ],

  // --- Non-millisecond-Z timestamps ---
  [
    "sealedAt without Z (offset form)",
    (h) => {
      const c = clone(h);
      c.sealedAt = "2026-10-31T12:00:00.000+00:00";
      return c;
    },
  ],
  [
    "opensAt without milliseconds",
    (h) => {
      const c = clone(h);
      c.opensAt = "2027-02-01T00:00:00Z"; // no .000
      return c;
    },
  ],
  [
    "sealedAt not a real instant",
    (h) => {
      const c = clone(h);
      c.sealedAt = "2026-13-40T99:99:99.000Z";
      return c;
    },
  ],

  // --- Duplicate or unsorted wrap factor ---
  [
    "duplicate wrap factor",
    (h) => {
      const c = clone(h);
      const wraps = asWraps(c.wrappedDeks);
      // Force a second backup wrap (duplicate factor). If a passkey wrap
      // exists this also makes the passkey-field rule irrelevant; the dup
      // rule fires first.
      if (wraps.length === 1) {
        wraps.push({ ...wraps[0] });
      } else {
        wraps[1].factor = "backup";
      }
      return c;
    },
  ],
  [
    "unsorted wrap factor (passkey before backup)",
    (h) => {
      const c = clone(h);
      const wraps = asWraps(c.wrappedDeks);
      if (wraps.length < 2) return undefined; // needs both wraps to unsort
      c.wrappedDeks = [wraps[1], wraps[0]];
      return c;
    },
  ],
  [
    "too many wraps (three)",
    (h) => {
      const c = clone(h);
      const wraps = asWraps(c.wrappedDeks);
      c.wrappedDeks = [wraps[0], { ...wraps[0] }, { ...wraps[0] }];
      return c;
    },
  ],
  [
    "empty wraps",
    (h) => {
      const c = clone(h);
      c.wrappedDeks = [];
      return c;
    },
  ],

  // --- Passkey fields without a passkey wrap ---
  [
    "rpId without a passkey wrap",
    (h) => {
      if ((h as { rpId?: string }).rpId !== undefined) return undefined; // only on backup-only
      const c = clone(h);
      c.rpId = "revenant.devclef.se";
      return c;
    },
  ],
  [
    "credentialId without a passkey wrap",
    (h) => {
      if ((h as { credentialId?: string }).credentialId !== undefined)
        return undefined;
      const c = clone(h);
      c.credentialId = bytesB64(32, 11);
      return c;
    },
  ],
  [
    "prfSalt without a passkey wrap",
    (h) => {
      if ((h as { prfSalt?: string }).prfSalt !== undefined) return undefined;
      const c = clone(h);
      c.prfSalt = bytesB64(32, 13);
      return c;
    },
  ],

  // --- Passkey wrap without all three passkey fields ---
  [
    "passkey wrap missing rpId",
    (h) => {
      if ((h as { rpId?: string }).rpId === undefined) return undefined; // needs a passkey header
      const c = clone(h);
      delete c.rpId;
      return c;
    },
  ],
  [
    "passkey wrap missing credentialId",
    (h) => {
      if ((h as { credentialId?: string }).credentialId === undefined)
        return undefined;
      const c = clone(h);
      delete c.credentialId;
      return c;
    },
  ],
  [
    "passkey wrap missing prfSalt",
    (h) => {
      if ((h as { prfSalt?: string }).prfSalt === undefined) return undefined;
      const c = clone(h);
      delete c.prfSalt;
      return c;
    },
  ],

  // --- formatVersion not a positive integer (schema-level literal(1)) ---
  [
    "formatVersion zero",
    (h) => {
      const c = clone(h);
      c.formatVersion = 0;
      return c;
    },
  ],
  [
    "formatVersion negative",
    (h) => {
      const c = clone(h);
      c.formatVersion = -1;
      return c;
    },
  ],
  [
    "formatVersion non-integer",
    (h) => {
      const c = clone(h);
      c.formatVersion = 1.5;
      return c;
    },
  ],
  [
    "formatVersion not a number",
    (h) => {
      const c = clone(h);
      c.formatVersion = "1";
      return c;
    },
  ],
];

describe("Property 3: a single mutation to a valid v1 header is rejected, naming the failed rule", () => {
  for (const [label, mutate, fieldMayBeEmpty] of mutations) {
    it(`rejects: ${label}`, () => {
      fc.assert(
        fc.property(validHeaderArb, (h) => {
          const mutated = mutate(h);
          // Skip runs where the mutation does not apply (e.g. a passkey-only
          // mutation on a backup-only header).
          fc.pre(mutated !== undefined);

          const result = parseEnvelope(mutated);
          expect(result.ok).toBe(false);
          if (result.ok) return;

          // A formatVersion that is zero, negative, non-integer or non-numeric
          // is not a known positive-integer version, so parseEnvelope reports
          // `unsupported_format` before the schema runs. Every other mutation
          // keeps formatVersion === 1, so the schema runs and reports
          // `invalid` with a field path naming the failed rule.
          const fv = (mutated as { formatVersion?: unknown }).formatVersion;
          const versionIsKnown =
            typeof fv === "number" && Number.isInteger(fv) && fv === 1;

          if (!versionIsKnown) {
            expect(result.error).toBe("unsupported_format");
            return;
          }

          expect(result.error).toBe("invalid");
          if (result.error !== "invalid") return;

          if (fieldMayBeEmpty) {
            // The one case parseEnvelope collapses to an empty joined path: a
            // root-level unknown key. The rule is still named — assert the
            // schema flags it as an unrecognized key and names that key.
            const parsed = headerV1Schema.safeParse(mutated);
            expect(parsed.success).toBe(false);
            if (parsed.success) return;
            const rootUnknown = parsed.error.issues.find(
              (i) =>
                i.code === "unrecognized_keys" &&
                Array.isArray((i as { keys?: unknown[] }).keys) &&
                (i as { keys: unknown[] }).keys.length > 0,
            );
            expect(rootUnknown).toBeDefined();
          } else {
            // The failed rule is named by a concrete, non-empty field path.
            expect(result.field.length).toBeGreaterThan(0);
          }
        }),
        { numRuns: 100 },
      );
    });
  }
});

// --- Unknown-but-positive-integer version -> unsupported_format --------------

describe("Property 3: any positive integer version not in the registry is unsupported_format", () => {
  it("unknown positive integer formatVersion yields unsupported_format", () => {
    fc.assert(
      fc.property(
        validHeaderArb,
        fc.integer({ min: 2, max: 1_000_000 }),
        (h, version) => {
          const c = clone(h);
          c.formatVersion = version; // a positive integer, but not 1
          const result = parseEnvelope(c);
          expect(result.ok).toBe(false);
          if (result.ok) return;
          expect(result.error).toBe("unsupported_format");
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- headerWithoutCiphertext -------------------------------------------------

describe("headerWithoutCiphertext drops only payloadCiphertext", () => {
  it("removes payloadCiphertext and keeps every other field unchanged", () => {
    fc.assert(
      fc.property(validHeaderArb, (h) => {
        const stripped = headerWithoutCiphertext(h) as Record<string, unknown>;

        // payloadCiphertext is gone.
        expect("payloadCiphertext" in stripped).toBe(false);

        // Every other key is present and deep-equal to the original.
        const expectedKeys = Object.keys(h).filter(
          (k) => k !== "payloadCiphertext",
        );
        expect(new Set(Object.keys(stripped))).toEqual(new Set(expectedKeys));
        for (const k of expectedKeys) {
          expect(stripped[k]).toEqual((h as Record<string, unknown>)[k]);
        }

        // The original is not mutated: it still carries the ciphertext.
        expect("payloadCiphertext" in h).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("the stripped object plus the ciphertext re-parses as the same header", () => {
    fc.assert(
      fc.property(validHeaderArb, (h) => {
        const stripped = headerWithoutCiphertext(h);
        const rebuilt = {
          ...(stripped as Record<string, unknown>),
          payloadCiphertext: h.payloadCiphertext,
        };
        const result = headerV1Schema.safeParse(rebuilt);
        expect(result.success).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
