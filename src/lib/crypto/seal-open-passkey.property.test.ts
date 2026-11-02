import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { sealLetter, type PasskeyFactor } from "./seal";
import { openLetter } from "./open";
import { generateBackupKey } from "./backup-key";
import { assertPasskey, confirmPasskey, createPasskey } from "./passkey";
import { createFakeAuthenticator } from "./testing/fake-authenticator";
import type { EnvelopeV1, PayloadV1 } from "../seal-format";
import {
  decodeBase64url,
  encodeBase64url,
  envelopeHash,
  parseEnvelope,
} from "../seal-format";

// Feature: 06-lock-and-unlock, task 3: sealing and opening with a passkey
// (design.md Properties 6, 7 and 8). Each property runs 100 times
// (fast-check numRuns: 100). WebCrypto only; the passkey comes from the fake.

const RP_ID = "revenant.devclef.se";
const SEALED_AT = "2026-10-31T12:00:00.000Z";
const OPENS_AT = "2027-02-01T00:00:00.000Z";
const RUNS = 100;

function fresh(length: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(length);
  globalThis.crypto.getRandomValues(out);
  return out;
}

function payload(text: string): PayloadV1 {
  return {
    format_version: 1,
    letter_text: text,
    metrics: [],
    figures: [],
    recall_questions: [],
  };
}

interface Enrolment {
  fake: ReturnType<typeof createFakeAuthenticator>;
  credentialId: Uint8Array;
  prfSalt: Uint8Array;
  prfOutput: Uint8Array;
}

/** A fresh passkey enrolment, as the Seal page does with the fake. */
async function enrol(): Promise<Enrolment> {
  const fake = createFakeAuthenticator();
  const created = await createPasskey(fake, { rpId: RP_ID });
  if (!created.ok) throw new Error("test setup: create failed");
  const confirmed = await confirmPasskey(fake, {
    rpId: RP_ID,
    credentialId: created.credentialId,
    prfSalt: created.prfSalt,
    createdPrf: created.createdPrf,
  });
  if (!confirmed.ok) throw new Error("test setup: confirm failed");
  return {
    fake,
    credentialId: created.credentialId,
    prfSalt: created.prfSalt,
    prfOutput: confirmed.prfOutput,
  };
}

/** The PRF output the page gets from `get` at open time. */
async function prfAtOpen(e: Enrolment): Promise<Uint8Array> {
  const asserted = await assertPasskey(e.fake, {
    rpId: RP_ID,
    credentialId: e.credentialId,
    prfSalt: e.prfSalt,
    pageHostname: RP_ID,
  });
  if (!asserted.ok) throw new Error("test setup: assert failed");
  return asserted.prfOutput;
}

function factorFrom(e: Enrolment): PasskeyFactor {
  return {
    prfOutput: e.prfOutput.slice(),
    credentialId: e.credentialId,
    prfSalt: e.prfSalt,
    rpId: RP_ID,
  };
}

/** Which factors a letter is sealed with: passkey alone, or passkey and backup. */
const factorChoice = fc.constantFrom("passkey" as const, "both" as const);

describe("Property 6: seal then open round trips with a passkey", () => {
  it("returns the same payload for passkey alone and for both factors (100 runs)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 300 }).filter((s) => s.trim().length > 0),
        factorChoice,
        async (text, choice) => {
          const e = await enrol();
          const serverSecret = fresh(32);
          const backupKey = generateBackupKey();
          const { envelope, envelopeHash: hash } = await sealLetter({
            payload: payload(text),
            letterId: fresh(16),
            serverSecret,
            ...(choice === "both" ? { backupKey } : {}),
            passkey: factorFrom(e),
            sealedAt: SEALED_AT,
            opensAt: OPENS_AT,
          });

          const result = await openLetter({
            envelope,
            envelopeHash: hash,
            serverSecret,
            passkey: { prfOutput: await prfAtOpen(e) },
          });
          expect(result.ok).toBe(true);
          if (result.ok) {
            expect(result.payload.letter_text).toBe(text);
          }
        },
      ),
      { numRuns: RUNS },
    );
  });
});

describe("Property 7: the passkey header fields match the factor", () => {
  it("rpId, credentialId and prfSalt are stored exactly, with the wrap shape (100 runs)", async () => {
    await fc.assert(
      fc.asyncProperty(factorChoice, async (choice) => {
        const e = await enrol();
        const { envelope } = await sealLetter({
          payload: payload("header check"),
          letterId: fresh(16),
          serverSecret: fresh(32),
          ...(choice === "both" ? { backupKey: generateBackupKey() } : {}),
          passkey: factorFrom(e),
          sealedAt: SEALED_AT,
          opensAt: OPENS_AT,
        });

        expect(envelope.rpId).toBe(RP_ID);
        expect(decodeBase64url(envelope.credentialId ?? "")).toEqual(e.credentialId);
        expect(decodeBase64url(envelope.prfSalt ?? "")).toEqual(e.prfSalt);

        const factors = envelope.wrappedDeks.map((w) => w.factor);
        expect(factors).toEqual(
          choice === "both" ? ["backup", "passkey"] : ["passkey"],
        );
        const passkeyWrap = envelope.wrappedDeks.find((w) => w.factor === "passkey");
        expect(passkeyWrap).toBeDefined();
        expect(decodeBase64url(passkeyWrap?.nonce ?? "")).toHaveLength(12);
        expect(decodeBase64url(passkeyWrap?.wrappedKey ?? "")).toHaveLength(48);

        expect(parseEnvelope(JSON.parse(JSON.stringify(envelope))).ok).toBe(true);
      }),
      { numRuns: RUNS },
    );
  });
});

describe("Property 8: wrong keys and changes never open the letter", () => {
  it("a PRF output with one flipped byte never opens (100 runs)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 31 }),
        fc.integer({ min: 1, max: 255 }),
        async (index, mask) => {
          const e = await enrol();
          const serverSecret = fresh(32);
          const { envelope, envelopeHash: hash } = await sealLetter({
            payload: payload("wrong key"),
            letterId: fresh(16),
            serverSecret,
            passkey: factorFrom(e),
            sealedAt: SEALED_AT,
            opensAt: OPENS_AT,
          });

          const wrong = await prfAtOpen(e);
          wrong[index] ^= mask;
          const result = await openLetter({
            envelope,
            envelopeHash: hash,
            serverSecret,
            passkey: { prfOutput: wrong },
          });
          expect(result).toMatchObject({ ok: false, error: { kind: "wrong_key" } });
        },
      ),
      { numRuns: RUNS },
    );
  });

  it("a changed ciphertext or header field with a recomputed hash never opens (100 runs)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("ciphertext" as const, "prfSalt" as const, "rpId" as const),
        fc.integer({ min: 0, max: 1023 }),
        async (target, index) => {
          const e = await enrol();
          const serverSecret = fresh(32);
          const { envelope } = await sealLetter({
            payload: payload("changed"),
            letterId: fresh(16),
            serverSecret,
            passkey: factorFrom(e),
            sealedAt: SEALED_AT,
            opensAt: OPENS_AT,
          });

          let changed: EnvelopeV1;
          if (target === "ciphertext") {
            const bytes = decodeBase64url(envelope.payloadCiphertext);
            bytes[index % bytes.length] ^= 0x01;
            changed = { ...envelope, payloadCiphertext: encodeBase64url(bytes) };
          } else if (target === "prfSalt") {
            const salt = decodeBase64url(envelope.prfSalt ?? "");
            salt[index % salt.length] ^= 0x01;
            changed = { ...envelope, prfSalt: encodeBase64url(salt) };
          } else {
            changed = { ...envelope, rpId: "other.revenant.example" };
          }
          const hash = await envelopeHash(changed);

          const result = await openLetter({
            envelope: changed,
            envelopeHash: hash,
            serverSecret,
            passkey: { prfOutput: await prfAtOpen(e) },
          });
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.error.kind).toBe("tampered");
          }
        },
      ),
      { numRuns: RUNS },
    );
  });
});
