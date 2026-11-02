import { describe, expect, it } from "vitest";

import { readKeyFragment } from "@/lib/cards/fragment";
import type { PayloadV1 } from "@/lib/seal-format";

import { backupKeyFragmentUrl } from "./BackupKeyCard";

/**
 * Double-wrap round trip (spec 06 task 12, R21.7). A letter sealed with a
 * passkey wrap and a backup wrap opens with either factor. The backup key also
 * makes the trip the card takes: printed in the `#k=` fragment, read back by
 * `readKeyFragment`, parsed, and used to open the letter.
 *
 * The crypto modules load through dynamic import(). The component boundary
 * rule forbids a static `@/lib/crypto` import anywhere under src/components.
 */

const APP_ORIGIN = "https://revenant.devclef.se";
const LETTER_ID = "Q1JLWmJqQ3BkMzhWaHh4eA";
const SEALED_AT = "2026-10-31T12:00:00.000Z";
const OPENS_AT = "2027-02-01T00:00:00.000Z";

async function loadCrypto() {
  const [seal, open, key] = await Promise.all([
    import("@/lib/crypto/seal"),
    import("@/lib/crypto/open"),
    import("@/lib/crypto/backup-key"),
  ]);
  return {
    sealLetter: seal.sealLetter,
    openLetter: open.openLetter,
    formatBackupKey: key.formatBackupKey,
    generateBackupKey: key.generateBackupKey,
    parseBackupKey: key.parseBackupKey,
  };
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(length);
  globalThis.crypto.getRandomValues(out);
  return out;
}

const payload: PayloadV1 = {
  format_version: 1,
  letter_text: "a quiet autumn",
  metrics: [],
  figures: [],
  recall_questions: [],
};

async function sealWithBoth(serverSecret: Uint8Array, prfOutput: Uint8Array) {
  const crypto = await loadCrypto();
  const backupKey = crypto.generateBackupKey();
  const sealed = await crypto.sealLetter({
    payload,
    letterId: randomBytes(16),
    serverSecret,
    backupKey,
    passkey: {
      // sealLetter zeroes the PRF bytes it is given, so pass a copy and keep
      // the original for the open calls.
      prfOutput: prfOutput.slice(),
      credentialId: randomBytes(32),
      prfSalt: randomBytes(32),
      rpId: "revenant.devclef.se",
    },
    sealedAt: SEALED_AT,
    opensAt: OPENS_AT,
  });
  return { ...sealed, backupKey };
}

describe("double-wrap round trip (R21.7)", () => {
  it("opens with the backup key alone", async () => {
    const crypto = await loadCrypto();
    const serverSecret = randomBytes(32);
    const { envelope, envelopeHash, backupKey } = await sealWithBoth(serverSecret, randomBytes(32));

    const opened = await crypto.openLetter({ envelope, envelopeHash, serverSecret, backupKey });

    expect(opened.ok).toBe(true);
    if (opened.ok) expect(opened.payload.letter_text).toBe(payload.letter_text);
  });

  it("opens with the passkey PRF output alone", async () => {
    const crypto = await loadCrypto();
    const serverSecret = randomBytes(32);
    const prfOutput = randomBytes(32);
    const { envelope, envelopeHash } = await sealWithBoth(serverSecret, prfOutput);

    const opened = await crypto.openLetter({
      envelope,
      envelopeHash,
      serverSecret,
      passkey: { prfOutput },
    });

    expect(opened.ok).toBe(true);
    if (opened.ok) expect(opened.payload.letter_text).toBe(payload.letter_text);
  });

  it("opens from the key printed in the card's fragment", async () => {
    const crypto = await loadCrypto();
    const serverSecret = randomBytes(32);
    const { envelope, envelopeHash, backupKey } = await sealWithBoth(serverSecret, randomBytes(32));

    // The card's QR URL carries the key in the fragment. Read it back the way
    // LiveLetter does on mount.
    const url = backupKeyFragmentUrl(APP_ORIGIN, LETTER_ID, crypto.formatBackupKey(backupKey));
    const keyText = readKeyFragment(new URL(url).hash);
    expect(keyText).not.toBeNull();
    if (keyText === null) return;

    const parsed = crypto.parseBackupKey(keyText);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const opened = await crypto.openLetter({
      envelope,
      envelopeHash,
      serverSecret,
      backupKey: parsed.key,
    });
    expect(opened.ok).toBe(true);
    if (opened.ok) expect(opened.payload.letter_text).toBe(payload.letter_text);
  });

  it("refuses a different backup key", async () => {
    const crypto = await loadCrypto();
    const serverSecret = randomBytes(32);
    const { envelope, envelopeHash } = await sealWithBoth(serverSecret, randomBytes(32));

    const opened = await crypto.openLetter({
      envelope,
      envelopeHash,
      serverSecret,
      backupKey: crypto.generateBackupKey(),
    });

    expect(opened.ok).toBe(false);
  });
});
