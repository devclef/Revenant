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

import { decodeBase64url, encodeBase64url } from "@/lib/seal-format/base64url";
import { canonicalize } from "@/lib/seal-format/canonical-json";
import { envelopeHash } from "@/lib/seal-format/hash";

// `openLetter`'s result type. Written as `typeof import(...)` so no static import
// of src/lib/crypto reaches this component (import-boundary test).
export type OpenResult = Awaited<
  ReturnType<typeof import("@/lib/crypto/open").openLetter>
>;

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
  /**
   * SHA-256 of the Tamper_Copy's envelope, from `envelopeHash` (the same
   * function the seal and `openLetter` use). Shown as the copy's Fingerprint.
   */
  readonly copyHash: string;
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
 * Test overrides for the one changed byte. The page never passes them, so the
 * default byte and mask are the ones the spec fixes. `byteIndex` must index the
 * payload ciphertext and `mask` must be an integer from 1 to 255, so the change
 * is never a no-op.
 */
export interface TamperOptions {
  readonly byteIndex?: number;
  readonly mask?: number;
}

/**
 * Run the tamper check on one stored letter. Resolves with both `openLetter`
 * results and the byte change. Never throws for a failed open: a failure is an
 * `OpenResult` with `ok: false`.
 */
export async function runTamper(
  src: TamperSource,
  options: TamperOptions = {},
): Promise<TamperRun> {
  const stored = deepFreeze(src.envelope);
  const before = canonicalize(stored);

  // Untouched run: the real open on the stored copy, with the same inputs the
  // tampered run gets.
  const untampered = await openWith(stored, src, src.envelopeHash);

  // Tamper_Copy: a deep copy, with one payload ciphertext byte changed.
  const { copy, change } = makeCopy(stored, options);

  // Same call, same inputs. The changed byte is the only difference.
  const result = await openWith(copy, src, src.envelopeHash);
  const copyHash = await envelopeHash(copy);

  assertStoredUnchanged(stored, before);

  return { untampered, result, change, copyHash };
}

/** What `runRecomputedFingerprint` returns. Nothing here is persisted. */
export interface RecomputedFingerprintRun {
  /** The one changed byte, the same change `runTamper` reports for these options. */
  readonly change: TamperChange;
  /** SHA-256 of the Tamper_Copy's envelope, passed to `openLetter` as its hash. */
  readonly recomputedHash: string;
  /**
   * `openLetter` on the Tamper_Copy with `recomputedHash`. The hash check passes
   * because the hash now matches the copy, so a refusal here comes from the
   * AES-GCM tag check and is `tampered`.
   */
  readonly result: OpenResult;
}

/**
 * Second layer (spec 13, A3.1). Changes the same one byte as `runTamper`,
 * recomputes the Tamper_Copy's envelope hash and opens the copy with that hash.
 * The hash check then passes, so the refusal that remains is the authentication
 * failure. The stored envelope is frozen and checked unchanged, as in
 * `runTamper`.
 */
export async function runRecomputedFingerprint(
  src: TamperSource,
  options: TamperOptions = {},
): Promise<RecomputedFingerprintRun> {
  const stored = deepFreeze(src.envelope);
  const before = canonicalize(stored);

  const { copy, change } = makeCopy(stored, options);
  const recomputedHash = await envelopeHash(copy);
  const result = await openWith(copy, src, recomputedHash);

  assertStoredUnchanged(stored, before);

  return { change, recomputedHash, result };
}

/**
 * A deep copy of the stored envelope with one payload ciphertext byte changed
 * by XOR with the mask. Throws on a mask or byte index outside the allowed range.
 */
function makeCopy(
  stored: unknown,
  options: TamperOptions,
): { copy: unknown; change: TamperChange } {
  const copy = structuredClone(stored) as unknown;
  const bytes = decodeBase64url(payloadCiphertextOf(copy));
  const mask = options.mask ?? TAMPER_BIT_MASK;
  if (!Number.isInteger(mask) || mask < 1 || mask > 255) {
    throw new Error("tamper: mask must be an integer from 1 to 255");
  }
  const byteIndex = options.byteIndex ?? tamperByteIndex(bytes.length);
  if (
    !Number.isInteger(byteIndex) ||
    byteIndex < 0 ||
    byteIndex >= bytes.length
  ) {
    throw new Error("tamper: byteIndex is outside the payload ciphertext");
  }
  const original = bytes[byteIndex];
  const changed = original ^ mask;
  bytes[byteIndex] = changed;
  (copy as { payloadCiphertext: string }).payloadCiphertext =
    encodeBase64url(bytes);

  return {
    copy,
    change: {
      byteIndex,
      total: bytes.length,
      before: original,
      after: changed,
    },
  };
}

/** Throw if the stored envelope no longer matches its canonical form from before the run. */
function assertStoredUnchanged(stored: unknown, before: string): void {
  if (canonicalize(stored) !== before) {
    throw new Error("tamper: the stored envelope changed during the run");
  }
}

/**
 * Open one envelope with the published demo key and the given hash. The
 * crypto sub-modules are loaded dynamically here. Only the crypto barrel is
 * restricted to two importers (crypto-barrel-scan), so the sub-modules are used.
 */
async function openWith(
  envelope: unknown,
  src: TamperSource,
  storedHash: string,
): Promise<OpenResult> {
  const { openLetter } = await import("@/lib/crypto/open");
  const { parseBackupKey } = await import("@/lib/crypto/backup-key");
  const { PUBLIC_DEMO_BACKUP_KEY } = await import("@/lib/crypto/demo-key");

  // A fresh parse per call, so no key bytes are shared between the two runs.
  const parsed = parseBackupKey(PUBLIC_DEMO_BACKUP_KEY);
  if (!parsed.ok) {
    throw new Error("tamper: the published demo key did not parse");
  }
  return openLetter({
    envelope,
    envelopeHash: storedHash,
    serverSecret: src.readSecret(),
    backupKey: parsed.key,
  });
}
