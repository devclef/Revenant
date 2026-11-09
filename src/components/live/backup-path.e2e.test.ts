import { describe, expect, it } from "vitest";

import { buildRecallRecord } from "@/lib/recall";

type RecallQuestionV1 = PayloadV1["recall_questions"][number];
import { encodeBase64url } from "@/lib/seal-format";
import type { PayloadV1 } from "@/lib/seal-format";

import { readBackupKeyField, readUnlockEnvelope } from "./unlock";
import {
  INITIAL_STATE,
  reduce,
  type FlowState,
} from "@/components/reveal/opening-machine";

/**
 * The backup key path, end to end (spec 06 R17.6 to R17.10, R21.6; the
 * Letter_Page step of the QA plan). Five steps, with the real crypto, the real
 * unlock helpers and the real reducer. No DOM and no network:
 *
 *   1. Seal a letter with a backup wrap only (the Backup_Fallback shape).
 *   2. The server releases the secret: `readUnlockEnvelope` reads the header
 *      and reports a backup wrap and no passkey (R17.10).
 *   3. The reader pastes the grouped key: `readBackupKeyField` parses it with
 *      no request. A mistyped key gives `mistyped_key` and no bytes.
 *   4. `openLetter` opens with that key, and the reducer enters `verified`.
 *   5. The Recall_Record is stored (`POST_OK`) before the reveal. No letter
 *      text or figure is shown earlier.
 *
 * The step that failed on revenant.devclef.se is recorded in the commit
 * message; this file pins the path so the same failure cannot come back.
 */

const SEALED_AT = "2026-10-31T12:00:00.000Z";
const OPENS_AT = "2026-11-01T00:00:00.000Z";
const LETTER_TEXT = "A short letter to my future self.";

async function loadCrypto() {
  const [seal, open, key, opening] = await Promise.all([
    import("@/lib/crypto/seal"),
    import("@/lib/crypto/open"),
    import("@/lib/crypto/backup-key"),
    import("@/lib/crypto/opening-records"),
  ]);
  return {
    sealLetter: seal.sealLetter,
    openLetter: open.openLetter,
    formatBackupKey: key.formatBackupKey,
    generateBackupKey: key.generateBackupKey,
    parseBackupKey: key.parseBackupKey,
    encryptOpeningRecord: opening.encryptOpeningRecord,
  };
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(length);
  globalThis.crypto.getRandomValues(out);
  return out;
}

function payloadWith(questions: RecallQuestionV1[]): PayloadV1 {
  return {
    format_version: 1,
    letter_text: LETTER_TEXT,
    metrics: [],
    figures: [],
    recall_questions: questions,
  } as PayloadV1;
}

describe("backup key path, end to end (R17.6 to R17.10, R21.6)", () => {
  it("seals with a backup wrap, opens with the pasted key, and reveals only after the record is stored", async () => {
    const crypto = await loadCrypto();
    const letterIdBytes = randomBytes(16);
    const letterId = encodeBase64url(letterIdBytes);
    const serverSecret = randomBytes(32);
    const backupKey = crypto.generateBackupKey();

    // Step 1: seal, backup wrap only.
    const sealed = await crypto.sealLetter({
      payload: payloadWith([]),
      letterId: letterIdBytes,
      serverSecret,
      backupKey,
      sealedAt: SEALED_AT,
      opensAt: OPENS_AT,
    });

    // Step 2: the secret is released, so read the header. Backup only, no passkey.
    const envelope = sealed.envelope;
    const read = readUnlockEnvelope(envelope, encodeBase64url(serverSecret));
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.unlock).toEqual({ passkey: null, backup: true });
    expect(read.passkeyHeader).toBeNull();

    let state: FlowState = reduce(INITIAL_STATE, { type: "LETTER_OPENABLE", envelope, envelopeHash: sealed.envelopeHash });
    state = reduce(state, { type: "NEEDS_KEY", unlock: read.unlock });
    expect(state.tag).toBe("awaiting_key");

    // Step 3: a mistyped key keeps the field, sends nothing and gives no bytes.
    const formatted = crypto.formatBackupKey(backupKey);
    const wrongText = formatted.slice(0, -1) + (formatted.endsWith("A") ? "B" : "A");
    const mistyped = readBackupKeyField(crypto, wrongText);
    expect(mistyped.ok).toBe(false);
    if (mistyped.ok) return;
    expect(mistyped.notice).toBe("mistyped_key");
    state = reduce(state, { type: "KEY_NOTICE", notice: mistyped.notice });
    expect(state.tag).toBe("awaiting_key");

    // The pasted key, grouped and in lower case, is accepted.
    const pasted = formatted.toLowerCase();
    const parsed = readBackupKeyField(crypto, pasted);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    // Step 4: unlock with the backup key, then open the letter.
    state = reduce(state, { type: "UNLOCK" });
    expect(state.tag).toBe("unlocking");
    const opened = await crypto.openLetter({
      envelope,
      envelopeHash: sealed.envelopeHash,
      serverSecret,
      backupKey: parsed.key,
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    state = reduce(state, {
      type: "OPENED",
      opened: {
        letterId,
        header: { sealedAt: SEALED_AT, opensAt: OPENS_AT },
        payload: opened.payload,
        openingKey: opened.openingKey,
        envelopeHash: sealed.envelopeHash,
      },
    });
    expect(state.tag).toBe("recall");

    // Step 5: the recall step holds no reveal. Sealing the record and posting
    // it are the only way to reach the reveal.
    expect(state.tag).not.toBe("reveal");
    const begun = state;
    if (begun.tag !== "recall") return;

    const built = buildRecallRecord([], begun.drafts);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const sealedRecord = await crypto.encryptOpeningRecord(
      opened.openingKey,
      letterIdBytes,
      built.record,
    );
    const submitting = reduce(begun, {
      type: "RECORD_SEALED",
      record: built.record,
      sealed: sealedRecord,
    });
    expect(submitting.tag).toBe("submitting");

    const failedPost = reduce(submitting, { type: "POST_FAILED" });
    expect(failedPost.tag).toBe("submit_failed");
    expect(reduce(failedPost, { type: "ADVANCE" }).tag).not.toBe("reveal");

    const revealed = reduce(submitting, { type: "POST_OK" });
    expect(revealed.tag).toBe("reveal");
  });

  it("keeps the key step and sends nothing for a wrong backup key (R17.10)", async () => {
    const crypto = await loadCrypto();
    const letterIdBytes = randomBytes(16);
    const serverSecret = randomBytes(32);
    const backupKey = crypto.generateBackupKey();
    const sealed = await crypto.sealLetter({
      payload: payloadWith([]),
      letterId: letterIdBytes,
      serverSecret,
      backupKey,
      sealedAt: SEALED_AT,
      opensAt: OPENS_AT,
    });

    // A valid key from another letter parses, and openLetter refuses it.
    const other = crypto.generateBackupKey();
    const parsed = readBackupKeyField(crypto, crypto.formatBackupKey(other));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const refused = await crypto.openLetter({
      envelope: sealed.envelope,
      envelopeHash: sealed.envelopeHash,
      serverSecret,
      backupKey: parsed.key,
    });
    expect(refused.ok).toBe(false);

    let state: FlowState = reduce(INITIAL_STATE, { type: "LETTER_OPENABLE", envelope: sealed.envelope, envelopeHash: sealed.envelopeHash });
    const read = readUnlockEnvelope(sealed.envelope, encodeBase64url(serverSecret));
    if (!read.ok) throw new Error("header should parse");
    state = reduce(state, { type: "NEEDS_KEY", unlock: read.unlock });
    state = reduce(state, { type: "UNLOCK" });
    state = reduce(state, { type: "KEY_REJECTED", factor: "backup" });
    expect(state).toMatchObject({ tag: "awaiting_key", notice: "wrong_backup" });
  });
});
