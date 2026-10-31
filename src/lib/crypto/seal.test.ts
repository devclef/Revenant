import { afterEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import { sealLetter, SealError } from "./seal";
import { openLetter } from "./open";
import { generateBackupKey } from "./backup-key";
import type { BackupKeyBytes } from "./errors";
import type { PayloadV1 } from "../seal-format";

// Feature: 02-sealed-letters — seal-side properties (P9, P10, P20) and the
// input precondition checks that run before any key derivation.
//
// These tests use WebCrypto (globalThis.crypto) only, in the node test
// environment, exactly as the browser would. No third-party crypto.

// --- Fixed-length random helpers --------------------------------------------

/** A fresh 16-byte letter ID. */
function freshLetterId(): Uint8Array {
  const id = new Uint8Array(16);
  globalThis.crypto.getRandomValues(id);
  return id;
}

/** A fresh 32-byte server secret. */
function freshServerSecret(): Uint8Array {
  const s = new Uint8Array(32);
  globalThis.crypto.getRandomValues(s);
  return s;
}

// --- A minimal valid v1 payload, parameterised by letter text ---------------

/**
 * Build a valid v1 payload with the given letter text and empty figure/metric/
 * question lists. Empty lists are allowed by the schema (arrays are `.max(...)`,
 * not `.min(1)`), which is exactly what P9's "empty figure lists" case needs.
 */
function payloadWithText(letterText: string): PayloadV1 {
  return {
    format_version: 1,
    letter_text: letterText,
    metrics: [],
    figures: [],
    recall_questions: [],
  };
}

/** A payload that also sets `written_as_of`. */
function payloadWithWrittenAsOf(
  letterText: string,
  writtenAsOf: string,
): PayloadV1 {
  return {
    format_version: 1,
    letter_text: letterText,
    written_as_of: writtenAsOf,
    metrics: [],
    figures: [],
    recall_questions: [],
  };
}

const SEALED_AT = "2026-10-31T12:00:00.000Z";
const OPENS_AT = "2027-02-01T00:00:00.000Z";

afterEach(() => {
  vi.restoreAllMocks();
});

// --- Property 9: seal -> open round trip ------------------------------------

// Feature: 02-sealed-letters, Property 9
describe("Property 9: seal -> open round trip", () => {
  it("round-trips a payload with empty figure lists for arbitrary letter text", async () => {
    await fc.assert(
      fc.asyncProperty(
        // 1..200 code points of arbitrary text (kept short so runs are fast);
        // the schema itself is exercised at its bounds by the explicit cases.
        fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
        async (letterText) => {
          const letterId = freshLetterId();
          const serverSecret = freshServerSecret();
          const backupKey = generateBackupKey();

          const { envelope, envelopeHash } = await sealLetter({
            payload: payloadWithText(letterText),
            letterId,
            serverSecret,
            backupKey,
            sealedAt: SEALED_AT,
            opensAt: OPENS_AT,
          });

          const result = await openLetter({
            envelope,
            envelopeHash,
            serverSecret,
            backupKey,
          });
          expect(result.ok).toBe(true);
          if (result.ok) {
            expect(result.payload.letter_text).toBe(letterText);
            expect(result.payload.figures).toEqual([]);
            expect(result.payload.metrics).toEqual([]);
            expect(result.payload.recall_questions).toEqual([]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("round-trips letter text of exactly 1 and exactly 5000 code points", async () => {
    // Use an astral code point so the boundary is on code points, not UTF-16
    // code units (5000 astral points = 10000 UTF-16 units).
    const one = "😀";
    const fiveThousand = "😀".repeat(5000);
    expect([...one].length).toBe(1);
    expect([...fiveThousand].length).toBe(5000);

    for (const letterText of [one, fiveThousand]) {
      const letterId = freshLetterId();
      const serverSecret = freshServerSecret();
      const backupKey = generateBackupKey();

      const { envelope, envelopeHash } = await sealLetter({
        payload: payloadWithText(letterText),
        letterId,
        serverSecret,
        backupKey,
        sealedAt: SEALED_AT,
        opensAt: OPENS_AT,
      });
      const result = await openLetter({
        envelope,
        envelopeHash,
        serverSecret,
        backupKey,
      });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.payload.letter_text).toBe(letterText);
      }
    }
  });
});

// --- Property 10: fresh nonces ----------------------------------------------

// Feature: 02-sealed-letters, Property 10
describe("Property 10: every seal uses fresh nonces and differs", () => {
  it("two identical seals differ in payloadNonce, wrap nonce and ciphertext", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
        async (letterText) => {
          // Same inputs for both seals: only the random DEK and nonces differ.
          const letterId = freshLetterId();
          const serverSecret = freshServerSecret();
          const backupKey = generateBackupKey();
          const payload = payloadWithText(letterText);

          const a = await sealLetter({
            payload,
            letterId,
            serverSecret,
            backupKey,
            sealedAt: SEALED_AT,
            opensAt: OPENS_AT,
          });
          const b = await sealLetter({
            payload,
            letterId,
            serverSecret,
            backupKey,
            sealedAt: SEALED_AT,
            opensAt: OPENS_AT,
          });

          // Same header fields that are NOT random must match.
          expect(a.envelope.letterId).toBe(b.envelope.letterId);
          expect(a.envelope.sealedAt).toBe(b.envelope.sealedAt);

          // The random pieces must all differ.
          expect(a.envelope.payloadNonce).not.toBe(b.envelope.payloadNonce);
          expect(a.envelope.wrappedDeks[0].nonce).not.toBe(
            b.envelope.wrappedDeks[0].nonce,
          );
          expect(a.envelope.wrappedDeks[0].wrappedKey).not.toBe(
            b.envelope.wrappedDeks[0].wrappedKey,
          );
          expect(a.envelope.payloadCiphertext).not.toBe(
            b.envelope.payloadCiphertext,
          );
          expect(a.envelopeHash).not.toBe(b.envelopeHash);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- Property 20: written_as_of later than the seal date --------------------

// Feature: 02-sealed-letters, Property 20
describe("Property 20: written_as_of later than sealedAt is rejected", () => {
  it("rejects with invalid_input/written_as_of and derives nothing", async () => {
    await fc.assert(
      fc.asyncProperty(
        // A seal date and a written_as_of strictly after its calendar day.
        fc.date({
          min: new Date("2000-01-02T00:00:00.000Z"),
          max: new Date("2099-12-30T23:59:59.999Z"),
          noInvalidDate: true,
        }),
        fc.integer({ min: 1, max: 3650 }),
        async (sealDate, daysAfter) => {
          const sealedAt = sealDate.toISOString();
          const sealDay = sealedAt.slice(0, 10);
          const laterMs = Date.parse(`${sealDay}T00:00:00.000Z`) + daysAfter * 86_400_000;
          const writtenAsOf = new Date(laterMs).toISOString().slice(0, 10);
          // Guard: the chosen date really is after the seal day.
          expect(writtenAsOf > sealDay).toBe(true);

          const deriveKeySpy = vi.spyOn(globalThis.crypto.subtle, "deriveKey");
          const deriveBitsSpy = vi.spyOn(globalThis.crypto.subtle, "deriveBits");
          const encryptSpy = vi.spyOn(globalThis.crypto.subtle, "encrypt");

          await expect(
            sealLetter({
              payload: payloadWithWrittenAsOf("remembered later", writtenAsOf),
              letterId: freshLetterId(),
              serverSecret: freshServerSecret(),
              backupKey: generateBackupKey(),
              sealedAt,
              opensAt: OPENS_AT,
            }),
          ).rejects.toMatchObject({
            error: { kind: "invalid_input", field: "written_as_of" },
          });

          expect(deriveKeySpy).not.toHaveBeenCalled();
          expect(deriveBitsSpy).not.toHaveBeenCalled();
          expect(encryptSpy).not.toHaveBeenCalled();
          vi.restoreAllMocks();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("accepts written_as_of equal to the seal day (boundary)", async () => {
    const sealedAt = "2026-10-31T23:59:59.999Z";
    const writtenAsOf = "2026-10-31"; // same UTC day
    const letterId = freshLetterId();
    const serverSecret = freshServerSecret();
    const backupKey = generateBackupKey();

    const { envelope, envelopeHash } = await sealLetter({
      payload: payloadWithWrittenAsOf("same day", writtenAsOf),
      letterId,
      serverSecret,
      backupKey,
      sealedAt,
      opensAt: OPENS_AT,
    });
    const result = await openLetter({ envelope, envelopeHash, serverSecret, backupKey });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.written_as_of).toBe(writtenAsOf);
    }
  });

  it("accepts written_as_of one day before the seal day (boundary)", async () => {
    const sealedAt = "2026-10-31T00:00:00.000Z";
    const writtenAsOf = "2026-10-30";
    const letterId = freshLetterId();
    const serverSecret = freshServerSecret();
    const backupKey = generateBackupKey();

    const { envelope, envelopeHash } = await sealLetter({
      payload: payloadWithWrittenAsOf("day before", writtenAsOf),
      letterId,
      serverSecret,
      backupKey,
      sealedAt,
      opensAt: OPENS_AT,
    });
    const result = await openLetter({ envelope, envelopeHash, serverSecret, backupKey });
    expect(result.ok).toBe(true);
  });
});

// --- seal input length checks (R3.3) ----------------------------------------

describe("sealLetter input checks run before any derivation", () => {
  it("rejects a wrong-length letter ID with invalid_input/letterId", async () => {
    const deriveKeySpy = vi.spyOn(globalThis.crypto.subtle, "deriveKey");
    const deriveBitsSpy = vi.spyOn(globalThis.crypto.subtle, "deriveBits");
    const encryptSpy = vi.spyOn(globalThis.crypto.subtle, "encrypt");

    await expect(
      sealLetter({
        payload: payloadWithText("x"),
        letterId: new Uint8Array(15),
        serverSecret: freshServerSecret(),
        backupKey: generateBackupKey(),
        sealedAt: SEALED_AT,
        opensAt: OPENS_AT,
      }),
    ).rejects.toMatchObject({ error: { kind: "invalid_input", field: "letterId" } });

    expect(deriveKeySpy).not.toHaveBeenCalled();
    expect(deriveBitsSpy).not.toHaveBeenCalled();
    expect(encryptSpy).not.toHaveBeenCalled();
  });

  it("rejects a wrong-length server secret with invalid_input/serverSecret", async () => {
    const deriveKeySpy = vi.spyOn(globalThis.crypto.subtle, "deriveKey");
    const encryptSpy = vi.spyOn(globalThis.crypto.subtle, "encrypt");

    await expect(
      sealLetter({
        payload: payloadWithText("x"),
        letterId: freshLetterId(),
        serverSecret: new Uint8Array(31),
        backupKey: generateBackupKey(),
        sealedAt: SEALED_AT,
        opensAt: OPENS_AT,
      }),
    ).rejects.toMatchObject({ error: { kind: "invalid_input", field: "serverSecret" } });

    expect(deriveKeySpy).not.toHaveBeenCalled();
    expect(encryptSpy).not.toHaveBeenCalled();
  });

  it("rejects an invalid payload with invalid_input/envelope before derivation", async () => {
    const deriveKeySpy = vi.spyOn(globalThis.crypto.subtle, "deriveKey");
    const encryptSpy = vi.spyOn(globalThis.crypto.subtle, "encrypt");

    await expect(
      sealLetter({
        payload: { format_version: 1, letter_text: "" }, // too short, missing fields
        letterId: freshLetterId(),
        serverSecret: freshServerSecret(),
        backupKey: generateBackupKey(),
        sealedAt: SEALED_AT,
        opensAt: OPENS_AT,
      }),
    ).rejects.toMatchObject({ error: { kind: "invalid_input", field: "envelope" } });

    expect(deriveKeySpy).not.toHaveBeenCalled();
    expect(encryptSpy).not.toHaveBeenCalled();
  });

  it("the thrown SealError names no value in its message", async () => {
    try {
      await sealLetter({
        payload: payloadWithText("x"),
        letterId: new Uint8Array(15),
        serverSecret: freshServerSecret(),
        backupKey: generateBackupKey() as BackupKeyBytes,
        sealedAt: SEALED_AT,
        opensAt: OPENS_AT,
      });
      expect.unreachable("sealLetter should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(SealError);
      expect((e as SealError).message).toBe("invalid_input");
    }
  });
});
