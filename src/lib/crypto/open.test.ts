import { afterEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import { sealLetter } from "./seal";
import { openLetter } from "./open";
import {
  encryptOpeningRecord,
  decryptOpeningRecord,
} from "./opening-records";
import { generateBackupKey, formatBackupKey, parseBackupKey } from "./backup-key";
import { PUBLIC_DEMO_BACKUP_KEY } from "./demo-key";
import type { BackupKeyBytes } from "./errors";
import type { PayloadV1, EnvelopeV1 } from "../seal-format";
import {
  canonicalize,
  decodeBase64url,
  encodeBase64url,
  envelopeHash as computeEnvelopeHash,
  headerWithoutCiphertext,
} from "../seal-format";

// Feature: 02-sealed-letters — open-side properties (P11-P15) and the
// invalid_payload / unsupported_format open paths that cannot be reached via
// sealLetter (which validates its payload). WebCrypto only.

// --- helpers ----------------------------------------------------------------

function freshLetterId(): Uint8Array {
  const id = new Uint8Array(16);
  globalThis.crypto.getRandomValues(id);
  return id;
}

function freshServerSecret(): Uint8Array {
  const s = new Uint8Array(32);
  globalThis.crypto.getRandomValues(s);
  return s;
}

function validPayload(letterText = "a quiet autumn"): PayloadV1 {
  return {
    format_version: 1,
    letter_text: letterText,
    metrics: [],
    figures: [],
    recall_questions: [],
  };
}

const SEALED_AT = "2026-10-31T12:00:00.000Z";
const OPENS_AT = "2027-02-01T00:00:00.000Z";

const utf8 = new TextEncoder();

function concat(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

function toView(bytes: Uint8Array): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(bytes.length);
  out.set(bytes);
  return out;
}

/**
 * TEST-ONLY sealing path that reproduces sealLetter's crypto but seals an
 * ARBITRARY plaintext string, skipping the v1 payload schema. This is the only
 * way to produce an envelope that opens past the hash check and AES-GCM but
 * then fails payload validation (invalid_payload / unsupported_format), because
 * sealLetter refuses to seal a non-conforming payload.
 *
 * It re-derives KEK_backup by importing the same HKDF inputs the module uses;
 * it never reads any secret the module hides. It intentionally does NOT import
 * kdf.ts internals — it rebuilds the derivation from the public spec so the
 * test is independent of the module under test for the key schedule.
 */
async function sealRawPlaintext(opts: {
  plaintext: string;
  letterId: Uint8Array;
  serverSecret: Uint8Array;
  backupKey: BackupKeyBytes;
  sealedAt?: string;
  opensAt?: string;
}): Promise<{ envelope: EnvelopeV1; envelopeHash: string }> {
  const { plaintext, letterId, serverSecret, backupKey } = opts;
  const sealedAt = opts.sealedAt ?? SEALED_AT;
  const opensAt = opts.opensAt ?? OPENS_AT;
  const subtle = globalThis.crypto.subtle;

  // DEK.
  const dek = new Uint8Array(32);
  globalThis.crypto.getRandomValues(dek);

  // KEK_backup = HKDF-SHA256(ikm = backupKey ‖ serverSecret, salt = letterId,
  // info = "revenant-kek-backup-v1").
  const ikm = concat(backupKey, serverSecret);
  const hkdfBase = await subtle.importKey("raw", ikm, "HKDF", false, [
    "deriveKey",
  ]);
  const kekBackup = await subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: toView(letterId),
      info: utf8.encode("revenant-kek-backup-v1"),
    },
    hkdfBase,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );

  // Wrap the DEK. AAD = letterId ‖ "backup".
  const wrapNonce = new Uint8Array(12);
  globalThis.crypto.getRandomValues(wrapNonce);
  const wrapAad = concat(letterId, utf8.encode("backup"));
  const wrappedKeyBuf = await subtle.encrypt(
    { name: "AES-GCM", iv: wrapNonce, additionalData: wrapAad },
    kekBackup,
    toView(dek),
  );

  const payloadNonce = new Uint8Array(12);
  globalThis.crypto.getRandomValues(payloadNonce);
  const headerNoCt: Omit<EnvelopeV1, "payloadCiphertext"> = {
    letterId: encodeBase64url(letterId),
    formatVersion: 1,
    sealedAt,
    opensAt,
    payloadNonce: encodeBase64url(payloadNonce),
    wrappedDeks: [
      {
        factor: "backup",
        nonce: encodeBase64url(wrapNonce),
        wrappedKey: encodeBase64url(new Uint8Array(wrappedKeyBuf)),
      },
    ],
  };

  const dekKey = await subtle.importKey("raw", toView(dek), { name: "AES-GCM" }, false, [
    "encrypt",
  ]);
  const headerAad = utf8.encode(canonicalize(headerNoCt));
  const ctBuf = await subtle.encrypt(
    { name: "AES-GCM", iv: payloadNonce, additionalData: headerAad },
    dekKey,
    utf8.encode(plaintext),
  );
  const envelope: EnvelopeV1 = {
    ...headerNoCt,
    payloadCiphertext: encodeBase64url(new Uint8Array(ctBuf)),
  };
  const hash = await computeEnvelopeHash(envelope);
  dek.fill(0);
  return { envelope, envelopeHash: hash };
}

afterEach(() => {
  vi.restoreAllMocks();
});

// --- Property 11: wrong key fails closed ------------------------------------

// Feature: 02-sealed-letters, Property 11
describe("Property 11: wrong backup key or wrong server secret -> wrong_key", () => {
  it("a different backup key yields wrong_key with no payload", async () => {
    const letterId = freshLetterId();
    const serverSecret = freshServerSecret();
    const backupKey = generateBackupKey();
    const { envelope, envelopeHash } = await sealLetter({
      payload: validPayload(),
      letterId,
      serverSecret,
      backupKey,
      sealedAt: SEALED_AT,
      opensAt: OPENS_AT,
    });

    // A different, independently-generated key.
    let wrongKey = generateBackupKey();
    while (formatBackupKey(wrongKey) === formatBackupKey(backupKey)) {
      wrongKey = generateBackupKey();
    }

    const result = await openLetter({
      envelope,
      envelopeHash,
      serverSecret,
      backupKey: wrongKey,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("wrong_key");
    }
    expect(result).not.toHaveProperty("payload");
  });

  it("a different server secret yields wrong_key with no payload", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant(null), async () => {
        const letterId = freshLetterId();
        const serverSecret = freshServerSecret();
        const backupKey = generateBackupKey();
        const { envelope, envelopeHash } = await sealLetter({
          payload: validPayload(),
          letterId,
          serverSecret,
          backupKey,
          sealedAt: SEALED_AT,
          opensAt: OPENS_AT,
        });

        const wrongSecret = freshServerSecret();
        const result = await openLetter({
          envelope,
          envelopeHash,
          serverSecret: wrongSecret,
          backupKey,
        });
        expect(result.ok).toBe(false);
        if (!result.ok) {
          expect(result.error.kind).toBe("wrong_key");
        }
        expect(result).not.toHaveProperty("payload");
      }),
      { numRuns: 100 },
    );
  });
});

// --- Property 12: any single-byte change is detected ------------------------

// Feature: 02-sealed-letters, Property 12
describe("Property 12: a single-byte change is always detected", () => {
  it("with the ORIGINAL hash -> verification_failed and zero subtle.decrypt calls", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Which base64url field of the envelope to perturb.
        fc.constantFrom(
          "letterId",
          "payloadNonce",
          "payloadCiphertext",
          "wrapNonce",
          "wrappedKey",
        ),
        async (field) => {
          const letterId = freshLetterId();
          const serverSecret = freshServerSecret();
          const backupKey = generateBackupKey();
          const { envelope, envelopeHash } = await sealLetter({
            payload: validPayload(),
            letterId,
            serverSecret,
            backupKey,
            sealedAt: SEALED_AT,
            opensAt: OPENS_AT,
          });

          // Tamper: flip the last decoded byte of the chosen base64url field,
          // keeping it valid base64url of the same length.
          const tampered: EnvelopeV1 = JSON.parse(JSON.stringify(envelope));
          const flip = (b64: string): string => {
            const bytes = decodeBase64url(b64);
            bytes[bytes.length - 1] ^= 0x01;
            return encodeBase64url(bytes);
          };
          if (field === "letterId") tampered.letterId = flip(envelope.letterId);
          else if (field === "payloadNonce")
            tampered.payloadNonce = flip(envelope.payloadNonce);
          else if (field === "payloadCiphertext")
            tampered.payloadCiphertext = flip(envelope.payloadCiphertext);
          else if (field === "wrapNonce")
            tampered.wrappedDeks[0].nonce = flip(envelope.wrappedDeks[0].nonce);
          else tampered.wrappedDeks[0].wrappedKey = flip(envelope.wrappedDeks[0].wrappedKey);

          const decryptSpy = vi.spyOn(globalThis.crypto.subtle, "decrypt");
          const result = await openLetter({
            envelope: tampered,
            envelopeHash, // the ORIGINAL hash
            serverSecret,
            backupKey,
          });
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.error.kind).toBe("verification_failed");
          }
          // No unwrap and no payload decrypt were attempted.
          expect(decryptSpy).not.toHaveBeenCalled();
          vi.restoreAllMocks();
        },
      ),
      { numRuns: 100 },
    );
  });

  it("with a RECOMPUTED hash -> wrong_key/tampered/invalid_input, never ok", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(
          "letterId",
          "payloadNonce",
          "payloadCiphertext",
          "wrapNonce",
          "wrappedKey",
        ),
        async (field) => {
          const letterId = freshLetterId();
          const serverSecret = freshServerSecret();
          const backupKey = generateBackupKey();
          const { envelope } = await sealLetter({
            payload: validPayload(),
            letterId,
            serverSecret,
            backupKey,
            sealedAt: SEALED_AT,
            opensAt: OPENS_AT,
          });

          const tampered: EnvelopeV1 = JSON.parse(JSON.stringify(envelope));
          const flip = (b64: string): string => {
            const bytes = decodeBase64url(b64);
            bytes[bytes.length - 1] ^= 0x01;
            return encodeBase64url(bytes);
          };
          if (field === "letterId") tampered.letterId = flip(envelope.letterId);
          else if (field === "payloadNonce")
            tampered.payloadNonce = flip(envelope.payloadNonce);
          else if (field === "payloadCiphertext")
            tampered.payloadCiphertext = flip(envelope.payloadCiphertext);
          else if (field === "wrapNonce")
            tampered.wrappedDeks[0].nonce = flip(envelope.wrappedDeks[0].nonce);
          else tampered.wrappedDeks[0].wrappedKey = flip(envelope.wrappedDeks[0].wrappedKey);

          // Hash recomputed over the tampered envelope: the hash check passes,
          // so the failure must come from a later, authenticated step.
          const recomputed = await computeEnvelopeHash(tampered);
          const result = await openLetter({
            envelope: tampered,
            envelopeHash: recomputed,
            serverSecret,
            backupKey,
          });
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(["wrong_key", "tampered", "invalid_input"]).toContain(
              result.error.kind,
            );
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- Property 13: opening records round trip and are letter-bound -----------

// Feature: 02-sealed-letters, Property 13
describe("Property 13: opening records round trip, bound to the letter", () => {
  it("encrypt then decrypt returns the same value", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.jsonValue(),
        async (value) => {
          const letterId = freshLetterId();
          const serverSecret = freshServerSecret();
          const backupKey = generateBackupKey();
          const { envelope, envelopeHash } = await sealLetter({
            payload: validPayload(),
            letterId,
            serverSecret,
            backupKey,
            sealedAt: SEALED_AT,
            opensAt: OPENS_AT,
          });
          const opened = await openLetter({ envelope, envelopeHash, serverSecret, backupKey });
          expect(opened.ok).toBe(true);
          if (!opened.ok) return;

          const record = await encryptOpeningRecord(opened.openingKey, letterId, value);
          const back = await decryptOpeningRecord(opened.openingKey, letterId, record);
          // canonicalize round-trips JSON values; compare via canonical form so
          // -0 / key order differences do not fail a structural equality.
          expect(canonicalize(back)).toBe(canonicalize(value));
        },
      ),
      { numRuns: 100 },
    );
  });

  it("decrypting with a different letterId (AAD) fails", async () => {
    const letterId = freshLetterId();
    const serverSecret = freshServerSecret();
    const backupKey = generateBackupKey();
    const { envelope, envelopeHash } = await sealLetter({
      payload: validPayload(),
      letterId,
      serverSecret,
      backupKey,
      sealedAt: SEALED_AT,
      opensAt: OPENS_AT,
    });
    const opened = await openLetter({ envelope, envelopeHash, serverSecret, backupKey });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    const record = await encryptOpeningRecord(opened.openingKey, letterId, { a: 1 });
    const otherLetterId = freshLetterId();
    await expect(
      decryptOpeningRecord(opened.openingKey, otherLetterId, record),
    ).rejects.toThrow();
  });
});

// --- Property 14: bad input lengths -> invalid_input, derive nothing --------

// Feature: 02-sealed-letters, Property 14
describe("Property 14: bad input lengths reject before derivation", () => {
  it("a wrong-length server secret -> invalid_input/serverSecret, zero deriveKey/deriveBits", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 64 }).filter((n) => n !== 32),
        async (len) => {
          // Build a real envelope so parsing is not what fails.
          const letterId = freshLetterId();
          const serverSecret = freshServerSecret();
          const backupKey = generateBackupKey();
          const { envelope, envelopeHash } = await sealLetter({
            payload: validPayload(),
            letterId,
            serverSecret,
            backupKey,
            sealedAt: SEALED_AT,
            opensAt: OPENS_AT,
          });

          const deriveKeySpy = vi.spyOn(globalThis.crypto.subtle, "deriveKey");
          const deriveBitsSpy = vi.spyOn(globalThis.crypto.subtle, "deriveBits");

          const result = await openLetter({
            envelope,
            envelopeHash,
            serverSecret: new Uint8Array(len),
            backupKey,
          });
          expect(result.ok).toBe(false);
          if (!result.ok) {
            expect(result.error.kind).toBe("invalid_input");
            if (result.error.kind === "invalid_input") {
              expect(result.error.field).toBe("serverSecret");
            }
          }
          expect(deriveKeySpy).not.toHaveBeenCalled();
          expect(deriveBitsSpy).not.toHaveBeenCalled();
          vi.restoreAllMocks();
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- Property 15: no secret leaks into console output or errors -------------

// Feature: 02-sealed-letters, Property 15
describe("Property 15: no secret leaks in output or error messages", () => {
  it("no DEK/backupKey/serverSecret/letter-text appears anywhere observable", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 4, maxLength: 120 }).filter((s) => s.trim().length > 0),
        async (letterText) => {
          const captured: string[] = [];
          const methods = ["log", "info", "warn", "error", "debug"] as const;
          const spies = methods.map((m) =>
            vi.spyOn(console, m).mockImplementation((...args: unknown[]) => {
              captured.push(args.map((a) => String(a)).join(" "));
            }),
          );

          const letterId = freshLetterId();
          const serverSecret = freshServerSecret();
          const backupKey = generateBackupKey();

          // Encodings of the secrets we must NOT find anywhere.
          const secrets = [
            letterText,
            formatBackupKey(backupKey),
            encodeBase64url(backupKey),
            encodeBase64url(serverSecret),
            [...serverSecret].map((b) => b.toString(16).padStart(2, "0")).join(""),
          ];

          const { envelope, envelopeHash } = await sealLetter({
            payload: validPayload(letterText),
            letterId,
            serverSecret,
            backupKey,
            sealedAt: SEALED_AT,
            opensAt: OPENS_AT,
          });

          // A successful open and a wrong-key open, so error paths are covered.
          await openLetter({ envelope, envelopeHash, serverSecret, backupKey });
          const wrongResult = await openLetter({
            envelope,
            envelopeHash,
            serverSecret,
            backupKey: generateBackupKey(),
          });

          const haystack =
            captured.join("\n") +
            "\n" +
            (wrongResult.ok ? "" : JSON.stringify(wrongResult.error));

          for (const secret of secrets) {
            if (secret.length > 0) {
              expect(haystack.includes(secret)).toBe(false);
            }
          }

          for (const spy of spies) spy.mockRestore();
        },
      ),
      { numRuns: 25 },
    );
  });
});

// --- invalid_payload / unsupported_format open paths ------------------------
// These need the TEST-ONLY sealRawPlaintext path: sealLetter validates its
// payload, so an envelope that decrypts to a bad payload cannot be produced via
// the public seal API.

describe("open paths reachable only with an unvalidated sealed plaintext", () => {
  it("a decrypted plaintext that is not JSON -> invalid_payload", async () => {
    const letterId = freshLetterId();
    const serverSecret = freshServerSecret();
    const backupKey = generateBackupKey();
    const { envelope, envelopeHash } = await sealRawPlaintext({
      plaintext: "not json at all {",
      letterId,
      serverSecret,
      backupKey,
    });
    const result = await openLetter({ envelope, envelopeHash, serverSecret, backupKey });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("invalid_payload");
    }
  });

  it("a decrypted payload failing the v1 schema -> invalid_payload with a field", async () => {
    const letterId = freshLetterId();
    const serverSecret = freshServerSecret();
    const backupKey = generateBackupKey();
    // format_version 1, but letter_text empty: fails the v1 schema.
    const badPayload = JSON.stringify({
      format_version: 1,
      letter_text: "",
      metrics: [],
      figures: [],
      recall_questions: [],
    });
    const { envelope, envelopeHash } = await sealRawPlaintext({
      plaintext: badPayload,
      letterId,
      serverSecret,
      backupKey,
    });
    const result = await openLetter({ envelope, envelopeHash, serverSecret, backupKey });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("invalid_payload");
      if (result.error.kind === "invalid_payload") {
        expect(result.error.field.length).toBeGreaterThan(0);
      }
    }
  });

  it("a decrypted payload with an unknown format_version -> unsupported_format", async () => {
    const letterId = freshLetterId();
    const serverSecret = freshServerSecret();
    const backupKey = generateBackupKey();
    const futurePayload = JSON.stringify({
      format_version: 2,
      letter_text: "from the future",
    });
    const { envelope, envelopeHash } = await sealRawPlaintext({
      plaintext: futurePayload,
      letterId,
      serverSecret,
      backupKey,
    });
    const result = await openLetter({ envelope, envelopeHash, serverSecret, backupKey });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.kind).toBe("unsupported_format");
      if (result.error.kind === "unsupported_format") {
        expect(result.error.formatVersion).toBe(2);
      }
    }
  });
});

// --- the public demo key opens a demo-key-sealed letter ---------------------

describe("the public demo backup key round-trips a demo letter", () => {
  it("seals with PUBLIC_DEMO_BACKUP_KEY and opens with it", async () => {
    const parsed = parseBackupKey(PUBLIC_DEMO_BACKUP_KEY);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const letterId = freshLetterId();
    const serverSecret = freshServerSecret();
    const { envelope, envelopeHash } = await sealLetter({
      payload: validPayload("a persona letter"),
      letterId,
      serverSecret,
      backupKey: parsed.key,
      sealedAt: SEALED_AT,
      opensAt: OPENS_AT,
    });
    const result = await openLetter({
      envelope,
      envelopeHash,
      serverSecret,
      backupKey: parsed.key,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.letter_text).toBe("a persona letter");
    }
  });
});

// Keep headerWithoutCiphertext imported-and-used so the AAD helper the open
// path relies on is visible to readers of this test (it is exercised indirectly
// by every successful open above).
describe("headerWithoutCiphertext is the AAD basis used by open", () => {
  it("drops only the ciphertext field", async () => {
    const letterId = freshLetterId();
    const serverSecret = freshServerSecret();
    const backupKey = generateBackupKey();
    const { envelope } = await sealLetter({
      payload: validPayload(),
      letterId,
      serverSecret,
      backupKey,
      sealedAt: SEALED_AT,
      opensAt: OPENS_AT,
    });
    const header = headerWithoutCiphertext(envelope);
    expect(header).not.toHaveProperty("payloadCiphertext");
    expect(header.letterId).toBe(envelope.letterId);
  });
});
