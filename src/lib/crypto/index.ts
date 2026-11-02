// Public API of the browser crypto library (crypto.md, design.md).
//
// This barrel re-exports ONLY the surface other code may use. Internal key
// derivation (deriveBackupKek / deriveOpeningKey in kdf.ts) is deliberately NOT
// re-exported: callers seal and open through sealLetter / openLetter and never
// touch a KEK directly.
//
// WebCrypto only, browser-safe. Everything reachable from here runs in the
// browser: `src/lib/crypto` must never be imported by server code (structure.md,
// crypto.md), and import-boundary.test.ts proves it.

// Backup key: generation, display formatting and strict parsing.
export {
  generateBackupKey,
  formatBackupKey,
  parseBackupKey,
} from "./backup-key";

// The public demo backup key (for demo persona letters ONLY — never a real one).
export { PUBLIC_DEMO_BACKUP_KEY } from "./demo-key";

// Seal and open a letter.
export { sealLetter } from "./seal";
export { openLetter } from "./open";

// Passkey module: create, confirm and assert a passkey, and the browser port.
// The test fake under ./testing is deliberately never exported here.
export {
  createPasskey,
  confirmPasskey,
  assertPasskey,
  PASSKEY_USER_NAME,
} from "./passkey";
export type {
  CreatePasskeyResult,
  ConfirmPasskeyResult,
  AssertPasskeyResult,
} from "./passkey";
export { browserAuthenticatorPort } from "./authenticator-port";
export type { AuthenticatorPort } from "./authenticator-port";

// Encrypted opening records (the reader's recall answers).
export {
  encryptOpeningRecord,
  decryptOpeningRecord,
} from "./opening-records";

// Public error, result and branded key types.
export type {
  OpenError,
  OpenResult,
  BackupKeyError,
  ParsedBackupKey,
  BackupKeyBytes,
  SealErrorDetail,
} from "./errors";

// Input/result shapes for seal, open and opening records.
export type { SealInput, SealResult, PasskeyFactor } from "./seal";
export { SealError } from "./seal";
export type { OpenInput } from "./open";
export type { OpeningRecord } from "./opening-records";
