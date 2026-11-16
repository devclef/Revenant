// Tamper_Control run (spec 13, A2). Browser-only: server code must never import
// this module.
//
// `runTamper` makes one copy of the stored envelope, changes exactly one byte
// of its payload ciphertext, and runs the real `openLetter` on the untouched
// copy and on the changed copy with the same inputs. It holds no second hash
// or decryption code, no hard-coded result and no timer. The verdict is the
// `OpenResult` that `openLetter` returns, unchanged.
//
// The stored envelope is never written to. It is deep-frozen here, and it is
// checked deep-equal before and after the run.

import type { OpenResult } from "@/lib/crypto";
import { decodeBase64url, encodeBase64url } from "@/lib/seal-format/base64url";
import { canonicalize } from "@/lib/seal-format/canonical-json";

/** XOR mask applied to the one changed byte: flips the lowest bit. */
export const TAMPER_BIT_MASK = 0x01;

/** AES-GCM tag length in bytes. The tag is the last 16 bytes of the ciphertext. */
const GCM_TAG_BYTES = 16;

/** Below this length the middle byte could fall inside the tag, so byte 0 is used. */
const MIN_BODY_TOTAL = 2 * GCM_TAG_BYTES;

/** The stored letter as the run needs it. Nothing here is persisted. */
export interface TamperSource {
  /** The stored envelope (header + ciphertext). Frozen by `runTamper`. */
  readonly envelope: unknown;
  /** The stored SHA-256 hash of the envelope, 64 lowercase hex chars. */
  readonly envelopeHash: string;
  /** A fresh copy of the 32 released server secret bytes. Called once per open. */
  readSecret(): Uint8Array;
}

/** The byte that was changed, with its before and after values. */
export interface TamperChange {
  readonly byteIndex: number;
  /** Length of the payload ciphertext in bytes. */
  readonly total: number;
  readonly before: number;
  readonly after: number;
}

/** What `runTamper` returns. Both results are `openLetter`'s own results. */
export interface TamperRun {
  /** `openLetter` on the untouched copy. Not ok means the setup is broken. */
  readonly untampered: OpenResult;
  /** `openLetter` on the Tamper_Copy. This is the verdict shown to the judge. */
  readonly result: OpenResult;
  readonly change: TamperChange;
}

/**
 * The index of the one ciphertext byte to change. The middle byte, so it sits in
 * the body and not the tag. Below 32 bytes, byte 0 is used instead.
 */
export function tamperByteIndex(total: number): number {
  if (total < MIN_BODY_TOTAL) return 0;
  return Math.floor(total / 2);
}

/** Recursively freeze an object graph. Returns the same reference. */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.getOwnPropertyNames(value)) {
      deepFreeze((value as Record<string, unknown>)[key]);
    }
  }
  return value;
}

/** Read the payload ciphertext string from an envelope the registry will check. */
function payloadCiphertextOf(envelope: unknown): string {
  const ciphertext = (envelope as { payloadCiphertext?: unknown } | null)
    ?.payloadCiphertext;
  if (typeof ciphertext !== "string") {
    throw new Error("tamper: envelope has no payload ciphertext string");
  }
  return ciphertext;
}

/**
 * Run the tamper check on one stored letter. Resolves with both `openLetter`
 * results and the byte change. Never throws for a failed open: a failure is an
 * `OpenResult` with `ok: false`.
 */
export async function runTamper(src: TamperSource): Promise<TamperRun> {
  const crypto = await import("@/lib/crypto");

  const stored = deepFreeze(src.envelope);
  const before = canonicalize(stored);

  // Untouched run: the real open on the stored copy, with the same inputs the
  // tampered run gets.
  const untampered = await openWith(crypto, stored, src);

  // Tamper_Copy: a deep copy, with one payload ciphertext byte changed.
  const copy = structuredClone(stored) as unknown;
  const bytes = decodeBase64url(payloadCiphertextOf(copy));
  const byteIndex = tamperByteIndex(bytes.length);
  const original = bytes[byteIndex];
  const changed = original ^ TAMPER_BIT_MASK;
  bytes[byteIndex] = changed;
  (copy as { payloadCiphertext: string }).payloadCiphertext =
    encodeBase64url(bytes);

  // Same call, same inputs. The changed byte is the only difference.
  const result = await openWith(crypto, copy, src);

  if (canonicalize(stored) !== before) {
    throw new Error("tamper: the stored envelope changed during the run");
  }

  return {
    untampered,
    result,
    change: {
      byteIndex,
      total: bytes.length,
      before: original,
      after: changed,
    },
  };
}

/** The part of `@/lib/crypto` the run uses, typed from the real module. */
type CryptoModule = typeof import("@/lib/crypto");

/** Open one envelope with the published demo key and the stored hash. */
async function openWith(
  crypto: CryptoModule,
  envelope: unknown,
  src: TamperSource,
): Promise<OpenResult> {
  // A fresh parse per call, so no key bytes are shared between the two runs.
  const parsed = crypto.parseBackupKey(crypto.PUBLIC_DEMO_BACKUP_KEY);
  if (!parsed.ok) {
    throw new Error("tamper: the published demo key did not parse");
  }
  return crypto.openLetter({
    envelope,
    envelopeHash: src.envelopeHash,
    serverSecret: src.readSecret(),
    backupKey: parsed.key,
  });
}
