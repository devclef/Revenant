// SHA-256 hash of the sealed-letter envelope.
//
// The envelope (the full header including payloadCiphertext, with no hash field
// inside it) is serialised to canonical JSON, encoded as UTF-8 and hashed with
// SHA-256. The hash is computed in the browser at sealing, recomputed and
// checked by the server, and verified again at opening, so the same logical
// envelope must always produce the same 64-character lowercase hex digest.
//
// This module imports only ./canonical-json; nothing from src/lib/crypto or
// src/lib/db. WebCrypto's SubtleCrypto.digest is available in both the browser
// and modern server runtimes, so this is safe to import from either.

import { canonicalize } from "./canonical-json";

/**
 * Compute the SHA-256 of UTF-8(canonicalize(envelope)) and return it as 64
 * lowercase hex characters.
 *
 * `envelope` is the full header object, including `payloadCiphertext`. It must
 * not carry its own hash field: the hash is over everything else.
 */
export async function envelopeHash(envelope: unknown): Promise<string> {
  const json = canonicalize(envelope);
  const bytes = new TextEncoder().encode(json);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return toHex(new Uint8Array(digest));
}

function toHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}
