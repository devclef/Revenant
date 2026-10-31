// The PUBLIC demo backup key.
//
// WARNING: THIS KEY IS PUBLIC. It is committed in source, published with the
// app, and anyone can read it here. It exists ONLY so that demo persona
// letters can be opened without a passkey ("Break the seal"): a persona letter
// is sealed with this very key, so the published key opens it.
//
// It MUST NEVER be used to seal or open a real letter. A real letter's backup
// key is generated fresh in the browser (generateBackupKey), never leaves the
// browser, and is never committed or logged (see crypto.md). Using this public
// key for a real letter would make that letter openable by anyone.
//
// The literal was generated once via formatBackupKey(generateBackupKey()) and
// pasted here as a fixed string. It parses cleanly through parseBackupKey
// (asserted in demo-key.test.ts). Do not regenerate it: changing it would make
// every persona letter already sealed with the old value unopenable.

/**
 * The public demo backup key, in card form (27 Crockford Base32 characters,
 * hyphenated in groups of four). PUBLIC and for demo persona letters ONLY —
 * never for a real letter. See the warning above.
 */
export const PUBLIC_DEMO_BACKUP_KEY = "1Y6D-AP38-G8QW-QADE-NP2J-ZHEJ-FK9";
