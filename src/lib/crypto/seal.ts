// Seal a letter: build the stored envelope from a plaintext payload (design.md
// "Seal", crypto.md).
//
// The browser encrypts; the server only ever stores the ciphertext, the
// unencrypted header and the per-letter time-lock `serverSecret`. `sealLetter`
// does all of this in the browser:
//
//   1. Reject a wrong-length letter ID or server secret, a missing factor, a
//      malformed passkey factor, and a `written_as_of` later than the seal
//      date, BEFORE any key derivation (R3.3, R1.4, R8.7). These throw
//      `SealError` (an Error carrying an `invalid_input` detail), so a spy on
//      subtle.deriveKey/deriveBits/encrypt records zero calls.
//   2. Generate a random 32-byte DEK and wrap it once per factor present:
//      KEK_backup (folds in the server secret, so the backup factor cannot
//      unwrap before the server releases the secret at the opening date) and
//      KEK_passkey (from the PRF output, also folding in the server secret).
//   3. Re-open the passkey wrap and compare it with the DEK (R8.5). A throw or a
//      difference gives `SealError.wrapFailed()` and no envelope.
//   4. Build the header without the ciphertext, encrypt the canonical payload
//      with the DEK and the canonical header as AAD, then add the ciphertext
//      and compute the envelope hash.
//
// The DEK, backup key, PRF output and server secret never leave the browser
// and are never logged (crypto.md). The DEK and `passkey.prfOutput` are zeroed
// best-effort before returning.
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
import { isRpId } from "../seal-format/v1/header";
import { deriveBackupKek, derivePasskeyKek } from "./kdf";
import type { BackupKeyBytes, OpenError, SealErrorDetail } from "./errors";

const LETTER_ID_BYTES = 16;
const SERVER_SECRET_BYTES = 32;
const DEK_BYTES = 32;
const GCM_NONCE_BYTES = 12;
const PRF_OUTPUT_BYTES = 32;
const PRF_SALT_BYTES = 32;
const CREDENTIAL_ID_MAX_BYTES = 1023;

const utf8 = new TextEncoder();

type InvalidInputField = Extract<OpenError, { kind: "invalid_input" }>["field"];

/**
 * An error thrown by `sealLetter` for an input precondition that fails before
 * any key derivation, or for a passkey wrap that does not unwrap to the DEK.
 * `error` is a `SealErrorDetail`: `invalid_input` with a field, or
 * `wrap_failed`. The message is the fixed kind string and names no value
 * (R3.16).
 *
 * `new SealError("letterId")` builds an `invalid_input` error for that field.
 * `SealError.wrapFailed()` builds the `wrap_failed` error.
 */
export class SealError extends Error {
  readonly error: SealErrorDetail;

  constructor(detail: InvalidInputField | SealErrorDetail) {
    const normalised: SealErrorDetail =
      typeof detail === "string" ? { kind: "invalid_input", field: detail } : detail;
    super(normalised.kind);
    this.name = "SealError";
    this.error = normalised;
  }

  /** The passkey wrap did not unwrap to the DEK (R8.5). */
  static wrapFailed(): SealError {
    return new SealError({ kind: "wrap_failed" });
  }
}

/**
 * The passkey factor for `sealLetter`. `prfOutput` is the 32-byte PRF result
 * for `prfSalt` from `confirmPasskey`; `sealLetter` zeroes it before it
 * returns. `credentialId` is 1..1023 bytes, `prfSalt` is 32 bytes and `rpId`
 * is a lowercase hostname (see `isRpId`).
 */
export interface PasskeyFactor {
  prfOutput: Uint8Array;
  credentialId: Uint8Array;
  prfSalt: Uint8Array;
  rpId: string;
}

/** Inputs to `sealLetter`. At least one of `backupKey` and `passkey` is required. */
export interface SealInput {
  /** The plaintext payload; validated with `payloadV1Schema`. */
  payload: unknown;
  /** The letter's 16 random ID bytes. */
  letterId: Uint8Array;
  /** The per-letter 32-byte time-lock secret (released by the server). */
  serverSecret: Uint8Array;
  /** The validated 16-byte backup key from `parseBackupKey`/`generateBackupKey`. */
  backupKey?: BackupKeyBytes;
  /** The passkey factor. Adds a `passkey` wrap and the header passkey fields. */
  passkey?: PasskeyFactor;
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

/** Constant-time equality of two byte arrays of any length. */
function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

/** The AAD for a wrap: `letterId ‖ utf8(factor)`. */
function wrapAad(letterId: Uint8Array, factor: "backup" | "passkey"): Uint8Array<ArrayBuffer> {
  return concatBytes(letterId, utf8.encode(factor));
}

/**
 * Check the passkey factor's shape before any derivation. Returns true only
 * when every field has the length and form the header schema accepts.
 */
function passkeyFactorIsValid(passkey: PasskeyFactor): boolean {
  return (
    passkey.prfOutput.length === PRF_OUTPUT_BYTES &&
    passkey.prfSalt.length === PRF_SALT_BYTES &&
    passkey.credentialId.length >= 1 &&
    passkey.credentialId.length <= CREDENTIAL_ID_MAX_BYTES &&
    isRpId(passkey.rpId)
  );
}

/** A wrapped DEK entry as it appears in the header. */
interface WrapEntry {
  factor: "backup" | "passkey";
  nonce: Uint8Array<ArrayBuffer>;
  wrappedKey: Uint8Array<ArrayBuffer>;
}

/**
 * Wrap the raw DEK bytes under `kek` with AES-GCM and a fresh nonce. AAD is
 * `letterId ‖ utf8(factor)`. The result is 48 bytes (32 + 16 tag).
 */
async function wrapDek(
  kek: CryptoKey,
  dek: Uint8Array,
  letterId: Uint8Array,
  factor: "backup" | "passkey",
): Promise<WrapEntry> {
  const nonce = randomNonce();
  const wrappedBuf = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: wrapAad(letterId, factor) },
    kek,
    toArrayBufferView(dek),
  );
  return { factor, nonce, wrappedKey: new Uint8Array(wrappedBuf) };
}

/**
 * Unwrap the passkey wrap again with the same KEK, nonce and AAD and compare
 * the bytes with the DEK (R8.5). A decrypt that throws, or bytes that differ,
 * gives `SealError.wrapFailed()`. The backup wrap needs no check.
 */
async function unwrapCheck(
  kek: CryptoKey,
  wrap: WrapEntry,
  dek: Uint8Array,
  letterId: Uint8Array,
): Promise<void> {
  let unwrapped: ArrayBuffer;
  try {
    unwrapped = await globalThis.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: toArrayBufferView(wrap.nonce),
        additionalData: wrapAad(letterId, wrap.factor),
      },
      kek,
      toArrayBufferView(wrap.wrappedKey),
    );
  } catch {
    throw SealError.wrapFailed();
  }
  const view = new Uint8Array(unwrapped);
  const matches = sameBytes(view, dek);
  zero(view);
  if (!matches) {
    throw SealError.wrapFailed();
  }
}

/**
 * Seal a letter.
 *
 * Steps follow design.md "Seal" exactly:
 *   1. Length, factor and passkey-shape checks, then the payload schema and the
 *      `written_as_of` rule. All run before any derivation.
 *   2. A random DEK is wrapped with KEK_backup (AAD `letterId ‖ "backup"`) when
 *      a backup key is given, and with KEK_passkey (AAD `letterId ‖ "passkey"`)
 *      when a passkey is given. The passkey wrap is unwrapped and compared.
 *   3. The payload is encrypted with the DEK, AAD the canonical header without
 *      the ciphertext, and the result folded into the envelope with its hash.
 *
 * Throws `SealError` for an invalid input or a failed wrap check; otherwise
 * resolves with the envelope and its hash. The passkey's `prfOutput` is zeroed
 * before this function returns or throws.
 */
export async function sealLetter(input: SealInput): Promise<SealResult> {
  try {
    return await sealChecked(input);
  } finally {
    input.passkey?.prfOutput.fill(0);
  }
}

async function sealChecked(input: SealInput): Promise<SealResult> {
  const { letterId, serverSecret, backupKey, passkey, sealedAt, opensAt } = input;

  // Step 1: input checks BEFORE any key derivation (R3.3, R8.7).
  if (letterId.length !== LETTER_ID_BYTES) {
    throw new SealError("letterId");
  }
  if (serverSecret.length !== SERVER_SECRET_BYTES) {
    throw new SealError("serverSecret");
  }
  if (backupKey === undefined && passkey === undefined) {
    throw new SealError("backupKey");
  }
  if (passkey !== undefined && !passkeyFactorIsValid(passkey)) {
    throw new SealError("passkey");
  }

  // Validate the payload against the frozen v1 schema. A bad payload is an
  // invalid envelope input; surface it before any derivation too.
  const parsed = payloadV1Schema.safeParse(input.payload);
  if (!parsed.success) {
    throw new SealError("envelope");
  }
  const payload: PayloadV1 = parsed.data;

  // `written_as_of`, if present, must not be later than the UTC calendar date
  // of `sealedAt`. Both are `YYYY-MM-DD` (sealedAt sliced), so a plain string
  // comparison is date order (R1.4). Enforced here because the server cannot
  // read the payload.
  if (
    payload.written_as_of !== undefined &&
    payload.written_as_of > sealedAt.slice(0, 10)
  ) {
    throw new SealError("written_as_of");
  }

  // Step 2: DEK = 32 random bytes.
  const dek = new Uint8Array(DEK_BYTES);
  globalThis.crypto.getRandomValues(dek);

  try {
    // Step 3: wrap the DEK once per factor present, backup first (sorted).
    const wrappedDeks: WrapEntry[] = [];
    if (backupKey !== undefined) {
      const kekBackup = await deriveBackupKek(backupKey, serverSecret, letterId);
      wrappedDeks.push(await wrapDek(kekBackup, dek, letterId, "backup"));
    }
    if (passkey !== undefined) {
      const kekPasskey = await derivePasskeyKek(
        passkey.prfOutput,
        serverSecret,
        letterId,
      );
      const passkeyWrap = await wrapDek(kekPasskey, dek, letterId, "passkey");
      await unwrapCheck(kekPasskey, passkeyWrap, dek, letterId);
      wrappedDeks.push(passkeyWrap);
    }

    // Step 4: build the header WITHOUT the ciphertext. Passkey fields appear
    // only when a passkey wrap exists (matches headerV1Schema).
    const payloadNonce = randomNonce();
    const headerWithoutCiphertext_: Omit<EnvelopeV1, "payloadCiphertext"> = {
      letterId: encodeBase64url(letterId),
      formatVersion: 1,
      sealedAt,
      opensAt,
      payloadNonce: encodeBase64url(payloadNonce),
      wrappedDeks: wrappedDeks.map((w) => ({
        factor: w.factor,
        nonce: encodeBase64url(w.nonce),
        wrappedKey: encodeBase64url(w.wrappedKey),
      })),
      ...(passkey !== undefined
        ? {
            rpId: passkey.rpId,
            credentialId: encodeBase64url(passkey.credentialId),
            prfSalt: encodeBase64url(passkey.prfSalt),
          }
        : {}),
    };

    // Step 5: encrypt the canonical payload with the DEK. AAD is the canonical
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

    // Step 6: assemble the full envelope, compute its hash, return.
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
