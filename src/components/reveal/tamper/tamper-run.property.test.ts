// Feature: 13-the-seal, Property 9 and Property 10 (spec 13, A2.1 to A2.5, Q2.3).
//
// One fixture envelope is sealed once per file with the real `sealLetter` and
// the published demo key, in Node WebCrypto. The properties then vary the
// changed byte and the XOR mask, and run the real `openLetter` through
// `runTamper`. The crypto modules are loaded dynamically: a static import of
// src/lib/crypto is forbidden under src/components, test files included
// (import-boundary test).

import { beforeAll, describe, expect, it } from "vitest";
import fc from "fast-check";
import { runTamper, runRecomputedFingerprint, type TamperSource } from "./tamper-run";
import { tamperResultCopy } from "./tamper-copy";
import {
  canonicalize,
  decodeBase64url,
  encodeBase64url,
  type EnvelopeV1,
  type PayloadV1,
} from "@/lib/seal-format";

const RUNS = 100;
const SEALED_AT = "2026-10-31T12:00:00.000Z";
const OPENS_AT = "2027-02-01T00:00:00.000Z";
const LETTER = "A short letter for the tamper property test.";

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

interface Fixture {
  readonly envelope: EnvelopeV1;
  readonly hash: string;
  readonly secret: Uint8Array<ArrayBuffer>;
  readonly ciphertextBytes: number;
}

let fixture: Fixture;

/** A fresh parse of the published demo key, so no key bytes are shared. */
async function demoKey() {
  const { parseBackupKey } = await import("@/lib/crypto/backup-key");
  const { PUBLIC_DEMO_BACKUP_KEY } = await import("@/lib/crypto/demo-key");
  const parsed = parseBackupKey(PUBLIC_DEMO_BACKUP_KEY);
  if (!parsed.ok) throw new Error("test setup: demo key did not parse");
  return parsed.key;
}

beforeAll(async () => {
  const { sealLetter } = await import("@/lib/crypto/seal");
  const secret = fresh(32);
  const sealed = await sealLetter({
    payload: payload(LETTER),
    letterId: fresh(16),
    serverSecret: secret,
    backupKey: await demoKey(),
    sealedAt: SEALED_AT,
    opensAt: OPENS_AT,
  });
  const ciphertext = (sealed.envelope as { payloadCiphertext: string })
    .payloadCiphertext;
  fixture = {
    envelope: sealed.envelope,
    hash: sealed.envelopeHash,
    secret,
    ciphertextBytes: decodeBase64url(ciphertext).length,
  };
});

/** The source `runTamper` gets: a fresh clone of the stored envelope. */
function sourceFor(stored: EnvelopeV1): TamperSource {
  return {
    envelope: stored,
    envelopeHash: fixture.hash,
    readSecret: () => new Uint8Array(fixture.secret),
  };
}

// Feature: 13-the-seal, Property 9
describe("Property 9: a tampered copy is always refused and the stored envelope never changes", () => {
  it("refuses every one-byte change, and leaves the stored envelope deep-equal and frozen", async () => {
    const { openLetter } = await import("@/lib/crypto/open");

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: fixture.ciphertextBytes - 1 }),
        fc.integer({ min: 1, max: 255 }),
        async (byteIndex, mask) => {
          const stored = structuredClone(fixture.envelope) as EnvelopeV1;
          const before = canonicalize(stored);

          const run = await runTamper(sourceFor(stored), { byteIndex, mask });

          expect(run.change.byteIndex).toBe(byteIndex);
          expect(run.change.after).toBe(run.change.before ^ mask);
          expect(run.result.ok).toBe(false);
          if (!run.result.ok) {
            expect(run.result.error.kind).toBe("verification_failed");
          }

          // The stored envelope is untouched and frozen.
          expect(Object.isFrozen(stored)).toBe(true);
          expect(canonicalize(stored)).toBe(before);

          // The original still opens after the tamper run.
          const again = await openLetter({
            envelope: stored,
            envelopeHash: fixture.hash,
            serverSecret: new Uint8Array(fixture.secret),
            backupKey: await demoKey(),
          });
          expect(again.ok).toBe(true);
        },
      ),
      { numRuns: RUNS },
    );
  });
});

// Feature: 13-the-seal, Property 10
describe("Property 10: the Tamper_Control result is what openLetter returned", () => {
  it("gives exactly the result openLetter returns for the same changed copy", async () => {
    const { openLetter } = await import("@/lib/crypto/open");

    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: fixture.ciphertextBytes - 1 }),
        fc.integer({ min: 1, max: 255 }),
        async (byteIndex, mask) => {
          const stored = structuredClone(fixture.envelope) as EnvelopeV1;
          const run = await runTamper(sourceFor(stored), { byteIndex, mask });

          // Build the same copy by hand and call openLetter directly.
          const copy = structuredClone(fixture.envelope) as EnvelopeV1;
          const bytes = decodeBase64url(
            (copy as { payloadCiphertext: string }).payloadCiphertext,
          );
          bytes[byteIndex] ^= mask;
          (copy as { payloadCiphertext: string }).payloadCiphertext =
            encodeBase64url(bytes);
          const direct = await openLetter({
            envelope: copy,
            envelopeHash: fixture.hash,
            serverSecret: new Uint8Array(fixture.secret),
            backupKey: await demoKey(),
          });

          expect(run.result).toEqual(direct);
          // The verdict shown is the cracked seal exactly when openLetter refused.
          expect(tamperResultCopy(run).kind).toBe(
            direct.ok ? "not_as_expected" : "cracked",
          );
        },
      ),
      { numRuns: RUNS },
    );
  });
});

// Feature: 13-the-seal, Property 11: A recomputed fingerprint is still refused at the authentication layer
describe("Property 11: A recomputed fingerprint is still refused at the authentication layer", () => {
  it("refuses every non-zero one-byte change as tampered once the copy's hash is recomputed", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: fixture.ciphertextBytes - 1 }),
        fc.integer({ min: 1, max: 255 }),
        async (byteIndex, mask) => {
          const stored = structuredClone(fixture.envelope) as EnvelopeV1;
          const before = canonicalize(stored);

          const run = await runRecomputedFingerprint(sourceFor(stored), {
            byteIndex,
            mask,
          });

          expect(run.change.byteIndex).toBe(byteIndex);
          expect(run.change.after).toBe(run.change.before ^ mask);
          expect(run.recomputedHash).not.toBe(fixture.hash);
          expect(run.result.ok).toBe(false);
          if (!run.result.ok) {
            expect(run.result.error.kind).toBe("tampered");
          }

          // The stored envelope is untouched and frozen.
          expect(Object.isFrozen(stored)).toBe(true);
          expect(canonicalize(stored)).toBe(before);
        },
      ),
      { numRuns: RUNS },
    );
  });
});

describe("runTamper overrides", () => {
  it("rejects a mask of zero, because it would change nothing", async () => {
    await expect(
      runTamper(sourceFor(structuredClone(fixture.envelope) as EnvelopeV1), {
        mask: 0,
      }),
    ).rejects.toThrow("mask must be an integer from 1 to 255");
  });

  it("rejects a byte index outside the payload ciphertext", async () => {
    await expect(
      runTamper(sourceFor(structuredClone(fixture.envelope) as EnvelopeV1), {
        byteIndex: fixture.ciphertextBytes,
      }),
    ).rejects.toThrow("byteIndex is outside the payload ciphertext");
  });
});
