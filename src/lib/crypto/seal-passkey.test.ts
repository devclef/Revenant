import { afterEach, describe, expect, it, vi } from "vitest";
import { sealLetter, SealError, type PasskeyFactor } from "./seal";
import { generateBackupKey } from "./backup-key";
import {
  assertPasskey,
  confirmPasskey,
  createPasskey,
} from "./passkey";
import { createFakeAuthenticator } from "./testing/fake-authenticator";
import type { PayloadV1 } from "../seal-format";
import { decodeBase64url, parseEnvelope } from "../seal-format";

// Feature: 06-lock-and-unlock, task 3: sealLetter with a passkey factor (R8.1
// to R8.8). WebCrypto only; the passkey comes from the fake authenticator, so
// no WebAuthn is needed.

const RP_ID = "revenant.devclef.se";
const SEALED_AT = "2026-10-31T12:00:00.000Z";
const OPENS_AT = "2027-02-01T00:00:00.000Z";

function fresh(length: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(length);
  globalThis.crypto.getRandomValues(out);
  return out;
}

function payload(text = "a quiet autumn"): PayloadV1 {
  return {
    format_version: 1,
    letter_text: text,
    metrics: [],
    figures: [],
    recall_questions: [],
  };
}

/** Enrol a fake passkey and run the PRF check, as the Seal page does. */
async function enrol(rpId = RP_ID) {
  const fake = createFakeAuthenticator();
  const created = await createPasskey(fake, { rpId });
  if (!created.ok) throw new Error("test setup: create failed");
  const confirmed = await confirmPasskey(fake, {
    rpId,
    credentialId: created.credentialId,
    prfSalt: created.prfSalt,
    createdPrf: created.createdPrf,
  });
  if (!confirmed.ok) throw new Error("test setup: confirm failed");
  return {
    fake,
    rpId,
    credentialId: created.credentialId,
    prfSalt: created.prfSalt,
    prfOutput: confirmed.prfOutput,
  };
}

/** A fresh `PasskeyFactor` from an enrolment. `sealLetter` zeroes the PRF copy. */
function factorFrom(e: Awaited<ReturnType<typeof enrol>>): PasskeyFactor {
  return {
    prfOutput: e.prfOutput.slice(),
    credentialId: e.credentialId,
    prfSalt: e.prfSalt,
    rpId: e.rpId,
  };
}

function baseInput(extra: Partial<Parameters<typeof sealLetter>[0]> = {}) {
  return {
    payload: payload(),
    letterId: fresh(16),
    serverSecret: fresh(32),
    sealedAt: SEALED_AT,
    opensAt: OPENS_AT,
    ...extra,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("sealLetter with a passkey factor: envelope shape (Property 7)", () => {
  it("passkey alone adds one passkey wrap and the three passkey header fields", async () => {
    const e = await enrol();
    const { envelope } = await sealLetter(
      baseInput({ passkey: factorFrom(e) }),
    );

    expect(envelope.wrappedDeks.map((w) => w.factor)).toEqual(["passkey"]);
    expect(envelope.rpId).toBe(RP_ID);
    expect(decodeBase64url(envelope.credentialId ?? "")).toEqual(e.credentialId);
    expect(decodeBase64url(envelope.prfSalt ?? "")).toEqual(e.prfSalt);
    expect(decodeBase64url(envelope.wrappedDeks[0].nonce)).toHaveLength(12);
    expect(decodeBase64url(envelope.wrappedDeks[0].wrappedKey)).toHaveLength(48);
  });

  it("both factors give wraps sorted backup first, then passkey", async () => {
    const e = await enrol();
    const { envelope } = await sealLetter(
      baseInput({ backupKey: generateBackupKey(), passkey: factorFrom(e) }),
    );

    expect(envelope.wrappedDeks.map((w) => w.factor)).toEqual([
      "backup",
      "passkey",
    ]);
    expect(envelope.rpId).toBe(RP_ID);
    expect(decodeBase64url(envelope.credentialId ?? "")).toEqual(e.credentialId);
    expect(decodeBase64url(envelope.prfSalt ?? "")).toEqual(e.prfSalt);
  });

  it("the envelope passes the frozen v1 header schema", async () => {
    const e = await enrol();
    const { envelope } = await sealLetter(
      baseInput({ backupKey: generateBackupKey(), passkey: factorFrom(e) }),
    );
    expect(parseEnvelope(JSON.parse(JSON.stringify(envelope))).ok).toBe(true);
  });

  it("backup only is unchanged: one backup wrap and no passkey fields", async () => {
    const { envelope } = await sealLetter(
      baseInput({ backupKey: generateBackupKey() }),
    );

    expect(Object.keys(envelope).sort()).toEqual([
      "formatVersion",
      "letterId",
      "opensAt",
      "payloadCiphertext",
      "payloadNonce",
      "sealedAt",
      "wrappedDeks",
    ]);
    expect(envelope.wrappedDeks).toHaveLength(1);
    expect(Object.keys(envelope.wrappedDeks[0]).sort()).toEqual([
      "factor",
      "nonce",
      "wrappedKey",
    ]);
    expect(envelope.wrappedDeks[0].factor).toBe("backup");
    expect(parseEnvelope(JSON.parse(JSON.stringify(envelope))).ok).toBe(true);
  });
});

describe("sealLetter input checks run before any derivation", () => {
  it("rejects a missing factor with invalid_input/backupKey", async () => {
    const deriveKeySpy = vi.spyOn(globalThis.crypto.subtle, "deriveKey");
    const deriveBitsSpy = vi.spyOn(globalThis.crypto.subtle, "deriveBits");
    const encryptSpy = vi.spyOn(globalThis.crypto.subtle, "encrypt");

    await expect(sealLetter(baseInput())).rejects.toMatchObject({
      error: { kind: "invalid_input", field: "backupKey" },
    });

    expect(deriveKeySpy).not.toHaveBeenCalled();
    expect(deriveBitsSpy).not.toHaveBeenCalled();
    expect(encryptSpy).not.toHaveBeenCalled();
  });

  const badFactors: Array<[string, (f: PasskeyFactor) => PasskeyFactor]> = [
    ["prfOutput of 31 bytes", (f) => ({ ...f, prfOutput: fresh(31) })],
    ["prfSalt of 31 bytes", (f) => ({ ...f, prfSalt: fresh(31) })],
    ["an empty credentialId", (f) => ({ ...f, credentialId: new Uint8Array(0) })],
    ["a credentialId of 1024 bytes", (f) => ({ ...f, credentialId: fresh(1024) })],
    ["an uppercase rpId", (f) => ({ ...f, rpId: "Revenant.example" })],
    ["an empty rpId", (f) => ({ ...f, rpId: "" })],
    ["an rpId with an underscore", (f) => ({ ...f, rpId: "bad_host.example" })],
  ];

  for (const [name, mutate] of badFactors) {
    it(`rejects ${name} with invalid_input/passkey and derives nothing`, async () => {
      const e = await enrol();
      const deriveKeySpy = vi.spyOn(globalThis.crypto.subtle, "deriveKey");
      const deriveBitsSpy = vi.spyOn(globalThis.crypto.subtle, "deriveBits");
      const encryptSpy = vi.spyOn(globalThis.crypto.subtle, "encrypt");

      await expect(
        sealLetter(baseInput({ passkey: mutate(factorFrom(e)) })),
      ).rejects.toMatchObject({
        error: { kind: "invalid_input", field: "passkey" },
      });

      expect(deriveKeySpy).not.toHaveBeenCalled();
      expect(deriveBitsSpy).not.toHaveBeenCalled();
      expect(encryptSpy).not.toHaveBeenCalled();
    });
  }

  it("the thrown passkey error names no value in its message", async () => {
    const e = await enrol();
    const err = await sealLetter(
      baseInput({ passkey: { ...factorFrom(e), rpId: "Bad.Host" } }),
    ).catch((x: unknown) => x);
    expect(err).toBeInstanceOf(SealError);
    expect((err as SealError).message).toBe("invalid_input");
  });
});

describe("sealLetter wrap check (R8.5)", () => {
  it("a decrypt that throws gives wrap_failed and no envelope", async () => {
    const e = await enrol();
    vi.spyOn(globalThis.crypto.subtle, "decrypt").mockRejectedValueOnce(
      new Error("boom"),
    );

    const err = await sealLetter(baseInput({ passkey: factorFrom(e) })).catch(
      (x: unknown) => x,
    );
    expect(err).toBeInstanceOf(SealError);
    expect((err as SealError).error).toEqual({ kind: "wrap_failed" });
    expect((err as SealError).message).toBe("wrap_failed");
  });

  it("a decrypt that returns different bytes gives wrap_failed", async () => {
    const e = await enrol();
    vi.spyOn(globalThis.crypto.subtle, "decrypt").mockResolvedValueOnce(
      fresh(32).buffer,
    );

    await expect(
      sealLetter(baseInput({ passkey: factorFrom(e) })),
    ).rejects.toMatchObject({ error: { kind: "wrap_failed" } });
  });

  it("SealError.wrapFailed() carries the wrap_failed detail", () => {
    const err = SealError.wrapFailed();
    expect(err).toBeInstanceOf(SealError);
    expect(err.error).toEqual({ kind: "wrap_failed" });
  });
});

describe("sealLetter zeroes the passkey PRF output", () => {
  it("zeroes prfOutput after a successful seal", async () => {
    const e = await enrol();
    const factor = factorFrom(e);
    await sealLetter(baseInput({ passkey: factor }));
    expect(factor.prfOutput.every((b) => b === 0)).toBe(true);
  });

  it("zeroes prfOutput after a failed input check", async () => {
    const e = await enrol();
    const factor = { ...factorFrom(e), rpId: "Bad.Host" };
    await expect(sealLetter(baseInput({ passkey: factor }))).rejects.toThrow();
    expect(factor.prfOutput.every((b) => b === 0)).toBe(true);
  });

  it("zeroes prfOutput after a failed wrap check", async () => {
    const e = await enrol();
    const factor = factorFrom(e);
    vi.spyOn(globalThis.crypto.subtle, "decrypt").mockRejectedValueOnce(
      new Error("boom"),
    );
    await expect(sealLetter(baseInput({ passkey: factor }))).rejects.toThrow();
    expect(factor.prfOutput.every((b) => b === 0)).toBe(true);
  });
});

describe("sealLetter with a passkey from the fake authenticator", () => {
  it("the PRF from assertPasskey matches the one used to seal", async () => {
    const e = await enrol();
    const asserted = await assertPasskey(e.fake, {
      rpId: e.rpId,
      credentialId: e.credentialId,
      prfSalt: e.prfSalt,
      pageHostname: RP_ID,
    });
    expect(asserted.ok).toBe(true);
    if (asserted.ok) {
      expect(asserted.prfOutput).toEqual(e.prfOutput);
    }
  });
});
