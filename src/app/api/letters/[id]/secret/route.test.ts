// Unit tests for GET /api/letters/[id]/secret with `findLetter` fully mocked.
//
// These tests pin the design Routes table for the secret-release endpoint:
//   - Openable (dbNow >= opensAt): 200 with EXACTLY {serverSecret}, where
//     serverSecret is the 32 time-lock bytes as 43 unpadded base64url chars
//     (R6.4, R6.5).
//   - Sealed (dbNow < opensAt): 403 with EXACTLY {opensAt}, revealing only the
//     opening instant so a countdown can be shown — never the secret (R6.4).
//   - Malformed and unknown IDs return the byte-identical 404 body and headers
//     (Property 17), so the two cannot be told apart.
//   - Every response — 200, 403, 404 and 500 — carries `Cache-Control:
//     no-store` (R6.10): the secret must never be cached.
//   - A thrown failure becomes a fixed 500 {"error":"internal"} (R8.6), with no
//     driver detail leaked.
//   - The open/sealed decision uses the database `now()` (row.dbNow) only; a
//     client-supplied time (Date header, query string) never changes it
//     (R6.4, R6.5).
//
// `findLetter` is mocked, so no database is touched. `isLetterId`,
// `isOpenable`, `encodeBase64url` and the `http` helpers are the real modules.

import fc from "fast-check";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LetterRow } from "@/lib/letter-store/queries";
import { encodeBase64url } from "@/lib/seal-format";

const findLetterSpy = vi.fn<(id: string) => Promise<LetterRow | null>>();

vi.mock("@/lib/letter-store/queries", () => ({
  findLetter: (id: string) => findLetterSpy(id),
}));

import { GET } from "./route";

// A canonical 22-char letter ID (16 bytes, base64url, final char in [AQgw]).
const VALID_ID = "AAECAwQFBgcICQoLDA0ODw";
// Wrong length / out-of-alphabet / bad final char -> isLetterId === false.
const MALFORMED_IDS = [
  "", // empty
  "short", // too short
  "AAECAwQFBgcICQoLDA0ODwXX", // too long
  "AAECAwQFBgcICQoLDA0OD!", // out-of-alphabet char
  "AAECAwQFBgcICQoLDA0ODB", // 22 chars but final char not in [AQgw]
];

/** Build a route context whose `params` is the Next 15 Promise. */
function ctx(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

/** A sealed (not-yet-open) letter row: dbNow strictly before opensAt. */
function sealedRow(overrides: Partial<LetterRow> = {}): LetterRow {
  return {
    id: VALID_ID,
    envelope: JSON.stringify({ formatVersion: 1, ciphertext: "abc" }),
    envelopeHash: "a".repeat(64),
    opensAt: new Date("2027-02-01T00:00:00.000Z"),
    serverSecret: Buffer.alloc(32, 7),
    demo: false,
    dbNow: new Date("2026-11-15T09:30:00.000Z"),
    ...overrides,
  };
}

/** An openable letter row: dbNow at or after opensAt. */
function openableRow(overrides: Partial<LetterRow> = {}): LetterRow {
  return {
    ...sealedRow(),
    opensAt: new Date("2024-11-05T00:00:00.000Z"),
    dbNow: new Date("2026-11-15T09:30:00.000Z"),
    ...overrides,
  };
}

async function bodyOf(res: Response): Promise<unknown> {
  return res.json();
}

beforeEach(() => {
  findLetterSpy.mockReset();
});

describe("GET /api/letters/[id]/secret — openable letter", () => {
  it("returns 200 with EXACTLY {serverSecret} when dbNow >= opensAt", async () => {
    const secretBytes = Buffer.alloc(32, 7);
    findLetterSpy.mockResolvedValueOnce(
      openableRow({ serverSecret: secretBytes }),
    );

    const res = await GET(new Request("http://x/l/secret"), ctx(VALID_ID));
    expect(res.status).toBe(200);

    const body = (await bodyOf(res)) as Record<string, unknown>;
    expect(body).toEqual({
      serverSecret: encodeBase64url(new Uint8Array(secretBytes)),
    });
    // No other keys leak alongside the secret.
    expect(Object.keys(body)).toEqual(["serverSecret"]);
  });

  it("encodes the 32-byte secret as a 43-char unpadded base64url string", async () => {
    findLetterSpy.mockResolvedValueOnce(
      openableRow({ serverSecret: Buffer.alloc(32, 42) }),
    );
    const res = await GET(new Request("http://x/l/secret"), ctx(VALID_ID));
    const body = (await bodyOf(res)) as Record<string, unknown>;
    const secret = body.serverSecret as string;
    expect(secret).toHaveLength(43);
    // Unpadded base64url alphabet only: no '=', '+' or '/'.
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
  });

  it("round-trips the exact secret bytes through the base64url codec", async () => {
    const bytes = Buffer.from(
      Array.from({ length: 32 }, (_, i) => (i * 7 + 3) & 0xff),
    );
    findLetterSpy.mockResolvedValueOnce(openableRow({ serverSecret: bytes }));
    const res = await GET(new Request("http://x/l/secret"), ctx(VALID_ID));
    const body = (await bodyOf(res)) as Record<string, unknown>;
    expect(body.serverSecret).toBe(encodeBase64url(new Uint8Array(bytes)));
  });

  it("treats dbNow exactly equal to opensAt as open (R6.5)", async () => {
    const instant = new Date("2025-06-01T12:00:00.000Z");
    findLetterSpy.mockResolvedValueOnce(
      openableRow({ opensAt: instant, dbNow: new Date(instant.getTime()) }),
    );
    const res = await GET(new Request("http://x/l/secret"), ctx(VALID_ID));
    expect(res.status).toBe(200);
    const body = (await bodyOf(res)) as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(["serverSecret"]);
  });

  it("sets Cache-Control: no-store on the 200 so the secret is never cached", async () => {
    findLetterSpy.mockResolvedValueOnce(openableRow());
    const res = await GET(new Request("http://x/l/secret"), ctx(VALID_ID));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("GET /api/letters/[id]/secret — sealed letter", () => {
  it("returns 403 with EXACTLY {opensAt} before the opening date — never the secret", async () => {
    findLetterSpy.mockResolvedValueOnce(sealedRow());

    const res = await GET(new Request("http://x/l/secret"), ctx(VALID_ID));
    expect(res.status).toBe(403);

    const body = (await bodyOf(res)) as Record<string, unknown>;
    expect(body).toEqual({ opensAt: "2027-02-01T00:00:00.000Z" });
    expect(Object.keys(body)).toEqual(["opensAt"]);
    // The secret must not appear anywhere in the sealed response.
    expect(JSON.stringify(body)).not.toContain("serverSecret");
  });

  it("gives opensAt as the millisecond-precision UTC ISO string", async () => {
    findLetterSpy.mockResolvedValueOnce(
      sealedRow({ opensAt: new Date(Date.UTC(2027, 1, 1, 3, 4, 5, 678)) }),
    );
    const res = await GET(new Request("http://x/l/secret"), ctx(VALID_ID));
    const body = (await bodyOf(res)) as Record<string, unknown>;
    expect(body.opensAt).toBe("2027-02-01T03:04:05.678Z");
    expect(body.opensAt as string).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it("sets Cache-Control: no-store on the 403", async () => {
    findLetterSpy.mockResolvedValueOnce(sealedRow());
    const res = await GET(new Request("http://x/l/secret"), ctx(VALID_ID));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("404 — malformed and unknown IDs are indistinguishable (Property 17)", () => {
  it("returns a byte-identical 404 for every malformed ID without querying", async () => {
    for (const id of MALFORMED_IDS) {
      const res = await GET(new Request("http://x/l/secret"), ctx(id));
      expect(res.status).toBe(404);
      expect(await bodyOf(res)).toEqual({ error: "not_found" });
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    }
    // A malformed ID never reaches the database.
    expect(findLetterSpy).not.toHaveBeenCalled();
  });

  it("returns the same 404 body and headers for an unknown (valid-shape) ID", async () => {
    findLetterSpy.mockResolvedValueOnce(null);
    const res = await GET(new Request("http://x/l/secret"), ctx(VALID_ID));
    expect(res.status).toBe(404);
    expect(await bodyOf(res)).toEqual({ error: "not_found" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("the malformed 404 and the unknown 404 are byte-identical", async () => {
    findLetterSpy.mockResolvedValueOnce(null);
    const unknownRes = await GET(new Request("http://x/l/secret"), ctx(VALID_ID));
    const malformedRes = await GET(new Request("http://x/l/secret"), ctx("!!!"));

    expect(unknownRes.status).toBe(malformedRes.status);
    expect(await unknownRes.text()).toBe(await malformedRes.text());
    expect(unknownRes.headers.get("Cache-Control")).toBe(
      malformedRes.headers.get("Cache-Control"),
    );
    expect(unknownRes.headers.get("Content-Type")).toBe(
      malformedRes.headers.get("Content-Type"),
    );
  });
});

describe("500 — unexpected failure", () => {
  it('returns a fixed 500 {"error":"internal"} with no-store when findLetter throws', async () => {
    findLetterSpy.mockRejectedValueOnce(
      new Error("some-driver-detail-that-must-not-leak"),
    );
    const res = await GET(new Request("http://x/l/secret"), ctx(VALID_ID));
    expect(res.status).toBe(500);
    expect(await bodyOf(res)).toEqual({ error: "internal" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("does not leak the thrown error's message in the body", async () => {
    findLetterSpy.mockRejectedValueOnce(new Error("secret-detail"));
    const res = await GET(new Request("http://x/l/secret"), ctx(VALID_ID));
    expect(await res.text()).not.toContain("secret-detail");
  });
});

describe("client-supplied time makes no difference (R6.4)", () => {
  it("stays sealed (403) despite a far-future client Date header", async () => {
    // Row says sealed (dbNow < opensAt). A client Date header far in the future
    // must NOT release the secret.
    findLetterSpy.mockResolvedValueOnce(sealedRow());
    const res = await GET(
      new Request("http://x/l/secret", {
        headers: { Date: "Wed, 01 Jan 2099 00:00:00 GMT" },
      }),
      ctx(VALID_ID),
    );
    expect(res.status).toBe(403);
    const body = (await bodyOf(res)) as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(["opensAt"]);
  });

  it("stays openable (200) despite a far-past client query-string time", async () => {
    // Row says openable (dbNow >= opensAt). A client query time far in the past
    // must NOT withhold the secret.
    findLetterSpy.mockResolvedValueOnce(openableRow());
    const res = await GET(
      new Request(`http://x/l/secret?now=1970-01-01T00:00:00.000Z`),
      ctx(VALID_ID),
    );
    expect(res.status).toBe(200);
    const body = (await bodyOf(res)) as Record<string, unknown>;
    expect(Object.keys(body)).toEqual(["serverSecret"]);
  });
});

// Shared generators for the property tests below.
const timeMs = fc.integer({ min: -8640000000000000, max: 8640000000000000 });
const clientTime = fc.string();
const nonLetterId = fc
  .string()
  .filter((s) => !/^[A-Za-z0-9_-]{21}[AQgw]$/.test(s));

// Feature: 02-sealed-letters, Property 16: the server clock alone decides
// whether the secret is released (200) or withheld (403); a client-supplied
// time is irrelevant, and a sealed response never contains the secret.
describe("Property 16 — the server clock decides GET /api/letters/[id]/secret", () => {
  it("returns 200 {serverSecret} iff dbNow>=opensAt, else 403 {opensAt}, ignoring any client time", async () => {
    await fc.assert(
      fc.asyncProperty(
        timeMs,
        timeMs,
        fc.boolean(),
        clientTime,
        async (opensMs, nowMs, demo, headerDate) => {
          findLetterSpy.mockReset();
          const opensAt = new Date(opensMs);
          const dbNow = new Date(nowMs);
          const secret = Buffer.from(
            Array.from({ length: 32 }, (_, i) => (i * 13 + 1) & 0xff),
          );
          findLetterSpy.mockResolvedValueOnce(
            openableRow({ opensAt, dbNow, demo, serverSecret: secret }),
          );

          const res = await GET(
            new Request("http://x/l/secret", {
              headers: { "X-Client-Now": headerDate },
            }),
            ctx(VALID_ID),
          );
          expect(res.headers.get("Cache-Control")).toBe("no-store");

          const body = (await bodyOf(res)) as Record<string, unknown>;
          if (nowMs >= opensMs) {
            expect(res.status).toBe(200);
            expect(Object.keys(body)).toEqual(["serverSecret"]);
            expect(body.serverSecret).toBe(
              encodeBase64url(new Uint8Array(secret)),
            );
          } else {
            expect(res.status).toBe(403);
            expect(Object.keys(body)).toEqual(["opensAt"]);
            expect(body.opensAt).toBe(opensAt.toISOString());
            // The secret never leaks on a sealed response.
            expect(JSON.stringify(body)).not.toContain(
              encodeBase64url(new Uint8Array(secret)),
            );
          }
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: 02-sealed-letters, Property 17: malformed and unknown IDs are
// indistinguishable — byte-identical 404 body and headers, nothing queried for
// a malformed ID.
describe("Property 17 — 404s are indistinguishable on GET /api/letters/[id]/secret", () => {
  it("returns a byte-identical 404 for any non-letter-id without querying", async () => {
    findLetterSpy.mockReset();
    findLetterSpy.mockResolvedValue(null);
    const canonical = await GET(new Request("http://x/l/secret"), ctx(VALID_ID));
    const canonicalBody = await canonical.clone().text();

    await fc.assert(
      fc.asyncProperty(nonLetterId, async (id) => {
        findLetterSpy.mockClear();
        const res = await GET(new Request("http://x/l/secret"), ctx(id));
        expect(res.status).toBe(404);
        expect(await res.text()).toBe(canonicalBody);
        expect(res.headers.get("Cache-Control")).toBe("no-store");
        expect(res.headers.get("Content-Type")).toBe(
          canonical.headers.get("Content-Type"),
        );
        expect(findLetterSpy).not.toHaveBeenCalled();
        return true;
      }),
      { numRuns: 100 },
    );
  });
});
