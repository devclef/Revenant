// Encrypted opening records: the reader's recall answers (design.md
// "Opening records", crypto.md).
//
// After a letter opens, the reader answers the sealed recall questions before
// anything is shown. Those answers are encrypted in the browser with the
// per-letter `openingKey` (derived from the DEK in `kdf.ts`) so the operator
// can never read them. Each record is a self-contained AES-256-GCM box:
//
//   ciphertext = AES-256-GCM(
//     key = openingKey,
//     iv  = fresh 12-byte nonce,
//     aad = letterId ‖ UTF-8("opening"),
//     pt  = UTF-8(canonicalize(value)),
//   )
//
// The AAD binds every record to its letter: a record moved to another letter
// (different letterId) fails its GCM authentication and decrypts to nothing.
// The payload is the canonical JSON of the answer value, so the stored bytes
// for a given answer are stable and carry no key material or plaintext in the
// clear.
//
// WebCrypto only, browser-safe: the one platform call is
// `globalThis.crypto.subtle`. This module imports `../seal-format` (pure) and
// no `node:` module and nothing from src/lib/db.

import { canonicalize, decodeBase64url, encodeBase64url } from "../seal-format";

const GCM_NONCE_BYTES = 12;

const utf8Encode = new TextEncoder();
const utf8Decode = new TextDecoder();

/** The stored form of one encrypted opening record. Both fields base64url. */
export interface OpeningRecord {
  /** The AES-256-GCM ciphertext (payload + 16-byte tag) as base64url. */
  ciphertext: string;
  /** The 12-byte GCM nonce as base64url. */
  nonce: string;
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

/** AAD binding a record to its letter: `letterId ‖ UTF-8("opening")`. */
function openingAad(letterId: Uint8Array): Uint8Array<ArrayBuffer> {
  return concatBytes(letterId, utf8Encode.encode("opening"));
}

/**
 * Encrypt one opening record.
 *
 * Encrypts `UTF-8(canonicalize(value))` with the opening key, a fresh 12-byte
 * nonce and AAD `letterId ‖ "opening"`. Returns the ciphertext and nonce as
 * base64url. `value` must be JSON-representable; `canonicalize` rejects
 * anything that is not (NaN, Infinity, undefined, functions, symbols, BigInt).
 *
 * @param key      the per-letter opening `CryptoKey` from `deriveOpeningKey`.
 * @param letterId the letter's 16 ID bytes (bound as AAD).
 * @param value    the JSON answer value to seal.
 */
export async function encryptOpeningRecord(
  key: CryptoKey,
  letterId: Uint8Array,
  value: unknown,
): Promise<OpeningRecord> {
  const nonce = randomNonce();
  const aad = openingAad(letterId);
  const plaintext = utf8Encode.encode(canonicalize(value));
  const ciphertextBuf = await globalThis.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: nonce, additionalData: aad },
    key,
    plaintext,
  );
  return {
    ciphertext: encodeBase64url(new Uint8Array(ciphertextBuf)),
    nonce: encodeBase64url(nonce),
  };
}

/**
 * Decrypt one opening record and return the parsed JSON value.
 *
 * Reverses `encryptOpeningRecord`: decodes the base64url fields, decrypts with
 * the opening key and AAD `letterId ‖ "opening"`, then parses the UTF-8 bytes
 * as JSON. A record whose `letterId` (AAD) does not match the key's letter, a
 * wrong key, or any tampering fails AES-GCM authentication and rejects; the
 * thrown error carries no plaintext or key material.
 *
 * @param key      the per-letter opening `CryptoKey` from `deriveOpeningKey`.
 * @param letterId the letter's 16 ID bytes (must match the sealing letter).
 * @param record   the stored `{ ciphertext, nonce }`, both base64url.
 */
export async function decryptOpeningRecord(
  key: CryptoKey,
  letterId: Uint8Array,
  record: OpeningRecord,
): Promise<unknown> {
  const nonce = decodeBase64url(record.nonce, GCM_NONCE_BYTES);
  const ciphertext = decodeBase64url(record.ciphertext);
  const aad = openingAad(letterId);
  const plaintextBuf = await globalThis.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBufferView(nonce), additionalData: aad },
    key,
    toArrayBufferView(ciphertext),
  );
  return JSON.parse(utf8Decode.decode(plaintextBuf));
}
