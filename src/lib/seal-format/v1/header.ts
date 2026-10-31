// Stored envelope header, format version 1 (the unencrypted part of a sealed
// letter plus the ciphertext).
//
// This schema is FROZEN. Never change the meaning of version 1; a later change
// is format version 2 with its own module. See design.md "Header v1 (the
// stored envelope)" and crypto.md. Every object is a strict object so an
// unknown field is rejected rather than silently dropped, which keeps the
// canonical form (and so the envelope hash) stable.
//
// This module imports only ../base64url. It imports nothing from src/lib/crypto
// or src/lib/db; it is pure and safe to import from either the browser or the
// server.

import { z } from "zod";
import { decodeBase64url, isLetterId } from "../base64url";

// --- Primitive field schemas -------------------------------------------------

// A base64url string of a fixed decoded byte length. decodeBase64url already
// rejects padding, out-of-alphabet characters, impossible lengths and non-zero
// trailing bits, so a value that survives this refine has exactly one canonical
// form of the right size.
const base64urlBytes = (bytes: number) =>
  z.string().refine(
    (s) => {
      try {
        decodeBase64url(s, bytes);
        return true;
      } catch {
        return false;
      }
    },
    { message: `must be canonical base64url of ${bytes} bytes` },
  );

// A base64url string whose decoded length is within an inclusive range.
const base64urlByteRange = (min: number, max: number) =>
  z.string().refine(
    (s) => {
      let decoded: Uint8Array;
      try {
        decoded = decodeBase64url(s);
      } catch {
        return false;
      }
      return decoded.length >= min && decoded.length <= max;
    },
    { message: `must be canonical base64url of ${min}-${max} bytes` },
  );

// letterId: the URL form of the 16 random bytes, 22 canonical base64url chars.
const letterId = z.string().refine((s) => isLetterId(s), {
  message: "letterId must be 16 bytes of canonical base64url",
});

// A millisecond `Z` timestamp. It must equal new Date(s).toISOString(): that
// both rejects a non-parseable string and forces the single canonical textual
// form per instant, so the hash and the database column stay consistent.
const millisecondZ = z.string().refine(
  (s) => {
    const t = Date.parse(s);
    if (Number.isNaN(t)) return false;
    return new Date(t).toISOString() === s;
  },
  { message: "must be a millisecond Z timestamp" },
);

// rpId: a lowercase hostname of 1-253 characters. `localhost` is allowed. Each
// label is 1-63 chars of [a-z0-9-], not starting or ending with a hyphen.
const rpId = z
  .string()
  .min(1)
  .max(253)
  .refine(
    (s) =>
      s === "localhost" ||
      /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/.test(
        s,
      ),
    { message: "rpId must be a lowercase hostname" },
  );

// --- Wrapped DEK -------------------------------------------------------------

const wrappedDekSchema = z.strictObject({
  factor: z.enum(["backup", "passkey"]),
  nonce: base64urlBytes(12), // 16 chars
  wrappedKey: base64urlBytes(48), // 64 chars
});

// --- Base header shape (before cross-field rules) ----------------------------

const headerBaseSchema = z.strictObject({
  letterId,
  formatVersion: z.literal(1),
  sealedAt: millisecondZ,
  opensAt: millisecondZ,
  payloadNonce: base64urlBytes(12), // 16 chars
  // 16 bytes (AES-GCM minimum) to 1 MiB decoded.
  payloadCiphertext: base64urlByteRange(16, 1024 * 1024),
  wrappedDeks: z.array(wrappedDekSchema).min(1).max(2),
  // Present if and only if a passkey wrap exists; enforced in superRefine.
  rpId: rpId.optional(),
  credentialId: base64urlByteRange(1, 1023).optional(),
  prfSalt: base64urlBytes(32).optional(),
});

// Cross-field rules: wraps sorted by factor with unique factor, and the
// passkey-field triplet present exactly when a passkey wrap exists.
export const headerV1Schema = headerBaseSchema.superRefine((env, ctx) => {
  // Unique factor.
  const factors = new Set<string>();
  for (let i = 0; i < env.wrappedDeks.length; i++) {
    const f = env.wrappedDeks[i].factor;
    if (factors.has(f)) {
      ctx.addIssue({
        code: "custom",
        message: "duplicate wrap factor",
        path: ["wrappedDeks", i, "factor"],
      });
      return;
    }
    factors.add(f);
  }

  // Sorted by factor: `backup` before `passkey`. Canonical JSON keeps array
  // order, so a fixed order means one header has exactly one valid form.
  const order = { backup: 0, passkey: 1 } as const;
  for (let i = 1; i < env.wrappedDeks.length; i++) {
    if (order[env.wrappedDeks[i - 1].factor] > order[env.wrappedDeks[i].factor]) {
      ctx.addIssue({
        code: "custom",
        message: "wraps must be sorted by factor",
        path: ["wrappedDeks", i, "factor"],
      });
      return;
    }
  }

  // Passkey fields present if and only if a passkey wrap exists.
  const hasPasskeyWrap = factors.has("passkey");
  const passkeyFields: ReadonlyArray<keyof typeof env> = [
    "rpId",
    "credentialId",
    "prfSalt",
  ];
  for (const field of passkeyFields) {
    const present = env[field] !== undefined;
    if (hasPasskeyWrap && !present) {
      ctx.addIssue({
        code: "custom",
        message: `${String(field)} is required when a passkey wrap exists`,
        path: [field],
      });
      return;
    }
    if (!hasPasskeyWrap && present) {
      ctx.addIssue({
        code: "custom",
        message: `${String(field)} is only allowed with a passkey wrap`,
        path: [field],
      });
      return;
    }
  }
});

export type EnvelopeV1 = z.infer<typeof headerV1Schema>;

/**
 * A copy of the envelope without `payloadCiphertext`. This is the object whose
 * canonical form is the AES-GCM AAD for the payload, so every other header
 * field (wraps included) is authenticated by the payload's GCM tag.
 */
export function headerWithoutCiphertext(
  env: EnvelopeV1,
): Omit<EnvelopeV1, "payloadCiphertext"> {
  const rest: Record<string, unknown> = {};
  for (const key of Object.keys(env)) {
    if (key === "payloadCiphertext") continue;
    rest[key] = env[key as keyof EnvelopeV1];
  }
  return rest as Omit<EnvelopeV1, "payloadCiphertext">;
}
