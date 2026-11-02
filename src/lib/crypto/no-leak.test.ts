import { afterEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";
import { sealLetter, SealError, type PasskeyFactor } from "./seal";
import { openLetter } from "./open";
import { generateBackupKey } from "./backup-key";
import { assertPasskey, confirmPasskey, createPasskey } from "./passkey";
import { createFakeAuthenticator } from "./testing/fake-authenticator";
import type { PayloadV1 } from "../seal-format";
import { decodeBase64url, encodeBase64url } from "../seal-format";

// Feature: 06-lock-and-unlock, task 4: Property 11 (no leaks). The backup key,
// the PRF output, the content key (DEK) and the plaintext must never appear in
// the envelope bytes or in anything written to the console, on success and on
// every failure path we can reach. Secrets are captured from the real WebCrypto
// calls made inside seal and open, so the test does not depend on a hard-coded
// list of where a key happens to live.

const RP_ID = "revenant.devclef.se";
const SEALED_AT = "2026-10-31T12:00:00.000Z";
const OPENS_AT = "2027-02-01T00:00:00.000Z";
const RUNS = 50;
const CONSOLE_METHODS = ["log", "info", "warn", "error", "debug", "trace"] as const;

// The original getRandomValues, bound at load time. Test inputs (IDs, salts,
// keys) come from here so the secret capture below only records what seal and
// open generate themselves.
const realGetRandomValues = globalThis.crypto.getRandomValues.bind(globalThis.crypto);

function fresh(length: number): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(length);
  realGetRandomValues(out);
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

// ---------------------------------------------------------------------------
// Secret capture. Every 16- or 32-byte buffer the seal and open code produces
// through getRandomValues, subtle.decrypt, or subtle.encrypt is recorded (the
// content key is one of them: it is random at seal and the unwrap output at
// open). The copies are taken right after each call, because the DEK is zeroed
// before the operation returns.
// ---------------------------------------------------------------------------

interface Capture {
  secrets: Uint8Array[];
  restore: () => void;
}

function captureSecrets(): Capture {
  const secrets: Uint8Array[] = [];
  const record = (buf: ArrayBuffer | ArrayBufferView): void => {
    const bytes =
      buf instanceof ArrayBuffer
        ? new Uint8Array(buf.slice(0))
        : new Uint8Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    if (bytes.length === 32 || bytes.length === 16) secrets.push(bytes);
  };

  const crypto = globalThis.crypto;
  const subtle = crypto.subtle;
  const origRandom = crypto.getRandomValues.bind(crypto);
  const origDecrypt = subtle.decrypt.bind(subtle);

  const randomSpy = vi
    .spyOn(crypto, "getRandomValues")
    .mockImplementation(<T extends ArrayBufferView | null>(array: T): T => {
      const out = origRandom(array as never);
      if (array) record(array as ArrayBufferView);
      return out as T;
    });

  const decryptSpy = vi
    .spyOn(subtle, "decrypt")
    .mockImplementation(async (...args: Parameters<SubtleCrypto["decrypt"]>) => {
      const out = await origDecrypt(...args);
      record(out);
      return out;
    });

  return {
    secrets,
    restore: () => {
      randomSpy.mockRestore();
      decryptSpy.mockRestore();
    },
  };
}

// ---------------------------------------------------------------------------
// Console capture. Every argument passed to a console method is turned into
// text (JSON for objects, the message for errors) and into bytes (for typed
// arrays), so a secret written in any form is seen.
// ---------------------------------------------------------------------------

interface Written {
  texts: string[];
  bytes: Uint8Array[];
  restore: () => void;
}

function captureConsole(): Written {
  const texts: string[] = [];
  const bytes: Uint8Array[] = [];
  const spies = CONSOLE_METHODS.map((m) =>
    vi.spyOn(console, m).mockImplementation((...args: unknown[]) => {
      for (const arg of args) {
        if (ArrayBuffer.isView(arg)) {
          bytes.push(new Uint8Array(arg.buffer, arg.byteOffset, arg.byteLength).slice());
          continue;
        }
        if (arg instanceof Error) {
          texts.push(arg.message, JSON.stringify({ ...arg, error: (arg as { error?: unknown }).error }));
          continue;
        }
        if (typeof arg === "string") {
          texts.push(arg);
          continue;
        }
        try {
          texts.push(JSON.stringify(arg) ?? String(arg));
        } catch {
          texts.push(String(arg));
        }
      }
    }),
  );
  return {
    texts,
    bytes,
    restore: () => spies.forEach((s) => s.mockRestore()),
  };
}

// ---------------------------------------------------------------------------
// Encodings a secret could be written in. A leak in any of them counts.
// ---------------------------------------------------------------------------

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function encodingsOf(secret: Uint8Array): string[] {
  const b64 = toBase64(secret);
  return [
    toHex(secret).toLowerCase(),
    toHex(secret).toUpperCase(),
    b64,
    b64.replace(/=+$/, ""),
    encodeBase64url(secret),
  ];
}

function containsBytes(haystack: Uint8Array, needle: Uint8Array): boolean {
  if (needle.length === 0 || needle.length > haystack.length) return false;
  outer: for (let i = 0; i <= haystack.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) {
      if (haystack[i + j] !== needle[j]) continue outer;
    }
    return true;
  }
  return false;
}

/** Every byte view the envelope could hide a secret in: its JSON, and each string decoded as base64url. */
function envelopeHaystacks(envelope: unknown): { text: string; bytes: Uint8Array[] } {
  const text = JSON.stringify(envelope);
  const bytes: Uint8Array[] = [new TextEncoder().encode(text)];
  const walk = (node: unknown): void => {
    if (typeof node === "string") {
      try {
        bytes.push(decodeBase64url(node));
      } catch {
        // Not base64url; the JSON text already covers it.
      }
      return;
    }
    if (Array.isArray(node)) node.forEach(walk);
    else if (node && typeof node === "object") Object.values(node).forEach(walk);
  };
  walk(envelope);
  return { text, bytes };
}

/** Assert that no secret, in any encoding, appears in the envelope or the console. */
function expectNoLeak(args: {
  secrets: Uint8Array[];
  envelope?: unknown;
  console: Written;
  plaintext?: string;
}): void {
  const env = args.envelope === undefined ? { text: "", bytes: [] } : envelopeHaystacks(args.envelope);
  const consoleText = args.console.texts.join("\n");

  for (const secret of args.secrets) {
    for (const enc of encodingsOf(secret)) {
      expect(env.text.includes(enc), `secret leaked into envelope JSON as ${enc.slice(0, 8)}...`).toBe(false);
      expect(consoleText.includes(enc), `secret leaked into console as ${enc.slice(0, 8)}...`).toBe(false);
    }
    for (const hay of env.bytes) {
      expect(containsBytes(hay, secret), "secret bytes found in envelope").toBe(false);
    }
    for (const hay of args.console.bytes) {
      expect(containsBytes(hay, secret), "secret bytes written to console").toBe(false);
    }
  }

  if (args.plaintext !== undefined) {
    expect(env.text.includes(args.plaintext), "plaintext visible in envelope JSON").toBe(false);
    expect(consoleText.includes(args.plaintext), "plaintext written to console").toBe(false);
    const marker = new TextEncoder().encode(args.plaintext);
    for (const hay of env.bytes) {
      expect(containsBytes(hay, marker), "plaintext bytes visible in envelope").toBe(false);
    }
  }
}

// ---------------------------------------------------------------------------

describe("Property 11: no backup key, PRF output, content key or plaintext leaks", () => {
  let consoleCapture: Written | undefined;
  let secretCapture: Capture | undefined;

  afterEach(() => {
    consoleCapture?.restore();
    secretCapture?.restore();
    consoleCapture = undefined;
    secretCapture = undefined;
    vi.restoreAllMocks();
  });

  it(`seal and open succeed without a leak, for both factor choices (${RUNS} runs)`, async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.string({ minLength: 1, maxLength: 200 }).filter((s) => s.trim().length > 0),
        fc.constantFrom("passkey" as const, "both" as const),
        async (text, choice) => {
          const marker = `leak-${encodeBase64url(fresh(12))}-${text}`;
          const e = await enrol();
          const backupKey = generateBackupKey();
          const serverSecret = fresh(32);
          const letterId = fresh(16);

          // Each iteration owns its spies and restores them, even on failure.
          const console1 = captureConsole();
          const secrets1 = captureSecrets();
          try {
            const { envelope, envelopeHash: hash } = await sealLetter({
              payload: payload(marker),
              letterId,
              serverSecret,
              ...(choice === "both" ? { backupKey } : {}),
              passkey: factorFrom(e),
              sealedAt: SEALED_AT,
              opensAt: OPENS_AT,
            });
            secrets1.restore();
            // Non-vacuous: seal must have produced at least one captured key (the DEK).
            expect(secrets1.secrets.length).toBeGreaterThan(0);
            expectNoLeak({
              secrets: [...secrets1.secrets, backupKey, e.prfOutput],
              envelope,
              console: console1,
              plaintext: marker,
            });

            // Open with the passkey: the PRF output is the only key the page holds.
            const console2 = captureConsole();
            const secrets2 = captureSecrets();
            try {
              const prf = await prfAtOpen(e);
              const opened = await openLetter({
                envelope,
                envelopeHash: hash,
                serverSecret,
                passkey: { prfOutput: prf },
              });
              secrets2.restore();
              expect(opened.ok).toBe(true);
              expectNoLeak({
                secrets: [...secrets2.secrets, backupKey, prf, e.prfOutput],
                envelope,
                console: console2,
                plaintext: marker,
              });
            } finally {
              secrets2.restore();
              console2.restore();
            }
          } finally {
            secrets1.restore();
            console1.restore();
          }
        },
      ),
      { numRuns: RUNS },
    );
  });

  it("a wrong PRF output fails to open and leaks nothing", async () => {
    const e = await enrol();
    const serverSecret = fresh(32);
    const marker = "wrong-prf-marker-plaintext";
    consoleCapture = captureConsole();
    secretCapture = captureSecrets();
    const { envelope, envelopeHash: hash } = await sealLetter({
      payload: payload(marker),
      letterId: fresh(16),
      serverSecret,
      passkey: factorFrom(e),
      sealedAt: SEALED_AT,
      opensAt: OPENS_AT,
    });
    const wrong = await prfAtOpen(e);
    wrong[0] ^= 0x5a;
    const result = await openLetter({
      envelope,
      envelopeHash: hash,
      serverSecret,
      passkey: { prfOutput: wrong },
    });
    expect(result).toMatchObject({ ok: false, error: { kind: "wrong_key" } });
    expectNoLeak({
      secrets: [...secretCapture.secrets, wrong, e.prfOutput],
      envelope,
      console: consoleCapture,
      plaintext: marker,
    });
  });

  it("a wrong backup key fails to open and leaks nothing", async () => {
    const backupKey = generateBackupKey();
    const serverSecret = fresh(32);
    const marker = "wrong-backup-marker-plaintext";
    consoleCapture = captureConsole();
    secretCapture = captureSecrets();
    const { envelope, envelopeHash: hash } = await sealLetter({
      payload: payload(marker),
      letterId: fresh(16),
      serverSecret,
      backupKey,
      sealedAt: SEALED_AT,
      opensAt: OPENS_AT,
    });
    const other = generateBackupKey();
    const result = await openLetter({
      envelope,
      envelopeHash: hash,
      serverSecret,
      backupKey: other,
    });
    expect(result.ok).toBe(false);
    expectNoLeak({
      secrets: [...secretCapture.secrets, backupKey, other],
      envelope,
      console: consoleCapture,
      plaintext: marker,
    });
  });

  it("a tampered ciphertext fails to open and leaks nothing", async () => {
    const e = await enrol();
    const serverSecret = fresh(32);
    const marker = "tamper-marker-plaintext";
    consoleCapture = captureConsole();
    secretCapture = captureSecrets();
    const { envelope, envelopeHash: hash } = await sealLetter({
      payload: payload(marker),
      letterId: fresh(16),
      serverSecret,
      passkey: factorFrom(e),
      sealedAt: SEALED_AT,
      opensAt: OPENS_AT,
    });
    const tampered = JSON.parse(JSON.stringify(envelope)) as Record<string, unknown>;
    const ct = decodeBase64url(String(tampered.payloadCiphertext));
    ct[0] ^= 0x01;
    tampered.payloadCiphertext = encodeBase64url(ct);
    const prf = await prfAtOpen(e);
    const result = await openLetter({
      envelope: tampered,
      envelopeHash: hash,
      serverSecret,
      passkey: { prfOutput: prf },
    });
    expect(result.ok).toBe(false);
    expectNoLeak({
      secrets: [...secretCapture.secrets, prf, e.prfOutput],
      envelope,
      console: consoleCapture,
      plaintext: marker,
    });
  });

  it("an invalid seal input throws without echoing any secret", async () => {
    const backupKey = generateBackupKey();
    const serverSecret = fresh(32);
    const marker = "invalid-input-marker-plaintext";
    consoleCapture = captureConsole();
    secretCapture = captureSecrets();
    let thrown: unknown;
    try {
      await sealLetter({
        payload: payload(marker),
        letterId: fresh(15), // wrong length: rejected before any derivation
        serverSecret,
        backupKey,
        sealedAt: SEALED_AT,
        opensAt: OPENS_AT,
      });
    } catch (err) {
      thrown = err;
    }
    expect(thrown).toBeInstanceOf(SealError);
    const shown = JSON.stringify({
      message: (thrown as Error).message,
      error: (thrown as SealError).error,
    });
    for (const secret of [backupKey, serverSecret]) {
      for (const enc of encodingsOf(secret)) {
        expect(shown.includes(enc)).toBe(false);
      }
    }
    expectNoLeak({
      secrets: [...secretCapture.secrets, backupKey],
      console: consoleCapture,
      plaintext: marker,
    });
  });
});
