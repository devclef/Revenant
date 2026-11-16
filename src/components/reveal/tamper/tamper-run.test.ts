// Unit examples for the tamper run and its copy (spec 13, A2). The real
// `openLetter` is replaced by a mock here, so these tests check the run's own
// steps: which byte changes, that the stored envelope is frozen and unchanged,
// and how each result branch is mapped. The property tests with a real seal
// live in their own file.

import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { encodeBase64url, decodeBase64url } from "@/lib/seal-format/base64url";
import { runTamper, tamperByteIndex, TAMPER_BIT_MASK } from "./tamper-run";
import { TAMPER_COPY, changeLine, tamperResultCopy } from "./tamper-copy";

vi.mock("@/lib/crypto/open", () => ({
  openLetter: vi.fn(),
}));

// Loaded dynamically: a static import of src/lib/crypto is forbidden under
// src/components, test files included (import-boundary test).
let openMock: Mock;
beforeEach(async () => {
  const { openLetter } = await import("@/lib/crypto/open");
  openMock = vi.mocked(openLetter) as unknown as Mock;
  openMock.mockReset();
});

const CIPHERTEXT_BYTES = 64;
const originalBytes = Uint8Array.from(
  { length: CIPHERTEXT_BYTES },
  (_, i) => i,
);

function fakeEnvelope(): { formatVersion: number; payloadCiphertext: string } {
  return {
    formatVersion: 1,
    payloadCiphertext: encodeBase64url(originalBytes),
  };
}

function source(envelope: unknown) {
  return {
    envelope,
    envelopeHash: "a".repeat(64),
    readSecret: () => new Uint8Array(32),
  };
}

const refused = {
  ok: false as const,
  error: { kind: "verification_failed" as const },
};
const opened = {
  ok: true as const,
  payload: {} as never,
  openingKey: {} as CryptoKey,
};

describe("tamperByteIndex", () => {
  it("picks the middle byte of a body long enough to hold a tag", () => {
    expect(tamperByteIndex(64)).toBe(32);
    expect(tamperByteIndex(33)).toBe(16);
  });

  it("falls back to byte 0 below 32 bytes, so the tag is never changed by choice", () => {
    expect(tamperByteIndex(16)).toBe(0);
    expect(tamperByteIndex(31)).toBe(0);
  });
});

describe("runTamper: the changed byte", () => {
  it("changes exactly one payload ciphertext byte, by the mask, in the Tamper_Copy only", async () => {
    openMock.mockResolvedValueOnce(opened).mockResolvedValueOnce(refused);

    const run = await runTamper(source(fakeEnvelope()));

    const untouched = decodeBase64url(
      (openMock.mock.calls[0][0].envelope as { payloadCiphertext: string })
        .payloadCiphertext,
    );
    const copy = decodeBase64url(
      (openMock.mock.calls[1][0].envelope as { payloadCiphertext: string })
        .payloadCiphertext,
    );

    expect(untouched).toEqual(originalBytes);

    const differing = [...copy.keys()].filter((i) => copy[i] !== untouched[i]);
    expect(differing).toEqual([32]);
    expect(copy[32]).toBe(originalBytes[32] ^ TAMPER_BIT_MASK);

    expect(run.change).toEqual({
      byteIndex: 32,
      total: CIPHERTEXT_BYTES,
      before: 32,
      after: 33,
    });
  });

  it("passes the same hash and secret length to both open calls", async () => {
    openMock.mockResolvedValueOnce(opened).mockResolvedValueOnce(refused);

    await runTamper(source(fakeEnvelope()));

    expect(openMock.mock.calls[0][0].envelopeHash).toBe("a".repeat(64));
    expect(openMock.mock.calls[1][0].envelopeHash).toBe("a".repeat(64));
    expect(openMock.mock.calls[0][0].serverSecret.length).toBe(32);
    expect(openMock.mock.calls[1][0].serverSecret.length).toBe(32);
  });
});

describe("runTamper: the frozen envelope", () => {
  it("freezes the stored envelope and leaves it deep-equal after the run", async () => {
    openMock.mockResolvedValueOnce(opened).mockResolvedValueOnce(refused);
    const stored = fakeEnvelope();
    const before = JSON.stringify(stored);

    await runTamper(source(stored));

    expect(Object.isFrozen(stored)).toBe(true);
    expect(JSON.stringify(stored)).toBe(before);
    expect(stored.payloadCiphertext).toBe(encodeBase64url(originalBytes));
  });

  it("rejects a write to the stored envelope once it is frozen", async () => {
    openMock.mockResolvedValueOnce(opened).mockResolvedValueOnce(refused);
    const stored = fakeEnvelope();

    await runTamper(source(stored));

    expect(() => {
      (stored as { formatVersion: number }).formatVersion = 2;
    }).toThrow(TypeError);
  });
});

describe("runTamper: result branches", () => {
  it("returns openLetter's refusal for the copy, unchanged", async () => {
    openMock.mockResolvedValueOnce(opened).mockResolvedValueOnce(refused);

    const run = await runTamper(source(fakeEnvelope()));

    expect(run.result).toBe(refused);
    expect(run.untampered).toBe(opened);
    expect(tamperResultCopy(run)).toEqual({
      kind: "cracked",
      heading: "The seal is cracked. Revenant refuses to open this copy.",
      change: changeLine(run.change),
      reliefNotProof: TAMPER_COPY.reliefNotProof,
    });
  });

  it("shows the plain did-not-run-as-expected message when the copy opens", async () => {
    openMock.mockResolvedValueOnce(opened).mockResolvedValueOnce(opened);

    const run = await runTamper(source(fakeEnvelope()));

    expect(run.result.ok).toBe(true);
    expect(tamperResultCopy(run)).toEqual({
      kind: "not_as_expected",
      message: TAMPER_COPY.notAsExpected,
    });
  });

  it("shows the not-as-expected message, not a cracked seal, when the untouched copy does not open", async () => {
    openMock.mockResolvedValueOnce(refused).mockResolvedValueOnce(refused);

    const run = await runTamper(source(fakeEnvelope()));

    expect(tamperResultCopy(run)).toEqual({
      kind: "not_as_expected",
      message: TAMPER_COPY.notAsExpected,
    });
  });
});

describe("changeLine", () => {
  it("names the index, the total and both values in hex", () => {
    expect(
      changeLine({ byteIndex: 32, total: 64, before: 0x3a, after: 0x3b }),
    ).toBe("Byte 32 of 64 changed from 0x3a to 0x3b.");
  });
});
