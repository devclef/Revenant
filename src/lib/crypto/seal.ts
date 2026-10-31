// Seal a letter: build the stored envelope from a plaintext payload (design.md
// "Seal", crypto.md).
//
// The browser encrypts; the server only ever stores the ciphertext, the
// unencrypted header and the per-letter time-lock `serverSecret`. `sealLetter`
// does all of this in the browser:
//
//   1. Reject a wrong-length letter ID or server secret, and a `written_as_of`
//      later than the seal date, BEFORE any key derivation (R3.3, R1.4). These
//      throw `SealError` (an Error carrying an `invalid_input` OpenError), so a
//      spy on subtle.deriveKey/deriveBits/encrypt records zero calls.
//   2. Generate a random 32-byte DEK and wrap it with KEK_backup (which folds
//      in the server secret, so the backup factor cannot unwrap before the
//      server releases the secret at the opening date).
//   3. Build the header without the ciphertext, encrypt the canonical payload
//      with the DEK and the canonical header as AAD, then add the ciphertext
//      and compute the envelope hash.
//
// The DEK, backup key and server secret never leave the browser and are never
// logged (crypto.md). The DEK bytes are zeroed best-effort before returning.
//
// WebCrypto only, browser-safe: the one platform dependency is
// `globalThis.crypto`. This module imports `../seal-format` (pure) and the
// sibling crypto modules; it imports no `node:` module and nothing from
// src/lib/db.

import {
  canonicalize,
  encodeBase64url,
  envelopeHash as computeEnvelopeHash,
  payloadV1Schema,
  type EnvelopeV1,
  type PayloadV1,
} from "../seal-format";
import { deriveBackupKek } from "./kdf";
import type { BackupKeyBytes, OpenError } from "./errors";

const LETTER_ID_BYTES = 16;
const SERVER_SECRET_BYTES = 32;
const DEK_BYTES = 32;
const GCM_NONCE_BYTES = 12;

const utf8 = new TextEncoder();

/**
 * An error thrown by `sealLetter` for an input precondition that fails before
 * any key derivation. It carries an `invalid_input` `OpenError` so a caller can
 * branch on `error.kind`/`error.field` exactly as it does for `openLetter`
 * results. The message is a fixed string and names no value (R3.16).
 */
export class SealError extends Error {
  readonly error: Extract<OpenError, { kind: "invalid_input" }>;

  constructor(field: Extract<OpenError, { kind: "invalid_input" }>["field"]) {
    super("invalid_input");
    this.name = "SealError";
    this.error = { kind: "invalid_input", field };
  }
}

/** Inputs to `sealLetter`. */
export interface SealInput {
  /** The plaintext payload; validated with `payloadV1Schema`. */
  payload: unknown;
  /** The letter's 16 random ID bytes. */
  letterId: Uint8Array;
  /** The per-letter 32-byte time-lock secret (released by the server). */
  serverSecret: Uint8Array;
  /** The validated 16-byte backup key from `parseBackupKey`/`generateBackupKey`. */
  backupKey: BackupKeyBytes;
  /** The seal time as a millisecond-precision ISO `Z` timestamp. */
  sealedAt: string;
  /** The opening time as a millisecond-precision ISO `Z` timestamp. */
  opensAt: string;
}

/** The sealed envelope plus its SHA-256 hash. */
export interface SealResult {
  envelope: EnvelopeV1;
  envelopeHash: string;
}

/**
 * Copy bytes into a fresh `ArrayBuffer`-backed view. WebCrypto's typings want a
 * `BufferSource` whose buffer is an `ArrayBuffer`, not a possibly-shared
 * `ArrayBufferLike`, so the copy guarantees the right backing store.
 */
function toArrayBufferView(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(bytes.length);
  out.set(bytes);
  return out;
}

/** Concatenate byte arrays into one fresh `ArrayBuffer`-backed view. */
function concatBytes(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/** A fresh random nonce of the AES-GCM nonce length. */
function randomNonce(): Uint8Array<ArrayBuffer> {
  const nonce = new Uint8Array(GCM_NONCE_BYTES);
  globalThis.crypto.getRandomValues(nonce);
  return nonce;
}

/** Best-effort zero of sensitive bytes before they go out of scope. */
function zero(bytes: Uint8Array): void {
  bytes.fill(0);
}

/**
 * Seal a letter.
 *
 * Steps follow design.md "Seal" exactly:
 *   1. Length checks and the `written_as_of` rule run before any derivation.
 *   2. A random DEK is wrapped with KEK_backup, AAD `letterId ‖ "backup"`.
 *   3. The payload is encrypted with the DEK, AAD the canonical header without
 *      the ciphertext, and the result folded into the envelope with its hash.
 *
 * Throws `SealError` for an invalid input; otherwise resolves with the envelope
 * and its hash.
 */
export async function sealLetter(input: SealInput): Promise<SealResult> {
  const { letterId, serverSecret, backupKey, sealedAt, opensAt } = input;

  // Step 1: input length checks BEFORE any key derivation (R3.3).
  if (letterId.length !== LETTER_ID_BYTES) {
    throw new SealError("letterId");
  }
  if (serverSecret.length !== SERVER_SECRET_BYTES) {
    throw new SealError("serverSecret");
  }

  // Validate the payload against the frozen v1 schema. A bad payload is an
  // invalid envelope input; surface it before any derivation too.
  const parsed = payloadV1Schema.safeParse(input.payload);
  if (!parsed.success) {
    throw new SealError("envelope");
  }
  const payload: PayloadV1 = parsed.data;

  // Step 2: `written_as_of`, if present, must not be later than the UTC
  // calendar date of `sealedAt`. Both are `YYYY-MM-DD` (sealedAt sliced), so a
  // plain string comparison is date order (R1.4). Enforced here because the
  // server cannot read the payload.
  if (
    payload.written_as_of !== undefined &&
    payload.written_as_of > sealedAt.slice(0, 10)
  ) {
    throw new SealError("written_as_of");
  }

  // Step 3: DEK = 32 random bytes.
  const dek = new Uint8Array(DEK_BYTES);
  globalThis.crypto.getRandomValues(dek);

  try {
    // Step 4: derive KEK_backup (folds in the server secret and letter ID).
    const kekBackup = await deriveBackupKek(backupKey, serverSecret, letterId);

    // Step 5: wrap the raw DEK bytes with AES-GCM. AAD = letterId ‖ "backup".
    const wrapNonce = randomNonce();
    const wrapAad = concatBytes(letterId, utf8.encode("backup"));
    const wrappedKeyBuf = await globalThis.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: wrapNonce, additionalData: wrapAad },
      kekBackup,
      toArrayBufferView(dek),
    );
    const wrappedKey = new Uint8Array(wrappedKeyBuf); // 48 bytes (32 + 16 tag)

    // Step 6: build the header WITHOUT the ciphertext. One wrap in the MVP
    // (backup); wraps are sorted by factor, which a single `backup` entry
    // trivially satisfies.
    const payloadNonce = randomNonce();
    const headerWithoutCiphertext_: Omit<EnvelopeV1, "payloadCiphertext"> = {
      letterId: encodeBase64url(letterId),
      formatVersion: 1,
      sealedAt,
      opensAt,
      payloadNonce: encodeBase64url(payloadNonce),
      wrappedDeks: [
        {
          factor: "backup",
          nonce: encodeBase64url(wrapNonce),
          wrappedKey: encodeBase64url(wrappedKey),
        },
      ],
    };

    // Step 7: encrypt the canonical payload with the DEK. AAD is the canonical
    // header without the ciphertext, so every header field (wraps included) is
    // authenticated by the payload's GCM tag (R3.4).
    const dekKey = await globalThis.crypto.subtle.importKey(
      "raw",
      toArrayBufferView(dek),
      { name: "AES-GCM" },
      false,
      ["encrypt"],
    );
    const payloadBytes = utf8.encode(canonicalize(payload));
    const headerAad = utf8.encode(canonicalize(headerWithoutCiphertext_));
    const ciphertextBuf = await globalThis.crypto.subtle.encrypt(
      { name: "AES-GCM", iv: payloadNonce, additionalData: headerAad },
      dekKey,
      payloadBytes,
    );
    const payloadCiphertext = encodeBase64url(new Uint8Array(ciphertextBuf));

    // Step 8: assemble the full envelope, compute its hash, return.
    const envelope: EnvelopeV1 = {
      ...headerWithoutCiphertext_,
      payloadCiphertext,
    };
    const hash = await computeEnvelopeHash(envelope);

    return { envelope, envelopeHash: hash };
  } finally {
    // Best-effort zero of the DEK bytes once wrapping and encryption are done.
    zero(dek);
  }
}
