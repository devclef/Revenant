// Key derivation for the letter key hierarchy (crypto.md, design.md).
//
// HKDF-SHA256 derives every key, each with its own `info` string so two
// derivations from the same input material can never collide. The derived
// keys are non-extractable AES-256-GCM CryptoKeys: once WebCrypto holds them,
// the raw bytes cannot be read back out, so they are never logged, serialised
// or sent to the server (crypto.md).
//
// Key hierarchy (crypto.md):
//
//   DEK  (random 256-bit, encrypts the payload)
//    └─ wrapped by KEK_backup = HKDF(ikm = backupKey ‖ serverSecret,
//                                    salt = letterId,
//                                    info = "revenant-kek-backup-v1")
//   openingKey = HKDF(ikm = DEK, salt = letterId, info = "revenant-opening-v1")
//
// `serverSecret` is part of KEK_backup, so the backup factor cannot unwrap the
// DEK before the server releases the secret at the opening date. The passkey
// KEK (`revenant-kek-passkey-v1`) is derived in the passkey module, not here.
//
// WebCrypto only, browser-safe: the one platform call is
// `globalThis.crypto.subtle`. This module imports no `node:` module and
// nothing from src/lib/db. The functions are internal to src/lib/crypto and
// are not re-exported from index.ts.

import type { BackupKeyBytes } from "./errors";

/** Info strings, fixed per crypto.md. Never change the meaning of one. */
const INFO_KEK_BACKUP = "revenant-kek-backup-v1";
const INFO_OPENING = "revenant-opening-v1";

const LETTER_ID_BYTES = 16;
const SERVER_SECRET_BYTES = 32;
const DEK_BYTES = 32;

const utf8 = new TextEncoder();

/**
 * Copy bytes into a fresh `ArrayBuffer`-backed `Uint8Array`. WebCrypto's
 * typings require a `BufferSource` whose buffer is an `ArrayBuffer` (not a
 * possibly-shared `ArrayBufferLike`), so copying guarantees the right backing
 * store regardless of where the input came from.
 */
function toArrayBufferView(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(bytes.length);
  out.set(bytes);
  return out;
}

/**
 * Concatenate byte arrays into one fresh `ArrayBuffer`-backed Uint8Array. Used
 * to build HKDF input keying material (`ikm = a ‖ b`). The inputs are not
 * mutated.
 */
function concatBytes(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  let total = 0;
  for (const p of parts) {
    total += p.length;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/**
 * Derive a non-extractable AES-256-GCM key from input keying material via
 * HKDF-SHA256. Imports `ikm` as a raw HKDF key, then derives the AES-GCM key
 * with the given `salt` and `info`. The intermediate HKDF key is extractable:
 * false, and the derived AES key is also non-extractable, so no raw bytes of
 * either leave WebCrypto.
 */
async function hkdfToAesGcmKey(
  ikm: Uint8Array<ArrayBuffer>,
  salt: Uint8Array,
  info: string,
): Promise<CryptoKey> {
  const subtle = globalThis.crypto.subtle;
  const baseKey = await subtle.importKey("raw", ikm, "HKDF", false, [
    "deriveKey",
  ]);
  return subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: toArrayBufferView(salt),
      info: utf8.encode(info),
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false, // non-extractable
    ["encrypt", "decrypt"],
  );
}

/**
 * Derive the backup key-encryption key.
 *
 *   KEK_backup = HKDF-SHA256(
 *     ikm  = backupKey(16) ‖ serverSecret(32),
 *     salt = letterId(16),
 *     info = "revenant-kek-backup-v1",
 *   )
 *
 * Returned as a non-extractable AES-256-GCM `CryptoKey` used to wrap/unwrap the
 * DEK. Both `backupKey` and `serverSecret` are required inputs; without the
 * server secret (released only at the opening date) the KEK is not reproducible.
 *
 * Internal to src/lib/crypto. Callers pass the branded `BackupKeyBytes` from
 * `parseBackupKey`/`generateBackupKey`, guaranteeing the 16-byte length.
 */
export async function deriveBackupKek(
  backupKey: BackupKeyBytes,
  serverSecret: Uint8Array,
  letterId: Uint8Array,
): Promise<CryptoKey> {
  if (backupKey.length !== LETTER_ID_BYTES) {
    // 16 bytes; BackupKeyBytes brand already guarantees this, but assert
    // defensively so an unbranded cast cannot slip a wrong length through.
    throw new Error("backup key must be 16 bytes");
  }
  if (serverSecret.length !== SERVER_SECRET_BYTES) {
    throw new Error("server secret must be 32 bytes");
  }
  if (letterId.length !== LETTER_ID_BYTES) {
    throw new Error("letter ID must be 16 bytes");
  }
  const ikm = concatBytes(backupKey, serverSecret);
  return hkdfToAesGcmKey(ikm, letterId, INFO_KEK_BACKUP);
}

/**
 * Derive the opening-records key.
 *
 *   openingKey = HKDF-SHA256(
 *     ikm  = DEK(32),
 *     salt = letterId(16),
 *     info = "revenant-opening-v1",
 *   )
 *
 * Returned as a non-extractable AES-256-GCM `CryptoKey` used to encrypt the
 * reader's recall answers, so the operator cannot read them. Derived from the
 * DEK, so it is available only once the letter has been unwrapped.
 *
 * Internal to src/lib/crypto.
 */
export async function deriveOpeningKey(
  dek: Uint8Array,
  letterId: Uint8Array,
): Promise<CryptoKey> {
  if (dek.length !== DEK_BYTES) {
    throw new Error("DEK must be 32 bytes");
  }
  if (letterId.length !== LETTER_ID_BYTES) {
    throw new Error("letter ID must be 16 bytes");
  }
  return hkdfToAesGcmKey(toArrayBufferView(dek), letterId, INFO_OPENING);
}
