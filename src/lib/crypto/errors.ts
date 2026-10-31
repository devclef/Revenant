// Error unions and branded types for the browser crypto library.
//
// Per design.md ("Error Handling") and crypto.md R3.16, every message an error
// carries is a FIXED string. No error here ever embeds key material, plaintext,
// byte values, Zod received values or any other secret-derived data. The
// discriminated-union `kind` (and the few structural fields below) is all a
// caller gets; the human-facing copy is chosen by the UI, not by this module.
//
// WebCrypto only, browser-safe: this module has no `node:` imports and no
// runtime dependencies. It defines types and two small type guards.

import type { PayloadV1 } from "../seal-format";

// --- Branded backup-key types ------------------------------------------------

// A nominal brand so a plain `Uint8Array` cannot be passed where a validated,
// 16-byte backup key is required. The brand is a phantom property that exists
// only in the type system; at runtime the value is an ordinary Uint8Array.
declare const backupKeyBrand: unique symbol;

/**
 * Exactly the 16 random bytes of a backup key, after `parseBackupKey` has
 * validated length, alphabet, leading digit and checksum. Produced only by
 * `parseBackupKey` / `generateBackupKey`; it cannot be forged from a bare
 * `Uint8Array` without an explicit cast.
 */
export type BackupKeyBytes = Uint8Array & { readonly [backupKeyBrand]: true };

/**
 * Result of `parseBackupKey`. A mistyped or malformed key yields
 * `{ ok: false, error: { kind: "mistyped_key" } }` and never the bytes.
 */
export type ParsedBackupKey =
  | { ok: true; key: BackupKeyBytes }
  | { ok: false; error: BackupKeyError };

/**
 * The only failure a backup key parse can report. It names nothing about which
 * rule failed or what was typed, so a shoulder-surfer or a log learns nothing.
 */
export type BackupKeyError = { kind: "mistyped_key" };

// --- Open error union --------------------------------------------------------

/**
 * Everything `openLetter` (and `sealLetter`, for its input checks) can refuse
 * with. Each variant is distinguished by `kind`; the structural fields
 * (`field`, `formatVersion`) carry only a schema path or a version number,
 * never a value from the envelope, the key or the plaintext.
 *
 * - `invalid_input`: a length or ordering precondition failed before any key
 *   derivation. `field` says which input: the letter ID, the server secret,
 *   the envelope itself, or `written_as_of` (later than the seal date).
 * - `verification_failed`: the recomputed envelope hash did not match the
 *   stored hash. No unwrap or decrypt is attempted (R3.11, R3.12).
 * - `wrong_key`: the backup wrap would not unwrap (wrong backup key or wrong
 *   server secret). Fails closed with no payload (R3.13, R3.15).
 * - `tampered`: the payload ciphertext failed its AES-GCM authentication.
 * - `unsupported_format`: the envelope or payload names a format version that
 *   is not in the registry. `formatVersion` is the integer that was seen.
 * - `invalid_payload`: the decrypted payload failed its strict schema. `field`
 *   is the first failing schema path.
 */
export type OpenError =
  | {
      kind: "invalid_input";
      field: "letterId" | "serverSecret" | "envelope" | "written_as_of";
    }
  | { kind: "verification_failed" }
  | { kind: "wrong_key" }
  | { kind: "tampered" }
  | { kind: "unsupported_format"; formatVersion: number }
  | { kind: "invalid_payload"; field: string };

/**
 * The result of `openLetter`. On success it carries the validated v1 payload
 * and a non-extractable `CryptoKey` for encrypting opening records; neither the
 * DEK nor any raw key bytes are ever exposed. On failure it carries an
 * `OpenError` and nothing else.
 */
export type OpenResult =
  | { ok: true; payload: PayloadV1; openingKey: CryptoKey }
  | { ok: false; error: OpenError };
