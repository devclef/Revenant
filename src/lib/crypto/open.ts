// Open a sealed letter: verify, unwrap, decrypt and validate (design.md
// "Open", crypto.md).
//
// Everything here happens in the browser. The server has already released the
// per-letter `serverSecret` (only at or after the opening date); it never sees
// the backup key, the DEK or the plaintext. `openLetter` runs the steps in a
// fixed order so a tampered or early-opened letter fails closed with no key
// material and no payload:
//
//   1. Reject a wrong-length server secret (`invalid_input`), then parse the
//      stored envelope with the version registry (`unsupported_format` /
//      `invalid_input` on `envelope`), BEFORE any key derivation.
//   2. Recompute the envelope hash and compare it in CONSTANT TIME with the
//      stored hash. On mismatch return `verification_failed` and run nothing
//      further: no KEK derivation, no unwrap, no decrypt (R3.11, R3.12).
//   3. Derive KEK_backup and unwrap the `backup` wrap. An AES-GCM failure means
//      the backup key or the server secret is wrong -> `wrong_key` (R3.13).
//   4. Decrypt the payload ciphertext with the DEK, AAD the canonical header
//      without the ciphertext. An AES-GCM failure means the ciphertext or an
//      authenticated header field was altered after the (passing) hash check
//      -> `tampered`.
//   5. Parse the plaintext with the version registry: a bad schema is
//      `invalid_payload` (with the first failing field), an unknown version is
//      `unsupported_format`.
//   6. Derive the opening-records key from the DEK and return it with the
//      payload. The raw DEK bytes are zeroed best-effort before returning.
//
// On any failure the result carries only an `OpenError`: never a payload, never
// a key, and a fixed error string that names no value (R3.16).
//
// WebCrypto only, browser-safe: the one platform dependency is
// `globalThis.crypto`. This module imports `../seal-format` (pure) and the
// sibling crypto modules; it imports no `node:` module and nothing from
// src/lib/db.

import {
  canonicalize,
  decodeBase64url,
  envelopeHash as computeEnvelopeHash,
  headerWithoutCiphertext,
  parseEnvelope,
  parsePayload,
  type EnvelopeV1,
} from "../seal-format";
import { deriveBackupKek, deriveOpeningKey } from "./kdf";
import type { BackupKeyBytes, OpenError, OpenResult } from "./errors";

const LETTER_ID_BYTES = 16;
const SERVER_SECRET_BYTES = 32;
const DEK_BYTES = 32;

const utf8 = new TextEncoder();

/** Inputs to `openLetter`. */
export interface OpenInput {
  /** The stored envelope (header + ciphertext). Validated by the registry. */
  envelope: unknown;
  /** The SHA-256 hash stored alongside the envelope, 64 lowercase hex chars. */
  envelopeHash: string;
  /** The per-letter 32-byte time-lock secret, released by the server. */
  serverSecret: Uint8Array;
  /** The validated 16-byte backup key from `parseBackupKey`. */
  backupKey: BackupKeyBytes;
}

/** Build a failed `OpenResult` from an `OpenError`. */
function fail(error: OpenError): OpenResult {
  return { ok: false, error };
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

/** Best-effort zero of sensitive bytes before they go out of scope. */
function zero(bytes: Uint8Array): void {
  bytes.fill(0);
}

/**
 * Compare two hex digests in constant time. Returns true only when they are the
 * same length and every character matches. The loop always runs over the
 * stored hash's full length and never short-circuits, so timing does not reveal
 * how many leading characters matched. A length difference is folded into the
 * accumulator rather than returned early.
 */
function constantTimeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const len = a.length;
  for (let i = 0; i < len; i++) {
    // When b is shorter, charCodeAt returns NaN; `| 0` makes it 0 so the XOR is
    // still a non-zero difference against a real character, and the loop length
    // stays fixed to a's length regardless of b.
    const ca = a.charCodeAt(i) | 0;
    const cb = b.charCodeAt(i) | 0;
    diff |= ca ^ cb;
  }
  return diff === 0;
}

/** The single `backup` wrap of a v1 envelope. */
function backupWrap(
  envelope: EnvelopeV1,
): EnvelopeV1["wrappedDeks"][number] | undefined {
  return envelope.wrappedDeks.find((w) => w.factor === "backup");
}

/**
 * Open a sealed letter.
 *
 * Resolves with `{ ok: true, payload, openingKey }` on success, or
 * `{ ok: false, error }` for every failure path. Never throws for a bad
 * envelope, wrong key, tampering or early opening: those are returned as
 * `OpenError`s. The returned `openingKey` is a non-extractable `CryptoKey`; the
 * DEK is zeroed before returning and never leaves this function.
 */
export async function openLetter(input: OpenInput): Promise<OpenResult> {
  const { envelope: envelopeJson, envelopeHash: storedHash, serverSecret, backupKey } = input;

  // Step 1a: server secret length, before any derivation.
  if (serverSecret.length !== SERVER_SECRET_BYTES) {
    return fail({ kind: "invalid_input", field: "serverSecret" });
  }

  // Step 1b: parse the stored envelope with the version registry.
  const parsedEnvelope = parseEnvelope(envelopeJson);
  if (!parsedEnvelope.ok) {
    if (parsedEnvelope.error === "unsupported_format") {
      // The registry only rejects a version it cannot read; report the version
      // it saw, defaulting to 0 when the header has no numeric version at all.
      const seen = (envelopeJson as { formatVersion?: unknown } | null)?.formatVersion;
      const formatVersion = typeof seen === "number" ? seen : 0;
      return fail({ kind: "unsupported_format", formatVersion });
    }
    return fail({ kind: "invalid_input", field: "envelope" });
  }
  const envelope = parsedEnvelope.value;

  // Step 2: recompute the hash and compare in CONSTANT TIME. On mismatch,
  // return verification_failed and run nothing further (R3.11, R3.12).
  const recomputed = await computeEnvelopeHash(envelope);
  if (!constantTimeEqual(storedHash, recomputed)) {
    return fail({ kind: "verification_failed" });
  }

  // From here the hash is verified. Decode the pieces we need.
  const wrap = backupWrap(envelope);
  if (wrap === undefined) {
    // A v1 envelope always has a backup wrap (wraps sorted, 1-2 entries). A
    // header that validated but carries only a passkey wrap cannot be opened by
    // this function; surface it as a wrong (missing) backup factor.
    return fail({ kind: "wrong_key" });
  }

  const letterIdBytes = decodeBase64url(envelope.letterId, LETTER_ID_BYTES);
  const wrapNonce = decodeBase64url(wrap.nonce, 12);
  const wrappedKey = decodeBase64url(wrap.wrappedKey, 48);

  const dek = new Uint8Array(DEK_BYTES);
  let haveDek = false;

  try {
    // Step 3: derive KEK_backup and unwrap the DEK. A GCM failure here is a
    // wrong backup key or wrong server secret -> wrong_key.
    const kekBackup = await deriveBackupKek(backupKey, serverSecret, letterIdBytes);
    const unwrapAad = concatBytes(letterIdBytes, utf8.encode("backup"));
    let dekBuf: ArrayBuffer;
    try {
      dekBuf = await globalThis.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: toArrayBufferView(wrapNonce), additionalData: unwrapAad },
        kekBackup,
        toArrayBufferView(wrappedKey),
      );
    } catch {
      return fail({ kind: "wrong_key" });
    }
    const dekView = new Uint8Array(dekBuf);
    if (dekView.length !== DEK_BYTES) {
      // A wrap that authenticated but is not 32 bytes cannot be a DEK.
      zero(dekView);
      return fail({ kind: "wrong_key" });
    }
    dek.set(dekView);
    zero(dekView);
    haveDek = true;

    // Step 4: decrypt the payload. AAD = canonical header without ciphertext,
    // so any change to an authenticated header field (now, after the hash
    // check) also fails here. A GCM failure -> tampered.
    const dekKey = await globalThis.crypto.subtle.importKey(
      "raw",
      toArrayBufferView(dek),
      { name: "AES-GCM" },
      false,
      ["decrypt"],
    );
    const payloadNonce = decodeBase64url(envelope.payloadNonce, 12);
    const ciphertext = decodeBase64url(envelope.payloadCiphertext);
    const headerAad = utf8.encode(canonicalize(headerWithoutCiphertext(envelope)));
    let plaintextBuf: ArrayBuffer;
    try {
      plaintextBuf = await globalThis.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: toArrayBufferView(payloadNonce), additionalData: headerAad },
        dekKey,
        toArrayBufferView(ciphertext),
      );
    } catch {
      return fail({ kind: "tampered" });
    }

    // Step 5: parse the plaintext with the version registry.
    let json: unknown;
    try {
      json = JSON.parse(new TextDecoder().decode(plaintextBuf));
    } catch {
      return fail({ kind: "invalid_payload", field: "" });
    }
    const parsedPayload = parsePayload(json);
    if (!parsedPayload.ok) {
      if (parsedPayload.error === "unsupported_format") {
        const seen = (json as { format_version?: unknown } | null)?.format_version;
        const formatVersion = typeof seen === "number" ? seen : 0;
        return fail({ kind: "unsupported_format", formatVersion });
      }
      return fail({ kind: "invalid_payload", field: parsedPayload.field });
    }

    // Step 6: derive the opening-records key from the DEK and return it with
    // the payload. The key is non-extractable; the DEK is zeroed in `finally`.
    const openingKey = await deriveOpeningKey(dek, letterIdBytes);
    return { ok: true, payload: parsedPayload.value, openingKey };
  } finally {
    if (haveDek) {
      zero(dek);
    }
  }
}
