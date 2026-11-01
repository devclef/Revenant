// Unit tests for POST /api/letters/demo/seal with `storeLiveLetter` mocked.
//
// One request per row of the R4.1 table, plus the mapping from each store
// check to its status and fixed body. `LetterStoreError` is the real class, so
// `instanceof` and `check` behave as in production.
//
// Each failure test asserts that `storeLiveLetter` was not called, because it
// is the only path that writes a `demo_letters` row. Steps 1 to 6 never reach
// it, so no row can be written. Steps 7 to 10 run inside `storeLiveLetter`, so
// their no-row and Draft-retention guarantees are checked against Postgres in
// `src/test/integration/live-letters.test.ts`.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LetterStoreError,
  type LetterStoreCheck,
  type StoreLiveLetterArgs,
  type StoreLiveLetterResult,
} from "@/lib/letter-store/store";
import { encodeBase64url, envelopeHash } from "@/lib/seal-format";
import { LOCK_DURATION_MS } from "@/lib/seal-format/live-constants";

const storeLiveLetterSpy = vi.fn<
  (args: StoreLiveLetterArgs) => Promise<StoreLiveLetterResult>
>();

vi.mock("@/lib/letter-store/store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/letter-store/store")>();
  return {
    ...actual,
    storeLiveLetter: (args: StoreLiveLetterArgs) => storeLiveLetterSpy(args),
  };
});

import { POST } from "./route";

const URL_UNDER_TEST = "http://x/api/letters/demo/seal";

/** A valid 22-character letter ID (16 bytes of 0x01). */
const ID = encodeBase64url(new Uint8Array(16).fill(1));
const SEALED_AT = "2026-11-01T21:00:00.000Z";
const OPENS_AT = "2026-11-01T21:00:30.000Z";

/** A backup-wrapped Live_Letter envelope, with no passkey fields. */
function liveEnvelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    formatVersion: 1,
    letterId: ID,
    opensAt: OPENS_AT,
    payloadCiphertext: "REREREREREREREREREREREREREREREREREREREREREQ",
    payloadNonce: "MzMzMzMzMzMzMzMz",
    sealedAt: SEALED_AT,
    wrappedDeks: [
      {
        factor: "backup",
        nonce: "ERERERERERERERER",
        wrappedKey:
          "IiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIi",
      },
    ],
    ...overrides,
  };
}

/** A passkey-wrapped envelope naming `rpId`, with its passkey fields. */
function passkeyEnvelope(rpId: string): Record<string, unknown> {
  const wrap = liveEnvelope().wrappedDeks as Array<Record<string, unknown>>;
  return liveEnvelope({
    wrappedDeks: [
      wrap[0],
      { ...wrap[0], factor: "passkey" },
    ],
    rpId,
    credentialId: "AQID",
    prfSalt: encodeBase64url(new Uint8Array(32).fill(9)),
  });
}

/** A JSON POST with the correct hash for `envelope`, unless overridden. */
async function validBody(
  envelope: Record<string, unknown> = liveEnvelope(),
  overrides: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  return {
    letterId: ID,
    envelope,
    envelopeHash: await envelopeHash(envelope),
    ...overrides,
  };
}

/** Build a POST request. A string body is sent as-is, anything else as JSON. */
function postRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(URL_UNDER_TEST, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

let previousRpId: string | undefined;

beforeEach(() => {
  previousRpId = process.env.RP_ID;
  process.env.RP_ID = "localhost";
  storeLiveLetterSpy.mockReset();
  storeLiveLetterSpy.mockResolvedValue({
    letterId: ID,
    sealedAt: new Date(SEALED_AT),
    opensAt: new Date(OPENS_AT),
  });
});

afterEach(() => {
  if (previousRpId === undefined) {
    delete process.env.RP_ID;
  } else {
    process.env.RP_ID = previousRpId;
  }
});

/** Assert a failed request wrote nothing: the store was never called. */
function expectNoRowWritten(): void {
  expect(storeLiveLetterSpy).not.toHaveBeenCalled();
}

describe("POST /api/letters/demo/seal: R4.1 rows", () => {
  it("row 1: a Content-Length over the limit gives 413 too_large", async () => {
    const res = await POST(
      postRequest(await validBody(), { "content-length": "100001" }),
    );
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "too_large" });
    expectNoRowWritten();
  });

  it("row 1: a body text over the limit gives 413 too_large", async () => {
    const padded = JSON.stringify({ letterId: ID, pad: "x".repeat(100_001) });
    const res = await POST(postRequest(padded));
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ error: "too_large" });
    expectNoRowWritten();
  });

  it("row 2: a body that is not JSON gives 400 invalid_body with field body", async () => {
    const res = await POST(postRequest("{not json"));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_body", field: "body" });
    expectNoRowWritten();
  });

  it.each([
    ["a missing letterId", { envelope: liveEnvelope(), envelopeHash: "0".repeat(64) }, "letterId"],
    ["an envelope that is a string", { letterId: ID, envelope: "MARKER-VALUE", envelopeHash: "0".repeat(64) }, "envelope"],
    ["a hash that is a number", { letterId: ID, envelope: liveEnvelope(), envelopeHash: 12345 }, "envelopeHash"],
  ])("row 3: %s gives 400 invalid_body naming the field", async (_label, body, field) => {
    const res = await POST(postRequest(body));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_body", field });
    expectNoRowWritten();
  });

  it("row 3: the 400 body never echoes a submitted value", async () => {
    const marker = "MARKER-VALUE-7731";
    const res = await POST(
      postRequest({ letterId: ID, envelope: marker, envelopeHash: "0".repeat(64) }),
    );
    expect(await res.text()).not.toContain(marker);
  });

  it("row 4: an envelope that fails parseEnvelope gives 400 invalid_envelope", async () => {
    const envelope = { formatVersion: 1, letterId: ID };
    const res = await POST(postRequest(await validBody(envelope)));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_envelope" });
    expectNoRowWritten();
  });

  it("row 4: an envelope letterId that differs from the body letterId gives 400 invalid_envelope", async () => {
    const other = encodeBase64url(new Uint8Array(16).fill(2));
    const res = await POST(
      postRequest(await validBody(liveEnvelope({ letterId: other }))),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_envelope" });
    expectNoRowWritten();
  });

  it("row 5a: RP_ID unset gives 503 not_configured", async () => {
    delete process.env.RP_ID;
    const res = await POST(postRequest(await validBody()));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "not_configured" });
    expectNoRowWritten();
  });

  it("row 5a: RP_ID blank gives 503 not_configured", async () => {
    process.env.RP_ID = "  ";
    const res = await POST(postRequest(await validBody()));
    expect(res.status).toBe(503);
    expectNoRowWritten();
  });

  it("row 5b: a header rpId that differs from RP_ID gives 400 invalid_envelope", async () => {
    const res = await POST(postRequest(await validBody(passkeyEnvelope("example.org"))));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_envelope" });
    expectNoRowWritten();
  });

  it("row 5b: a header rpId that matches RP_ID is accepted", async () => {
    const res = await POST(postRequest(await validBody(passkeyEnvelope("localhost"))));
    expect(res.status).toBe(201);
    expect(storeLiveLetterSpy).toHaveBeenCalledTimes(1);
  });

  it("row 6: a hash that does not match the envelope gives 400 hash_mismatch", async () => {
    const res = await POST(
      postRequest(await validBody(liveEnvelope(), { envelopeHash: "0".repeat(64) })),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "hash_mismatch" });
    expectNoRowWritten();
  });

  it("rows 7 to 10: each store check maps to the status in the design table", async () => {
    const cases: Array<[LetterStoreCheck, number, unknown]> = [
      ["envelope", 400, { error: "invalid_envelope" }],
      ["hash_mismatch", 400, { error: "hash_mismatch" }],
      ["draft_not_found", 404, { error: "not_found" }],
      ["duplicate_id", 404, { error: "not_found" }],
      ["busy", 429, { error: "busy" }],
      ["lock_out_of_range", 422, { error: "lock_out_of_range" }],
      ["server_secret", 500, { error: "internal" }],
    ];
    for (const [check, status, body] of cases) {
      storeLiveLetterSpy.mockRejectedValueOnce(new LetterStoreError(check));
      const res = await POST(postRequest(await validBody()));
      expect(res.status, check).toBe(status);
      expect(await res.json(), check).toEqual(body);
    }
  });

  it("rows 7 to 10: an unknown Draft, a used Draft and an expired Draft get the same 404 bytes", async () => {
    storeLiveLetterSpy.mockRejectedValueOnce(new LetterStoreError("draft_not_found"));
    const first = await POST(postRequest(await validBody()));
    const firstText = await first.text();

    storeLiveLetterSpy.mockRejectedValueOnce(new LetterStoreError("duplicate_id"));
    const second = await POST(postRequest(await validBody()));
    const secondText = await second.text();

    expect(first.status).toBe(404);
    expect(secondText).toBe(firstText);
    expect(firstText).toBe('{"error":"not_found"}');
  });

  it("rows 7 to 10: a busy rejection gives 429 busy", async () => {
    storeLiveLetterSpy.mockRejectedValueOnce(new LetterStoreError("busy"));
    const res = await POST(postRequest(await validBody()));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "busy" });
  });

  it("an unexpected failure gives 500 internal with the error dropped", async () => {
    storeLiveLetterSpy.mockRejectedValueOnce(new Error(`leak ${ID}`));
    const res = await POST(postRequest(await validBody()));
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(text).toBe('{"error":"internal"}');
    expect(text).not.toContain(ID);
  });

  it("success: 201 with letterId, sealedAt and opensAt in ISO millisecond form", async () => {
    const res = await POST(postRequest(await validBody()));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      letterId: ID,
      sealedAt: SEALED_AT,
      opensAt: OPENS_AT,
    });
    expect(storeLiveLetterSpy).toHaveBeenCalledTimes(1);
    expect(new Date(OPENS_AT).getTime() - new Date(SEALED_AT).getTime()).toBe(
      LOCK_DURATION_MS,
    );
  });
});

describe("POST /api/letters/demo/seal: headers and source", () => {
  it("sends Cache-Control: no-store on success and on every error", async () => {
    const ok = await POST(postRequest(await validBody()));
    const bad = await POST(postRequest("{not json"));
    expect(ok.headers.get("cache-control")).toBe("no-store");
    expect(bad.headers.get("cache-control")).toBe("no-store");
  });

  it("contains no SQL and does not import the browser crypto library", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const source = readFileSync(resolve(here, "route.ts"), "utf8");
    expect(source).not.toMatch(/from\s+["']@\/lib\/crypto/);
    expect(source).not.toMatch(/\bsql`|\bSELECT\b|\bINSERT\b|\bDELETE\b/);
  });
});
