// Unit tests for GET /api/letters/[id] with `findLetter` fully mocked.
//
// These tests pin the design Routes table for the letter status endpoint:
//   - Sealed (now < opensAt): 200 with EXACTLY {status,opensAt,demo}, revealing
//     nothing about the contents (R6.1).
//   - Openable (now >= opensAt): 200 with EXACTLY
//     {status,opensAt,demo,envelope,envelopeHash} (R6.2).
//   - `demo` reflects the source table per row.
//   - `opensAt` is the millisecond-precision UTC ISO string.
//   - Malformed and unknown IDs return the byte-identical 404 body and headers
//     (Property 17), so the two cannot be told apart.
//   - Every response — 200, 404 and 500 — carries `Cache-Control: no-store`
//     (R6.10).
//   - A thrown failure becomes a fixed 500 {"error":"internal"} (R8.6).
//   - The open/sealed decision uses the database `now()` (row.dbNow) only; a
//     client-supplied time (Date header, query string) never changes it
//     (R6.4, R6.5).
//
// `findLetter` is mocked, so no database is touched. `isLetterId`, `isOpenable`
// and the `http` helpers are the real modules.

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LetterRow } from "@/lib/letter-store/queries";

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

describe("GET /api/letters/[id] — sealed letter", () => {
  it("returns 200 with EXACTLY {status,opensAt,demo} before the opening date", async () => {
    findLetterSpy.mockResolvedValueOnce(sealedRow({ demo: false }));

    const res = await GET(new Request("http://x/l"), ctx(VALID_ID));
    expect(res.status).toBe(200);

    const body = (await bodyOf(res)) as Record<string, unknown>;
    expect(body).toEqual({
      status: "sealed",
      opensAt: "2027-02-01T00:00:00.000Z",
      demo: false,
    });
    // No envelope or hash leaks before the opening date.
    expect(Object.keys(body).sort()).toEqual(["demo", "opensAt", "status"]);
  });

  it("carries the demo flag from the row", async () => {
    findLetterSpy.mockResolvedValueOnce(sealedRow({ demo: true }));
    const res = await GET(new Request("http://x/l"), ctx(VALID_ID));
    const body = (await bodyOf(res)) as Record<string, unknown>;
    expect(body.demo).toBe(true);
  });

  it("sets Cache-Control: no-store", async () => {
    findLetterSpy.mockResolvedValueOnce(sealedRow());
    const res = await GET(new Request("http://x/l"), ctx(VALID_ID));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("GET /api/letters/[id] — openable letter", () => {
  it("returns 200 with EXACTLY {status,opensAt,demo,envelope,envelopeHash}", async () => {
    const envelope = { formatVersion: 1, ciphertext: "abc" };
    findLetterSpy.mockResolvedValueOnce(
      openableRow({
        envelope: JSON.stringify(envelope),
        envelopeHash: "b".repeat(64),
        demo: false,
      }),
    );

    const res = await GET(new Request("http://x/l"), ctx(VALID_ID));
    expect(res.status).toBe(200);

    const body = (await bodyOf(res)) as Record<string, unknown>;
    expect(body).toEqual({
      status: "openable",
      opensAt: "2024-11-05T00:00:00.000Z",
      demo: false,
      envelope,
      envelopeHash: "b".repeat(64),
    });
    expect(Object.keys(body).sort()).toEqual([
      "demo",
      "envelope",
      "envelopeHash",
      "opensAt",
      "status",
    ]);
  });

  it("parses the stored canonical JSON envelope back to its values", async () => {
    const envelope = { formatVersion: 1, nested: { a: [1, 2, 3] }, s: "x" };
    findLetterSpy.mockResolvedValueOnce(
      openableRow({ envelope: JSON.stringify(envelope) }),
    );
    const res = await GET(new Request("http://x/l"), ctx(VALID_ID));
    const body = (await bodyOf(res)) as Record<string, unknown>;
    expect(body.envelope).toEqual(envelope);
  });

  it("treats now exactly equal to opensAt as open (R6.5)", async () => {
    const instant = new Date("2025-06-01T12:00:00.000Z");
    findLetterSpy.mockResolvedValueOnce(
      openableRow({ opensAt: instant, dbNow: new Date(instant.getTime()) }),
    );
    const res = await GET(new Request("http://x/l"), ctx(VALID_ID));
    const body = (await bodyOf(res)) as Record<string, unknown>;
    expect(body.status).toBe("openable");
  });

  it("carries the demo flag from the row", async () => {
    findLetterSpy.mockResolvedValueOnce(openableRow({ demo: true }));
    const res = await GET(new Request("http://x/l"), ctx(VALID_ID));
    const body = (await bodyOf(res)) as Record<string, unknown>;
    expect(body.demo).toBe(true);
  });

  it("sets Cache-Control: no-store", async () => {
    findLetterSpy.mockResolvedValueOnce(openableRow());
    const res = await GET(new Request("http://x/l"), ctx(VALID_ID));
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("opensAt format", () => {
  it("is always the millisecond-precision UTC ISO string", async () => {
    findLetterSpy.mockResolvedValueOnce(
      sealedRow({ opensAt: new Date(Date.UTC(2027, 1, 1, 3, 4, 5, 678)) }),
    );
    const res = await GET(new Request("http://x/l"), ctx(VALID_ID));
    const body = (await bodyOf(res)) as Record<string, unknown>;
    expect(body.opensAt).toBe("2027-02-01T03:04:05.678Z");
    expect(body.opensAt as string).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    );
  });
});

describe("404 — malformed and unknown IDs are indistinguishable (Property 17)", () => {
  it("returns a byte-identical 404 for every malformed ID without querying", async () => {
    for (const id of MALFORMED_IDS) {
      const res = await GET(new Request("http://x/l"), ctx(id));
      expect(res.status).toBe(404);
      expect(await bodyOf(res)).toEqual({ error: "not_found" });
      expect(res.headers.get("Cache-Control")).toBe("no-store");
    }
    // A malformed ID never reaches the database.
    expect(findLetterSpy).not.toHaveBeenCalled();
  });

  it("returns the same 404 body and headers for an unknown (valid-shape) ID", async () => {
    findLetterSpy.mockResolvedValueOnce(null);
    const res = await GET(new Request("http://x/l"), ctx(VALID_ID));
    expect(res.status).toBe(404);
    expect(await bodyOf(res)).toEqual({ error: "not_found" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("the malformed 404 and the unknown 404 are byte-identical", async () => {
    findLetterSpy.mockResolvedValueOnce(null);
    const unknownRes = await GET(new Request("http://x/l"), ctx(VALID_ID));
    const malformedRes = await GET(new Request("http://x/l"), ctx("!!!"));

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
  it("returns a fixed 500 {\"error\":\"internal\"} with no-store when findLetter throws", async () => {
    findLetterSpy.mockRejectedValueOnce(
      new Error("some-driver-detail-that-must-not-leak"),
    );
    const res = await GET(new Request("http://x/l"), ctx(VALID_ID));
    expect(res.status).toBe(500);
    expect(await bodyOf(res)).toEqual({ error: "internal" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("does not leak the thrown error's message in the body", async () => {
    findLetterSpy.mockRejectedValueOnce(new Error("secret-detail"));
    const res = await GET(new Request("http://x/l"), ctx(VALID_ID));
    expect(await res.text()).not.toContain("secret-detail");
  });
});

describe("client-supplied time makes no difference (R6.4)", () => {
  it("decides sealed/open from row.dbNow regardless of a Date header", async () => {
    // Row says sealed (dbNow < opensAt). A client Date header far in the future
    // must NOT flip it to openable.
    findLetterSpy.mockResolvedValueOnce(sealedRow());
    const res = await GET(
      new Request("http://x/l", {
        headers: { Date: "Wed, 01 Jan 2099 00:00:00 GMT" },
      }),
      ctx(VALID_ID),
    );
    const body = (await bodyOf(res)) as Record<string, unknown>;
    expect(body.status).toBe("sealed");
  });

  it("decides sealed/open from row.dbNow regardless of a query string time", async () => {
    // Row says openable (dbNow >= opensAt). A client query time far in the past
    // must NOT flip it to sealed.
    findLetterSpy.mockResolvedValueOnce(openableRow());
    const res = await GET(
      new Request(`http://x/l?now=1970-01-01T00:00:00.000Z`),
      ctx(VALID_ID),
    );
    const body = (await bodyOf(res)) as Record<string, unknown>;
    expect(body.status).toBe("openable");
  });
});
