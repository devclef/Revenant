import { afterEach, describe, expect, it, vi } from "vitest";
import { sealLetter, type PasskeyFactor, type SealInput } from "./seal";
import { openLetter } from "./open";
import { generateBackupKey } from "./backup-key";
import { assertPasskey, confirmPasskey, createPasskey } from "./passkey";
import { createFakeAuthenticator } from "./testing/fake-authenticator";
import type { PayloadV1, EnvelopeV1 } from "../seal-format";
import {
  decodeBase64url,
  encodeBase64url,
  envelopeHash,
} from "../seal-format";

// Feature: 06-lock-and-unlock, task 3: openLetter with a passkey (R9). WebCrypto
// only; the passkey PRF comes from the fake authenticator.

const RP_ID = "revenant.devclef.se";
const SEALED_AT = "2026-10-31T12:00:00.000Z";
const OPENS_AT = "2027-02-01T00:00:00.000Z";

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

/** Enrol a fake passkey and return its PRF output for sealing. */
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

function factorFrom(e: Enrolment): PasskeyFactor {
  return {
    prfOutput: e.prfOutput.slice(),
    credentialId: e.credentialId,
    prfSalt: e.prfSalt,
    rpId: RP_ID,
  };
}

/** The PRF output the page would get from `get` at open time. */
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

async function sealWith(
  extra: Partial<SealInput>,
  text = "a quiet autumn",
  serverSecret = fresh(32),
  letterId = fresh(16),
) {
  const sealed = await sealLetter({
    payload: payload(text),
    letterId,
    serverSecret,
    sealedAt: SEALED_AT,
    opensAt: OPENS_AT,
    ...extra,
  });
  return { ...sealed, serverSecret };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("openLetter with a passkey", () => {
  it("opens a passkey-only letter with the PRF output and returns the payload", async () => {
    const e = await enrol();
    const { envelope, envelopeHash: hash, serverSecret } = await sealWith({
      passkey: factorFrom(e),
    });

    const result = await openLetter({
      envelope,
      envelopeHash: hash,
      serverSecret,
      passkey: { prfOutput: await prfAtOpen(e) },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.letter_text).toBe("a quiet autumn");
      expect(result.openingKey).toBeDefined();
    }
  });

  it("opens a both-factor letter with the passkey alone", async () => {
    const e = await enrol();
    const { envelope, envelopeHash: hash, serverSecret } = await sealWith({
      backupKey: generateBackupKey(),
      passkey: factorFrom(e),
    });

    const result = await openLetter({
      envelope,
      envelopeHash: hash,
      serverSecret,
      passkey: { prfOutput: await prfAtOpen(e) },
    });
    expect(result.ok).toBe(true);
  });

  it("opens a both-factor letter with the backup key alone (backup output unchanged)", async () => {
    const e = await enrol();
    const backupKey = generateBackupKey();
    const { envelope, envelopeHash: hash, serverSecret } = await sealWith({
      backupKey,
      passkey: factorFrom(e),
    });

    const result = await openLetter({
      envelope,
      envelopeHash: hash,
      serverSecret,
      backupKey,
    });
    expect(result.ok).toBe(true);
  });

  it("a passkey-only letter opened with only a backup key gives wrong_key", async () => {
    const e = await enrol();
    const { envelope, envelopeHash: hash, serverSecret } = await sealWith({
      passkey: factorFrom(e),
    });

    const result = await openLetter({
      envelope,
      envelopeHash: hash,
      serverSecret,
      backupKey: generateBackupKey(),
    });
    expect(result).toMatchObject({ ok: false, error: { kind: "wrong_key" } });
  });

  it("a backup-only letter opened with a passkey gives wrong_key", async () => {
    const e = await enrol();
    const { envelope, envelopeHash: hash, serverSecret } = await sealWith({
      backupKey: generateBackupKey(),
    });

    const result = await openLetter({
      envelope,
      envelopeHash: hash,
      serverSecret,
      passkey: { prfOutput: await prfAtOpen(e) },
    });
    expect(result).toMatchObject({ ok: false, error: { kind: "wrong_key" } });
  });

  it("a wrong PRF output gives wrong_key and no payload", async () => {
    const e = await enrol();
    const { envelope, envelopeHash: hash, serverSecret } = await sealWith({
      passkey: factorFrom(e),
    });
    const wrong = await prfAtOpen(e);
    wrong[0] ^= 0x01;

    const result = await openLetter({
      envelope,
      envelopeHash: hash,
      serverSecret,
      passkey: { prfOutput: wrong },
    });
    expect(result.ok).toBe(false);
    expect(result).toMatchObject({ error: { kind: "wrong_key" } });
    expect("payload" in result).toBe(false);
  });

  it("a wrong server secret gives wrong_key for a passkey letter", async () => {
    const e = await enrol();
    const { envelope, envelopeHash: hash } = await sealWith({
      passkey: factorFrom(e),
    });

    const result = await openLetter({
      envelope,
      envelopeHash: hash,
      serverSecret: fresh(32),
      passkey: { prfOutput: await prfAtOpen(e) },
    });
    expect(result).toMatchObject({ ok: false, error: { kind: "wrong_key" } });
  });

  it("a tampered ciphertext with a recomputed hash gives tampered", async () => {
    const e = await enrol();
    const { envelope, serverSecret } = await sealWith({ passkey: factorFrom(e) });

    const bytes = decodeBase64url(envelope.payloadCiphertext);
    bytes[0] ^= 0x01;
    const changed: EnvelopeV1 = {
      ...envelope,
      payloadCiphertext: encodeBase64url(bytes),
    };
    const hash = await envelopeHash(changed);

    const result = await openLetter({
      envelope: changed,
      envelopeHash: hash,
      serverSecret,
      passkey: { prfOutput: await prfAtOpen(e) },
    });
    expect(result).toMatchObject({ ok: false, error: { kind: "tampered" } });
  });

  it("a stored hash that does not match gives verification_failed and runs no decrypt", async () => {
    const e = await enrol();
    const { envelope, serverSecret } = await sealWith({ passkey: factorFrom(e) });
    const decryptSpy = vi.spyOn(globalThis.crypto.subtle, "decrypt");
    const deriveKeySpy = vi.spyOn(globalThis.crypto.subtle, "deriveKey");

    const result = await openLetter({
      envelope,
      envelopeHash: "0".repeat(64),
      serverSecret,
      passkey: { prfOutput: await prfAtOpen(e) },
    });
    expect(result).toMatchObject({
      ok: false,
      error: { kind: "verification_failed" },
    });
    expect(decryptSpy).not.toHaveBeenCalled();
    expect(deriveKeySpy).not.toHaveBeenCalled();
  });
});

describe("openLetter input checks run before any derivation", () => {
  it("rejects a missing factor with invalid_input/backupKey", async () => {
    const e = await enrol();
    const { envelope, envelopeHash: hash, serverSecret } = await sealWith({
      passkey: factorFrom(e),
    });
    const deriveKeySpy = vi.spyOn(globalThis.crypto.subtle, "deriveKey");
    const decryptSpy = vi.spyOn(globalThis.crypto.subtle, "decrypt");

    const result = await openLetter({ envelope, envelopeHash: hash, serverSecret });
    expect(result).toEqual({
      ok: false,
      error: { kind: "invalid_input", field: "backupKey" },
    });
    expect(deriveKeySpy).not.toHaveBeenCalled();
    expect(decryptSpy).not.toHaveBeenCalled();
  });

  it("rejects a PRF output of 31 bytes with invalid_input/passkey and derives nothing", async () => {
    const e = await enrol();
    const { envelope, envelopeHash: hash, serverSecret } = await sealWith({
      passkey: factorFrom(e),
    });
    const deriveKeySpy = vi.spyOn(globalThis.crypto.subtle, "deriveKey");
    const decryptSpy = vi.spyOn(globalThis.crypto.subtle, "decrypt");

    const result = await openLetter({
      envelope,
      envelopeHash: hash,
      serverSecret,
      passkey: { prfOutput: fresh(31) },
    });
    expect(result).toEqual({
      ok: false,
      error: { kind: "invalid_input", field: "passkey" },
    });
    expect(deriveKeySpy).not.toHaveBeenCalled();
    expect(decryptSpy).not.toHaveBeenCalled();
  });
});

describe("openLetter zeroes the PRF output", () => {
  it("zeroes passkey.prfOutput after a successful open", async () => {
    const e = await enrol();
    const { envelope, envelopeHash: hash, serverSecret } = await sealWith({
      passkey: factorFrom(e),
    });
    const prf = await prfAtOpen(e);

    const result = await openLetter({
      envelope,
      envelopeHash: hash,
      serverSecret,
      passkey: { prfOutput: prf },
    });
    expect(result.ok).toBe(true);
    expect(prf.every((b) => b === 0)).toBe(true);
  });

  it("zeroes passkey.prfOutput after a failed open", async () => {
    const e = await enrol();
    const { envelope, envelopeHash: hash, serverSecret } = await sealWith({
      passkey: factorFrom(e),
    });
    const wrong = fresh(32);

    const result = await openLetter({
      envelope,
      envelopeHash: hash,
      serverSecret,
      passkey: { prfOutput: wrong },
    });
    expect(result.ok).toBe(false);
    expect(wrong.every((b) => b === 0)).toBe(true);
  });
});
