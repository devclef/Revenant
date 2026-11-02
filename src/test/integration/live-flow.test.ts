// End-to-end integration test for the live lock-and-unlock flow (spec
// 06-lock-and-unlock, task 3; R6.1, R6.2, R6.6, R22.3).
//
// This is the only test in the suite that waits. A live letter is locked for
// 30 seconds, so the test seals a real passkey-wrapped envelope through the
// Prepare and Seal routes, checks that it stays hidden, polls until it opens,
// then unlocks it with the same fake passkey and records a recall answer.
//
// The passkey comes from the fake Authenticator_Port in `./testing`, so no
// browser is needed. The crypto code under test runs as the browser would run
// it, and the route handlers run as the server would run them, against a real
// Postgres scratch database created by `describeLiveDb`. The suite skips
// locally without a test database, as the other integration suites do.

import { vi, expect, it } from "vitest";

import {
  assertPasskey,
  confirmPasskey,
  createPasskey,
  decryptOpeningRecord,
  encryptOpeningRecord,
  openLetter,
  sealLetter,
} from "@/lib/crypto";
import { createFakeAuthenticator } from "@/lib/crypto/testing/fake-authenticator";
import { getSql } from "@/lib/db/client";
import {
  LOCK_DURATION_MS,
  decodeBase64url,
  encodeBase64url,
  envelopeHash,
} from "@/lib/seal-format";
import type { PayloadV1 } from "@/lib/seal-format";

import {
  LIVE_RP_ID,
  PLACEHOLDER_PAYLOAD_CIPHERTEXT,
  PLACEHOLDER_PAYLOAD_NONCE,
  callLetter,
  callOpenings,
  callSecret,
  callSeal,
  describeLiveDb,
  pollLetter,
  prepareDraft,
} from "./live-helpers";
import type { LetterStatusBody, SealedLive } from "./live-helpers";

// The one test here waits up to 45 seconds for the lock to pass. Give the file
// room for that wait plus the database round trips.
vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

/** The longest the test waits for the 30-second lock to pass. */
const POLL_TIMEOUT_MS = 45_000;

/** The recall answers the reader gives. Any JSON value is accepted. */
const ANSWERS = {
  "q-fuel": { answer_type: "number", value: "2.89" },
};

/**
 * A valid v1 payload with one official figure, its metric definition, and one
 * recall question. The values are obvious test fixtures, labelled FIXTURE, and
 * are sealed only inside this test's scratch database.
 */
function buildPayload(): PayloadV1 {
  return {
    format_version: 1,
    letter_text:
      "A letter to my future self. Some things will have changed by the " +
      "time you read this, and some will be exactly as they are now.",
    metrics: [
      {
        id: "fuel-fixture",
        display_name: "Fixture fuel price",
        unit: "USD per gallon",
        region: "U.S. city average",
        source: "FIXTURE source",
        series_id: "FIXTURE_FUEL_001",
      },
    ],
    figures: [
      {
        kind: "official",
        metric_id: "fuel-fixture",
        value: "3.412",
        unit: "USD per gallon",
        region: "U.S. city average",
        period: "2024-10",
        source: "FIXTURE source",
        series_id: "FIXTURE_FUEL_001",
        retrieved_at: "2024-10-30T14:02:11Z",
        source_url: "https://example.invalid/fixture/fuel",
      },
    ],
    recall_questions: [
      {
        id: "q-fuel",
        answer_type: "number",
        text: "What do you think a gallon of fuel cost then?",
        metric_id: "fuel-fixture",
      },
    ],
  };
}

/** True when a letter-route body has the given status, read without trusting its shape. */
function hasStatus(body: unknown, status: string): boolean {
  return (body as { status?: unknown } | null)?.status === status;
}

describeLiveDb("live lock and unlock, end to end (integration)", () => {
  it("seals with a passkey, stays hidden for 30 seconds, then opens with the same passkey", async () => {
    const sql = getSql();
    const payload = buildPayload();

    // --- Prepare a Draft and create the passkey -----------------------------
    const draft = await prepareDraft();
    const letterIdBytes = decodeBase64url(draft.letterId);
    const serverSecret = decodeBase64url(draft.serverSecret, 32);

    const authenticator = createFakeAuthenticator();
    const created = await createPasskey(authenticator, { rpId: LIVE_RP_ID });
    if (!created.ok) {
      throw new Error(`createPasskey failed: ${created.reason}`);
    }
    const confirmed = await confirmPasskey(authenticator, {
      rpId: LIVE_RP_ID,
      credentialId: created.credentialId,
      prfSalt: created.prfSalt,
      createdPrf: created.createdPrf,
    });
    if (!confirmed.ok) {
      throw new Error(`confirmPasskey failed: ${confirmed.reason}`);
    }

    // --- (1) Seal with the passkey factor and POST to the Seal_Route --------
    // The seal time is the Draft's server time, so the lock rule holds when the
    // route checks it against the database clock. The opening time is exactly
    // 30 seconds later.
    const sealedAt = new Date(draft.serverNow).toISOString();
    const opensAt = new Date(Date.parse(sealedAt) + LOCK_DURATION_MS).toISOString();
    const sealed = await sealLetter({
      payload,
      letterId: letterIdBytes,
      serverSecret,
      passkey: {
        prfOutput: confirmed.prfOutput,
        credentialId: confirmed.credentialId,
        prfSalt: confirmed.prfSalt,
        rpId: LIVE_RP_ID,
      },
      sealedAt,
      opensAt,
    });

    const sealRes = await callSeal({
      letterId: draft.letterId,
      envelope: sealed.envelope,
      envelopeHash: sealed.envelopeHash,
    });
    expect(sealRes.status).toBe(201);
    const sealBody = (await sealRes.json()) as SealedLive;
    expect(sealBody.letterId).toBe(draft.letterId);
    expect(sealBody.opensAt).toBe(opensAt);

    // Exactly one demo_letters row for this letter, kind 'live', with
    // opens_at 30 seconds after sealed_at.
    const liveRows = await sql<{ kind: string; sealed_at: Date | string; opens_at: Date | string }[]>`
      SELECT kind, sealed_at, opens_at
      FROM demo_letters
      WHERE id = ${draft.letterId}
    `;
    expect(liveRows).toHaveLength(1);
    expect(liveRows[0].kind).toBe("live");
    expect(new Date(liveRows[0].opens_at).getTime()).toBe(
      new Date(liveRows[0].sealed_at).getTime() + LOCK_DURATION_MS,
    );

    // --- (2) Right after sealing, the letter stays hidden -------------------
    // The letter route shows only the status, the opening time and the demo
    // flag. The secret route refuses, and an opening POST is refused and stores
    // nothing.
    const letterRes = await callLetter(draft.letterId);
    expect(letterRes.status).toBe(200);
    expect(await letterRes.json()).toEqual({
      status: "sealed",
      opensAt,
      demo: true,
    });

    const earlySecret = await callSecret(draft.letterId);
    expect(earlySecret.status).toBe(403);

    const earlyOpening = await callOpenings({
      letterId: draft.letterId,
      ciphertext: PLACEHOLDER_PAYLOAD_CIPHERTEXT,
      nonce: PLACEHOLDER_PAYLOAD_NONCE,
    });
    expect(earlyOpening.status).toBe(403);

    const [{ n: earlyRowCount }] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n
      FROM openings
      WHERE demo_letter_id = ${draft.letterId}
    `;
    expect(earlyRowCount).toBe(0);

    // --- (3) Poll until the letter is openable ------------------------------
    const reading = await pollLetter(
      draft.letterId,
      (r) => r.httpStatus === 200 && hasStatus(r.body, "openable"),
      { timeoutMs: POLL_TIMEOUT_MS },
    );
    const openable = reading.body as LetterStatusBody;
    expect(openable.status).toBe("openable");

    // The database clock must have moved at least 30 seconds past the seal.
    const [{ now: dbNow }] = await sql<{ now: Date | string }[]>`
      SELECT clock_timestamp() AS now
    `;
    expect(new Date(dbNow).getTime() - Date.parse(sealedAt)).toBeGreaterThanOrEqual(
      LOCK_DURATION_MS,
    );

    // The envelope the route returns is the one that was sealed, and its hash
    // verifies.
    if (!openable.envelope || !openable.envelopeHash) {
      throw new Error("the openable letter body is missing its envelope or hash");
    }
    expect(openable.envelopeHash).toBe(sealed.envelopeHash);
    expect(await envelopeHash(openable.envelope)).toBe(openable.envelopeHash);

    // The server releases the time-lock secret, and it matches the sealed one.
    const secretRes = await callSecret(draft.letterId);
    expect(secretRes.status).toBe(200);
    const released = decodeBase64url(
      ((await secretRes.json()) as { serverSecret: string }).serverSecret,
      32,
    );
    expect(Array.from(released)).toEqual(Array.from(serverSecret));

    // Unlock with the same fake passkey. The page hostname is the RP ID, as the
    // real page would be.
    const asserted = await assertPasskey(authenticator, {
      rpId: LIVE_RP_ID,
      credentialId: confirmed.credentialId,
      prfSalt: confirmed.prfSalt,
      pageHostname: LIVE_RP_ID,
    });
    if (!asserted.ok) {
      throw new Error(`assertPasskey failed: ${asserted.reason}`);
    }
    const opened = await openLetter({
      envelope: openable.envelope,
      envelopeHash: openable.envelopeHash,
      serverSecret: released,
      passkey: { prfOutput: asserted.prfOutput },
    });
    if (!opened.ok) {
      throw new Error("openLetter did not open the letter with the passkey");
    }
    expect(opened.payload).toEqual(payload);

    // Record the recall answers after the unlock, as the reader would. The
    // stored row must decrypt back to the same answers.
    const record = await encryptOpeningRecord(
      opened.openingKey,
      letterIdBytes,
      ANSWERS,
    );
    const openingRes = await callOpenings({
      letterId: draft.letterId,
      ciphertext: record.ciphertext,
      nonce: record.nonce,
    });
    expect(openingRes.status).toBe(201);

    const storedRows = await sql<{ ciphertext: Uint8Array; nonce: Uint8Array }[]>`
      SELECT ciphertext, nonce
      FROM openings
      WHERE demo_letter_id = ${draft.letterId}
    `;
    expect(storedRows).toHaveLength(1);
    const decrypted = await decryptOpeningRecord(
      opened.openingKey,
      letterIdBytes,
      {
        ciphertext: encodeBase64url(new Uint8Array(storedRows[0].ciphertext)),
        nonce: encodeBase64url(new Uint8Array(storedRows[0].nonce)),
      },
    );
    expect(decrypted).toEqual(ANSWERS);
  });
});
