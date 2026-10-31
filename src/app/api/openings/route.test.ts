// Unit tests for POST /api/openings with `findLetter` and `insertOpening`
// fully mocked.
//
// These tests pin the design Routes table for the recall-answer endpoint and,
// crucially, the STRICT order the checks run in, so a large or malformed
// request is rejected before any database work and the existence of a letter is
// never revealed to a request that could not have been well-formed:
//
//   1. Content-Length > 100,000            -> 413 {"error":"too_large"}
//   2. body text length > 100,000          -> 413 {"error":"too_large"}
//   3. body is not JSON                     -> 400 invalid_body field="body"
//   4. body fails the Zod shape/field rules -> 400 invalid_body field=<path>
//   5. ciphertext decodes to > 65,536 bytes -> 413 {"error":"too_large"}
//      (65,536 is accepted, 65,537 rejected)
//   6. letterId malformed OR unknown        -> 404 {"error":"not_found"}
//   7. letter not yet openable              -> 403 {opensAt}
//   8. insert succeeds                      -> 201 {openingId,openedAt}
//      any thrown failure                   -> 500 {"error":"internal"}
//
// Also pinned:
//   - R8.3: a validation error names only the failing field, and a random
//     marker value placed in the bad field never appears in the response.
//   - R7.1: an unknown key (e.g. a client-supplied `openedAt`) is stripped, not
//     rejected — it does not make the body invalid.
//   - R7.2: a malformed letterId is a 404, never a 400, and is byte-identical
//     to an unknown-letter 404; nothing is stored in either case.
//   - Every response — success and error — carries `Cache-Control: no-store`.
//
// `findLetter` and `insertOpening` are mocked, so no database is touched.
// `isLetterId`, `decodeBase64url`, `encodeBase64url`, the Zod schema, the clock
// helper and the `http` helpers are the real modules.

import fc from "fast-check";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  LetterRow,
  InsertOpeningArgs,
  InsertOpeningResult,
} from "@/lib/letter-store/queries";
import { encodeBase64url } from "@/lib/seal-format";

const findLetterSpy = vi.fn<(id: string) => Promise<LetterRow | null>>();
const insertOpeningSpy =
  vi.fn<(args: InsertOpeningArgs) => Promise<InsertOpeningResult>>();

vi.mock("@/lib/letter-store/queries", () => ({
  findLetter: (id: string) => findLetterSpy(id),
  insertOpening: (args: InsertOpeningArgs) => insertOpeningSpy(args),
}));

import { POST } from "./route";

// A canonical 22-char letter ID (16 bytes, base64url, final char in [AQgw]).
const VALID_ID = "AAECAwQFBgcICQoLDA0ODw";
// Malformed IDs — isLetterId === false for each.
const MALFORMED_IDS = [
  "", // empty
  "short", // too short
  "AAECAwQFBgcICQoLDA0ODwXX", // too long
  "AAECAwQFBgcICQoLDA0OD!", // out-of-alphabet char
  "AAECAwQFBgcICQoLDA0ODB", // 22 chars but final char not in [AQgw]
];

// A valid unpadded base64url ciphertext (16 bytes) and a valid 12-byte nonce.
const CIPHERTEXT = encodeBase64url(new Uint8Array(16).fill(5));
const NONCE = encodeBase64url(new Uint8Array(12).fill(9));

/** A well-formed request body. Overrides let a single field go bad. */
function validBody(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return { letterId: VALID_ID, ciphertext: CIPHERTEXT, nonce: NONCE, ...overrides };
}

/** Build a POST request with a JSON body (and an optional header override). */
function postJson(
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request("http://x/api/openings", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** An openable letter row: dbNow at or after opensAt. */
function openableRow(overrides: Partial<LetterRow> = {}): LetterRow {
  return {
    id: VALID_ID,
    envelope: JSON.stringify({ formatVersion: 1, ciphertext: "abc" }),
    envelopeHash: "a".repeat(64),
    opensAt: new Date("2024-11-05T00:00:00.000Z"),
    serverSecret: Buffer.alloc(32, 7),
    demo: false,
    dbNow: new Date("2026-11-15T09:30:00.000Z"),
    ...overrides,
  };
}

/** A sealed letter row: dbNow strictly before opensAt. */
function sealedRow(overrides: Partial<LetterRow> = {}): LetterRow {
  return openableRow({
    opensAt: new Date("2027-02-01T00:00:00.000Z"),
    dbNow: new Date("2026-11-15T09:30:00.000Z"),
    ...overrides,
  });
}

/** The 201 insert result a successful opening returns. */
function insertResult(
  overrides: Partial<InsertOpeningResult> = {},
): InsertOpeningResult {
  return {
    openingId: "11111111-2222-3333-4444-555555555555",
    openedAt: new Date("2026-11-15T09:30:01.250Z"),
    ...overrides,
  };
}

async function bodyOf(res: Response): Promise<unknown> {
  return res.json();
}

beforeEach(() => {
  findLetterSpy.mockReset();
  insertOpeningSpy.mockReset();
});

describe("POST /api/openings — 201 on success", () => {
  it("returns 201 with EXACTLY {openingId,openedAt} and stores the record", async () => {
    findLetterSpy.mockResolvedValueOnce(openableRow());
    insertOpeningSpy.mockResolvedValueOnce(insertResult());

    const res = await POST(postJson(validBody()));
    expect(res.status).toBe(201);

    const body = (await bodyOf(res)) as Record<string, unknown>;
    expect(body).toEqual({
      openingId: "11111111-2222-3333-4444-555555555555",
      openedAt: "2026-11-15T09:30:01.250Z",
    });
    expect(Object.keys(body).sort()).toEqual(["openedAt", "openingId"]);
  });

  it("passes the decoded ciphertext and nonce bytes and the row's id/demo to insertOpening", async () => {
    findLetterSpy.mockResolvedValueOnce(openableRow({ demo: true }));
    insertOpeningSpy.mockResolvedValueOnce(insertResult());

    await POST(postJson(validBody()));

    expect(insertOpeningSpy).toHaveBeenCalledTimes(1);
    const arg = insertOpeningSpy.mock.calls[0][0];
    expect(arg.letterId).toBe(VALID_ID);
    expect(arg.demo).toBe(true);
    expect(Array.from(arg.ciphertext)).toEqual(Array(16).fill(5));
    expect(Array.from(arg.nonce)).toEqual(Array(12).fill(9));
  });

  it("gives openedAt as the millisecond-precision UTC ISO string from the server clock", async () => {
    findLetterSpy.mockResolvedValueOnce(openableRow());
    insertOpeningSpy.mockResolvedValueOnce(
      insertResult({ openedAt: new Date(Date.UTC(2026, 10, 15, 9, 30, 1, 7)) }),
    );
    const res = await POST(postJson(validBody()));
    const body = (await bodyOf(res)) as Record<string, unknown>;
    expect(body.openedAt).toBe("2026-11-15T09:30:01.007Z");
    expect(body.openedAt as string).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });

  it("sets Cache-Control: no-store on the 201", async () => {
    findLetterSpy.mockResolvedValueOnce(openableRow());
    insertOpeningSpy.mockResolvedValueOnce(insertResult());
    const res = await POST(postJson(validBody()));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("ignores an unknown openedAt key in the body (R7.1), using the server clock", async () => {
    findLetterSpy.mockResolvedValueOnce(openableRow());
    insertOpeningSpy.mockResolvedValueOnce(insertResult());

    // A client tries to dictate openedAt. It must be stripped, not rejected,
    // and the recorded time comes from the database, not the request.
    const res = await POST(
      postJson(validBody({ openedAt: "1999-01-01T00:00:00.000Z" })),
    );
    expect(res.status).toBe(201);
    const body = (await bodyOf(res)) as Record<string, unknown>;
    expect(body.openedAt).toBe("2026-11-15T09:30:01.250Z");
    // The stripped key never reaches the query layer.
    const arg = insertOpeningSpy.mock.calls[0][0];
    expect(Object.keys(arg)).not.toContain("openedAt");
  });
});

describe("413 — too large, checked before anything else", () => {
  it("returns 413 when Content-Length exceeds 100,000 — before reading the body", async () => {
    const res = await POST(
      postJson(validBody(), { "Content-Length": "100001" }),
    );
    expect(res.status).toBe(413);
    expect(await bodyOf(res)).toEqual({ error: "too_large" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    // Rejected before any database work.
    expect(findLetterSpy).not.toHaveBeenCalled();
    expect(insertOpeningSpy).not.toHaveBeenCalled();
  });

  it("returns 413 when the body text exceeds 100,000 characters", async () => {
    // Oversized body text regardless of the (unset/short) Content-Length.
    const huge = "x".repeat(100_001);
    const res = await POST(postJson(huge));
    expect(res.status).toBe(413);
    expect(await bodyOf(res)).toEqual({ error: "too_large" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(findLetterSpy).not.toHaveBeenCalled();
  });

  it("returns 413 when the ciphertext decodes to 65,537 bytes", async () => {
    // 65,537 bytes is one over the limit. Build a valid base64url string of
    // that exact byte length, so it passes the Zod base64url refinement and is
    // rejected only by the explicit ciphertext size check.
    const over = encodeBase64url(new Uint8Array(65_537).fill(1));
    const res = await POST(postJson(validBody({ ciphertext: over })));
    expect(res.status).toBe(413);
    expect(await bodyOf(res)).toEqual({ error: "too_large" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    // The letter is never looked up for an oversized ciphertext.
    expect(findLetterSpy).not.toHaveBeenCalled();
    expect(insertOpeningSpy).not.toHaveBeenCalled();
  });

  it("accepts a ciphertext that decodes to exactly 65,536 bytes (boundary)", async () => {
    const atLimit = encodeBase64url(new Uint8Array(65_536).fill(1));
    findLetterSpy.mockResolvedValueOnce(openableRow());
    insertOpeningSpy.mockResolvedValueOnce(insertResult());

    const res = await POST(postJson(validBody({ ciphertext: atLimit })));
    expect(res.status).toBe(201);
    const arg = insertOpeningSpy.mock.calls[0][0];
    expect(arg.ciphertext.length).toBe(65_536);
  });
});

describe("400 — invalid body", () => {
  it('returns 400 invalid_body field="body" for a non-JSON body', async () => {
    const res = await POST(postJson("this is not json {"));
    expect(res.status).toBe(400);
    expect(await bodyOf(res)).toEqual({ error: "invalid_body", field: "body" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(findLetterSpy).not.toHaveBeenCalled();
  });

  it("returns 400 with field from the Zod path for a missing required field", async () => {
    const { ciphertext: _omitted, ...withoutCiphertext } = validBody();
    void _omitted;
    const res = await POST(postJson(withoutCiphertext));
    expect(res.status).toBe(400);
    const body = (await bodyOf(res)) as Record<string, unknown>;
    expect(body.error).toBe("invalid_body");
    expect(body.field).toBe("ciphertext");
  });

  it("returns 400 field=ciphertext for a non-base64url ciphertext", async () => {
    const res = await POST(postJson(validBody({ ciphertext: "not valid !!!" })));
    expect(res.status).toBe(400);
    const body = (await bodyOf(res)) as Record<string, unknown>;
    expect(body.error).toBe("invalid_body");
    expect(body.field).toBe("ciphertext");
  });

  it("returns 400 field=ciphertext for an empty ciphertext (decodes to 0 bytes)", async () => {
    const res = await POST(postJson(validBody({ ciphertext: "" })));
    expect(res.status).toBe(400);
    const body = (await bodyOf(res)) as Record<string, unknown>;
    expect(body.field).toBe("ciphertext");
  });

  it("returns 400 field=nonce when the nonce does not decode to exactly 12 bytes", async () => {
    // 16 bytes, valid base64url, but the wrong length for an AES-GCM nonce.
    const wrongNonce = encodeBase64url(new Uint8Array(16).fill(3));
    const res = await POST(postJson(validBody({ nonce: wrongNonce })));
    expect(res.status).toBe(400);
    const body = (await bodyOf(res)) as Record<string, unknown>;
    expect(body.field).toBe("nonce");
  });

  it("returns 400 field=nonce for a non-base64url nonce", async () => {
    const res = await POST(postJson(validBody({ nonce: "!!!!" })));
    expect(res.status).toBe(400);
    const body = (await bodyOf(res)) as Record<string, unknown>;
    expect(body.field).toBe("nonce");
  });

  it("sets Cache-Control: no-store on every 400", async () => {
    const res = await POST(postJson(validBody({ ciphertext: "!!!" })));
    expect(res.status).toBe(400);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("never echoes a submitted value in the error — a marker in the bad field does not leak (R8.3)", async () => {
    // Put a distinctive marker as the value of the bad field. It must appear
    // nowhere in the response: the error names only the field, never its value.
    const marker = "SENTINEL_MARKER_9f3c2a_do_not_leak";
    const res = await POST(postJson(validBody({ ciphertext: marker })));
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(text).not.toContain(marker);
    // The field name is present; the value is not.
    expect(text).toContain("ciphertext");
  });
});

describe("404 — letterId malformed or unknown (R7.2), indistinguishable", () => {
  it("returns 404 (not 400) for a malformed letterId, storing nothing", async () => {
    for (const id of MALFORMED_IDS) {
      const res = await POST(postJson(validBody({ letterId: id })));
      expect(res.status).toBe(404);
      expect(await bodyOf(res)).toEqual({ error: "not_found" });
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    }
    // A malformed ID never reaches the database, and nothing is stored.
    expect(findLetterSpy).not.toHaveBeenCalled();
    expect(insertOpeningSpy).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown (valid-shape) letterId, storing nothing", async () => {
    findLetterSpy.mockResolvedValueOnce(null);
    const res = await POST(postJson(validBody()));
    expect(res.status).toBe(404);
    expect(await bodyOf(res)).toEqual({ error: "not_found" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(insertOpeningSpy).not.toHaveBeenCalled();
  });

  it("the malformed 404 and the unknown 404 are byte-identical", async () => {
    findLetterSpy.mockResolvedValueOnce(null);
    const unknownRes = await POST(postJson(validBody()));
    const malformedRes = await POST(postJson(validBody({ letterId: "!!!" })));

    expect(unknownRes.status).toBe(malformedRes.status);
    expect(await unknownRes.text()).toBe(await malformedRes.text());
    expect(unknownRes.headers.get("Cache-Control")).toBe(
      malformedRes.headers.get("Cache-Control"),
    );
    expect(unknownRes.headers.get("Content-Type")).toBe(
      malformedRes.headers.get("Content-Type"),
    );
  });

  it("a malformed letterId is a 404 even though the rest of the body is valid (not a 400)", async () => {
    const res = await POST(postJson(validBody({ letterId: "short" })));
    expect(res.status).toBe(404);
    expect(await bodyOf(res)).toEqual({ error: "not_found" });
  });
});

describe("403 — letter not yet openable", () => {
  it("returns 403 with EXACTLY {opensAt} before opens_at, storing nothing", async () => {
    findLetterSpy.mockResolvedValueOnce(sealedRow());
    const res = await POST(postJson(validBody()));
    expect(res.status).toBe(403);
    const body = (await bodyOf(res)) as Record<string, unknown>;
    expect(body).toEqual({ opensAt: "2027-02-01T00:00:00.000Z" });
    expect(Object.keys(body)).toEqual(["opensAt"]);
    expect(insertOpeningSpy).not.toHaveBeenCalled();
  });

  it("sets Cache-Control: no-store on the 403", async () => {
    findLetterSpy.mockResolvedValueOnce(sealedRow());
    const res = await POST(postJson(validBody()));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("decides openability from row.dbNow only, not a client Date header", async () => {
    // Sealed row; a far-future client Date must not let the opening through.
    findLetterSpy.mockResolvedValueOnce(sealedRow());
    const res = await POST(
      postJson(validBody(), { Date: "Wed, 01 Jan 2099 00:00:00 GMT" }),
    );
    expect(res.status).toBe(403);
    expect(insertOpeningSpy).not.toHaveBeenCalled();
  });
});

describe("500 — unexpected failure", () => {
  it('returns a fixed 500 {"error":"internal"} with no-store when findLetter throws', async () => {
    findLetterSpy.mockRejectedValueOnce(
      new Error("driver-detail-that-must-not-leak"),
    );
    const res = await POST(postJson(validBody()));
    expect(res.status).toBe(500);
    expect(await bodyOf(res)).toEqual({ error: "internal" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it('returns a fixed 500 {"error":"internal"} when insertOpening throws', async () => {
    findLetterSpy.mockResolvedValueOnce(openableRow());
    insertOpeningSpy.mockRejectedValueOnce(new Error("insert-secret-detail"));
    const res = await POST(postJson(validBody()));
    expect(res.status).toBe(500);
    expect(await bodyOf(res)).toEqual({ error: "internal" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("does not leak the thrown error's message in the body", async () => {
    findLetterSpy.mockRejectedValueOnce(new Error("secret-detail"));
    const res = await POST(postJson(validBody()));
    expect(await res.text()).not.toContain("secret-detail");
  });
});

describe("check ORDER is strict", () => {
  it("prefers 413 (Content-Length) over an otherwise-invalid body", async () => {
    // The body is invalid JSON AND oversized by Content-Length. Size wins.
    const res = await POST(
      postJson("not json", { "Content-Length": "100001" }),
    );
    expect(res.status).toBe(413);
    expect(await bodyOf(res)).toEqual({ error: "too_large" });
  });

  it("prefers 400 invalid_body over the 404/403/201 letter checks", async () => {
    // A bad body must be rejected before the letter is ever looked up.
    const res = await POST(postJson(validBody({ nonce: "!!!" })));
    expect(res.status).toBe(400);
    expect(findLetterSpy).not.toHaveBeenCalled();
  });

  it("prefers the 413 oversized-ciphertext check over the 404 letter check", async () => {
    const over = encodeBase64url(new Uint8Array(65_537).fill(1));
    findLetterSpy.mockResolvedValueOnce(null);
    const res = await POST(postJson(validBody({ ciphertext: over })));
    expect(res.status).toBe(413);
    expect(findLetterSpy).not.toHaveBeenCalled();
  });

  it("prefers the 404 letter check over the 403 openability check", async () => {
    // Unknown letter: 404, never reaching the openability decision.
    findLetterSpy.mockResolvedValueOnce(null);
    const res = await POST(postJson(validBody()));
    expect(res.status).toBe(404);
  });
});

// Shared generators for the property tests below.
const timeMs = fc.integer({ min: -8640000000000000, max: 8640000000000000 });
const clientTime = fc.string();
const nonLetterId = fc
  .string()
  .filter((s) => !/^[A-Za-z0-9_-]{21}[AQgw]$/.test(s));

// Feature: 02-sealed-letters, Property 16: the server clock alone decides
// whether an opening is recorded; a client-supplied time is irrelevant, and
// insertOpening runs only when dbNow>=opensAt.
describe("Property 16 — the server clock decides POST /api/openings", () => {
  it("records only when dbNow>=opensAt (else 403 {opensAt}), ignoring any client time", async () => {
    await fc.assert(
      fc.asyncProperty(
        timeMs,
        timeMs,
        fc.boolean(),
        clientTime,
        async (opensMs, nowMs, demo, headerDate) => {
          findLetterSpy.mockReset();
          insertOpeningSpy.mockReset();
          const opensAt = new Date(opensMs);
          const dbNow = new Date(nowMs);
          findLetterSpy.mockResolvedValueOnce(
            openableRow({ opensAt, dbNow, demo }),
          );
          insertOpeningSpy.mockResolvedValueOnce(insertResult());

          const res = await POST(
            postJson(validBody(), { "X-Client-Now": headerDate }),
          );
          expect(res.headers.get("Cache-Control")).toBe("no-store");

          const body = (await bodyOf(res)) as Record<string, unknown>;
          if (nowMs >= opensMs) {
            expect(res.status).toBe(201);
            expect(Object.keys(body).sort()).toEqual([
              "openedAt",
              "openingId",
            ]);
            expect(insertOpeningSpy).toHaveBeenCalledTimes(1);
          } else {
            expect(res.status).toBe(403);
            expect(Object.keys(body)).toEqual(["opensAt"]);
            expect(body.opensAt).toBe(opensAt.toISOString());
            // Nothing is recorded before the opening date.
            expect(insertOpeningSpy).not.toHaveBeenCalled();
          }
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: 02-sealed-letters, Property 17: malformed and unknown IDs are
// indistinguishable — byte-identical 404 body and headers — and nothing is ever
// stored.
describe("Property 17 — 404s are indistinguishable on POST /api/openings", () => {
  it("returns a byte-identical 404 for any non-letter-id, storing nothing", async () => {
    // The canonical 404 against a known-unknown valid ID.
    findLetterSpy.mockReset();
    insertOpeningSpy.mockReset();
    findLetterSpy.mockResolvedValue(null);
    const canonical = await POST(postJson(validBody()));
    const canonicalBody = await canonical.clone().text();

    await fc.assert(
      fc.asyncProperty(nonLetterId, async (id) => {
        findLetterSpy.mockClear();
        insertOpeningSpy.mockClear();
        const res = await POST(postJson(validBody({ letterId: id })));
        expect(res.status).toBe(404);
        expect(await res.text()).toBe(canonicalBody);
        expect(res.headers.get("Cache-Control")).toBe("no-store");
        expect(res.headers.get("Content-Type")).toBe(
          canonical.headers.get("Content-Type"),
        );
        // A malformed ID is never looked up and never stored.
        expect(findLetterSpy).not.toHaveBeenCalled();
        expect(insertOpeningSpy).not.toHaveBeenCalled();
        return true;
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: 02-sealed-letters, Property 18: an invalid opening body is a 400
// naming only the failing field, and the submitted value (a random marker)
// never appears in the response. The letter is never looked up and nothing is
// stored.
describe("Property 18 — invalid opening bodies name the field and never echo it", () => {
  it("returns 400 field=ciphertext for any non-base64url ciphertext, marker absent, nothing queried", async () => {
    await fc.assert(
      fc.asyncProperty(
        // A marker that cannot be valid base64url (contains a space and '!').
        fc.string().map((s) => `!! ${s} !!`),
        async (marker) => {
          findLetterSpy.mockReset();
          insertOpeningSpy.mockReset();
          const res = await POST(postJson(validBody({ ciphertext: marker })));
          expect(res.status).toBe(400);
          const text = await res.text();
          const parsed = JSON.parse(text) as Record<string, unknown>;
          expect(parsed.error).toBe("invalid_body");
          expect(parsed.field).toBe("ciphertext");
          // The submitted value is never echoed back (R8.3).
          expect(text).not.toContain(marker);
          // A bad body is rejected before any letter lookup or store.
          expect(findLetterSpy).not.toHaveBeenCalled();
          expect(insertOpeningSpy).not.toHaveBeenCalled();
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("returns 400 field=nonce for any nonce not decoding to 12 bytes, marker absent, nothing queried", async () => {
    await fc.assert(
      fc.asyncProperty(
        // A valid base64url string of a byte length that is never 12, so the
        // nonce refinement fails. 0..11 and 13..32 bytes, encoded.
        fc
          .integer({ min: 0, max: 32 })
          .filter((n) => n !== 12)
          .map((n) => encodeBase64url(new Uint8Array(n).fill(3))),
        async (badNonce) => {
          findLetterSpy.mockReset();
          insertOpeningSpy.mockReset();
          const res = await POST(postJson(validBody({ nonce: badNonce })));
          expect(res.status).toBe(400);
          const parsed = (await bodyOf(res)) as Record<string, unknown>;
          expect(parsed.error).toBe("invalid_body");
          expect(parsed.field).toBe("nonce");
          expect(findLetterSpy).not.toHaveBeenCalled();
          expect(insertOpeningSpy).not.toHaveBeenCalled();
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });
});
