// Unit tests for POST /api/letters/seal with `storeRealLetter` mocked.
//
// Covers the flag (unset, "yes" and any other value other than "on" are off, and
// every request while off returns 404 and stores nothing), the body and envelope
// checks, the 3-calendar-month lock at its 1 ms boundary, and the store's error
// mapping. `LetterStoreError` is the real class. Only `Date` is faked, so
// `Date.now()` is the fixed server clock for the lock check.
//
// The database-side guarantees (draft consumed, no row on failure, the DB clock
// lock) are checked in `src/test/integration/` against Postgres.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LetterStoreError,
  type LetterStoreCheck,
} from "@/lib/letter-store/store";
import type {
  StoreRealLetterArgs,
  StoreRealLetterResult,
} from "@/lib/letter-store/real";
import {
  addCalendarMonthsUtc,
  encodeBase64url,
  envelopeHash,
} from "@/lib/seal-format";

// feature-flags.ts imports `server-only`, which throws outside a server bundle.
vi.mock("server-only", () => ({}));

const storeRealLetterSpy = vi.fn<
  (args: StoreRealLetterArgs) => Promise<StoreRealLetterResult>
>();

vi.mock("@/lib/letter-store/real", () => ({
  storeRealLetter: (args: StoreRealLetterArgs) => storeRealLetterSpy(args),
}));

import { POST } from "./route";

const URL_UNDER_TEST = "http://x/api/letters/seal";
const NOW_MS = Date.parse("2026-11-06T14:00:00.000Z");
/** The earliest opens_at that meets the 3-calendar-month rule at NOW_MS. */
const EARLIEST_MS = addCalendarMonthsUtc(NOW_MS, 3);

/** A valid 22-character letter ID (16 bytes of 0x05). */
const ID = encodeBase64url(new Uint8Array(16).fill(5));

/** A backup-wrapped real envelope whose opens_at is `opensAtMs`. */
function realEnvelope(opensAtMs: number, overrides: Record<string, unknown> = {}) {
  return {
    formatVersion: 1,
    letterId: ID,
    opensAt: new Date(opensAtMs).toISOString(),
    payloadCiphertext: "REREREREREREREREREREREREREREREREREREREREREQ",
    payloadNonce: "MzMzMzMzMzMzMzMz",
    sealedAt: new Date(NOW_MS).toISOString(),
    wrappedDeks: [
      {
        factor: "backup",
        nonce: "ERERERERERERERER",
        wrappedKey:
          "IiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIi",
      },
    ],
    ...overrides,
  } as Record<string, unknown>;
}

/** A JSON body with the correct hash for `envelope`. */
async function validBody(
  envelope: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  return {
    letterId: ID,
    envelope,
    envelopeHash: await envelopeHash(envelope),
    ...overrides,
  };
}

function postRequest(body: unknown): Request {
  return new Request(URL_UNDER_TEST, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

let previousRpId: string | undefined;
let previousFlag: string | undefined;

beforeEach(() => {
  previousRpId = process.env.RP_ID;
  previousFlag = process.env.REAL_SEALING;
  process.env.RP_ID = "localhost";
  process.env.REAL_SEALING = "on";
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW_MS);
  storeRealLetterSpy.mockReset();
  storeRealLetterSpy.mockResolvedValue({
    letterId: ID,
    sealedAt: new Date(NOW_MS),
    opensAt: new Date(EARLIEST_MS),
  });
});

afterEach(() => {
  vi.useRealTimers();
  if (previousRpId === undefined) {
    delete process.env.RP_ID;
  } else {
    process.env.RP_ID = previousRpId;
  }
  if (previousFlag === undefined) {
    delete process.env.REAL_SEALING;
  } else {
    process.env.REAL_SEALING = previousFlag;
  }
});

function expectNothingStored(): void {
  expect(storeRealLetterSpy).not.toHaveBeenCalled();
}

describe("POST /api/letters/seal: REAL_SEALING flag", () => {
  it.each([
    ["unset", undefined],
    ["the empty string", ""],
    ["yes", "yes"],
    ["ON", "ON"],
    ["true", "true"],
    ["1", "1"],
  ])("%s gives 404 real_sealing_off and stores nothing", async (_label, value) => {
    if (value === undefined) {
      delete process.env.REAL_SEALING;
    } else {
      process.env.REAL_SEALING = value;
    }
    const res = await POST(postRequest(await validBody(realEnvelope(EARLIEST_MS))));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "real_sealing_off" });
    expectNothingStored();
  });

  it("'on' with surrounding whitespace is on", async () => {
    process.env.REAL_SEALING = "  on  ";
    const res = await POST(postRequest(await validBody(realEnvelope(EARLIEST_MS))));
    expect(res.status).toBe(201);
  });

  it("every request while off returns 404, even an invalid one, and stores nothing", async () => {
    delete process.env.REAL_SEALING;
    const bodies: unknown[] = [
      "{not json",
      { letterId: ID },
      await validBody(realEnvelope(EARLIEST_MS - 1)),
      await validBody(realEnvelope(EARLIEST_MS)),
    ];
    for (const body of bodies) {
      const res = await POST(postRequest(body));
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "real_sealing_off" });
    }
    expectNothingStored();
  });
});

describe("POST /api/letters/seal: lock boundary", () => {
  it("accepts opens_at exactly at three calendar months after now", async () => {
    const res = await POST(postRequest(await validBody(realEnvelope(EARLIEST_MS))));
    expect(res.status).toBe(201);
    expect(storeRealLetterSpy).toHaveBeenCalledTimes(1);
  });

  it("refuses opens_at 1 ms before the boundary with 422 and stores nothing", async () => {
    const res = await POST(
      postRequest(await validBody(realEnvelope(EARLIEST_MS - 1))),
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "opens_at_too_early" });
    expectNothingStored();
  });

  it("refuses an opens_at well inside three months with 422", async () => {
    const res = await POST(
      postRequest(await validBody(realEnvelope(NOW_MS + 86_400_000))),
    );
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: "opens_at_too_early" });
    expectNothingStored();
  });
});

describe("POST /api/letters/seal: request checks", () => {
  it("a body that is not JSON gives 400 invalid_body with field body", async () => {
    const res = await POST(postRequest("{not json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_body", field: "body" });
    expectNothingStored();
  });

  it("a missing letterId gives 400 invalid_body naming the field", async () => {
    const res = await POST(
      postRequest({ envelope: realEnvelope(EARLIEST_MS), envelopeHash: "0".repeat(64) }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_body", field: "letterId" });
    expectNothingStored();
  });

  it("a body over the size limit gives 413 too_large", async () => {
    const padded = JSON.stringify({ letterId: ID, pad: "x".repeat(100_001) });
    const res = await POST(postRequest(padded));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "too_large" });
    expectNothingStored();
  });

  it("an envelope that fails parseEnvelope gives 400 invalid_envelope", async () => {
    const res = await POST(
      postRequest(await validBody({ formatVersion: 1, letterId: ID })),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_envelope" });
    expectNothingStored();
  });

  it("a wrong envelope hash gives 400 hash_mismatch", async () => {
    const res = await POST(
      postRequest({
        letterId: ID,
        envelope: realEnvelope(EARLIEST_MS),
        envelopeHash: "0".repeat(64),
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "hash_mismatch" });
    expectNothingStored();
  });

  it("RP_ID unset gives 503 not_configured", async () => {
    delete process.env.RP_ID;
    const res = await POST(postRequest(await validBody(realEnvelope(EARLIEST_MS))));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "not_configured" });
    expectNothingStored();
  });
});

describe("POST /api/letters/seal: store errors and success", () => {
  it("returns 201 with the stored header fields and the submitted hash", async () => {
    const body = await validBody(realEnvelope(EARLIEST_MS));
    const res = await POST(postRequest(body));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      letterId: ID,
      sealedAt: new Date(NOW_MS).toISOString(),
      opensAt: new Date(EARLIEST_MS).toISOString(),
      envelopeHash: body.envelopeHash,
    });
  });

  it("passes the envelope to the store unchanged; the store sets sealed_at", async () => {
    const body = await validBody(realEnvelope(EARLIEST_MS, { sealedAt: "2000-01-01T00:00:00.000Z" }));
    await POST(postRequest(body));
    expect(storeRealLetterSpy).toHaveBeenCalledWith({
      envelope: expect.objectContaining({ sealedAt: "2000-01-01T00:00:00.000Z" }),
      envelopeHash: body.envelopeHash,
    });
  });

  it.each<[LetterStoreCheck, number, string]>([
    ["envelope", 400, "invalid_envelope"],
    ["hash_mismatch", 400, "hash_mismatch"],
    ["duplicate_id", 404, "not_found"],
    ["draft_not_found", 404, "not_found"],
    ["opens_at_too_early", 422, "opens_at_too_early"],
  ])("store check %s maps to %i %s", async (check, status, error) => {
    storeRealLetterSpy.mockRejectedValueOnce(new LetterStoreError(check));
    const res = await POST(postRequest(await validBody(realEnvelope(EARLIEST_MS))));
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error });
  });

  it("an unexpected store failure gives the fixed 500 internal body", async () => {
    storeRealLetterSpy.mockRejectedValueOnce(new Error("driver detail MARKER-9931"));
    const res = await POST(postRequest(await validBody(realEnvelope(EARLIEST_MS))));
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: "internal" });
    expect(text).not.toContain("MARKER-9931");
  });
});
