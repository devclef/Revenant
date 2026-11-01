// Unit tests for POST /api/letters/demo/prepare with `createDraft` mocked.
//
// These pin the design table: 503 with no database call when RP_ID is unset,
// 429 busy for the draft cap, 500 for anything else, 201 with the shape on
// success, a body that is never read, and a leak check that keeps the server
// secret out of responses and console output.
//
// The draft cap boundary (1,000 vs 1,001 drafts), expiry cleanup, expired
// drafts not counting, and ID-collision retry need real database or fake-tx
// behaviour. They are covered by `src/lib/letter-store/drafts.test.ts` and by
// the Postgres suite in `src/test/integration/live-letters.test.ts`.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodeBase64url, isLetterId } from "@/lib/seal-format";
import { LetterStoreError } from "@/lib/letter-store/store";
import type { Draft } from "@/lib/letter-store/drafts";

const createDraftSpy = vi.fn<() => Promise<Draft>>();

vi.mock("@/lib/letter-store/drafts", () => ({
  createDraft: () => createDraftSpy(),
}));

import { POST } from "./route";

/** A valid draft: a 22-char letter ID, a 32-byte secret and a server clock read. */
function draftFixture(): Draft {
  return {
    letterId: encodeBase64url(new Uint8Array(16).fill(3)),
    serverSecret: new Uint8Array(32).fill(7),
    serverNow: new Date("2026-11-01T21:00:00.123Z"),
  };
}

const URL_UNDER_TEST = "http://x/api/letters/demo/prepare";

/** A POST request with an optional body. */
function prepareRequest(body?: string): Request {
  return new Request(URL_UNDER_TEST, { method: "POST", body });
}

let previousRpId: string | undefined;
let logSpies: ReturnType<typeof vi.spyOn>[];

beforeEach(() => {
  previousRpId = process.env.RP_ID;
  process.env.RP_ID = "localhost";
  createDraftSpy.mockReset();
  logSpies = [
    vi.spyOn(console, "log").mockImplementation(() => undefined),
    vi.spyOn(console, "error").mockImplementation(() => undefined),
    vi.spyOn(console, "warn").mockImplementation(() => undefined),
    vi.spyOn(console, "info").mockImplementation(() => undefined),
    vi.spyOn(console, "debug").mockImplementation(() => undefined),
  ];
});

afterEach(() => {
  if (previousRpId === undefined) {
    delete process.env.RP_ID;
  } else {
    process.env.RP_ID = previousRpId;
  }
  for (const spy of logSpies) {
    spy.mockRestore();
  }
});

describe("POST /api/letters/demo/prepare", () => {
  it("returns 201 with the letter ID, the 43-char secret and the server time", async () => {
    createDraftSpy.mockResolvedValueOnce(draftFixture());

    const res = await POST(prepareRequest());
    expect(res.status).toBe(201);

    const body = (await res.json()) as {
      letterId: string;
      serverSecret: string;
      serverNow: string;
    };
    expect(Object.keys(body).sort()).toEqual(["letterId", "serverNow", "serverSecret"]);
    expect(isLetterId(body.letterId)).toBe(true);
    expect(body.serverSecret).toHaveLength(43);
    expect(body.serverSecret).toBe(encodeBase64url(new Uint8Array(32).fill(7)));
    expect(body.serverNow).toBe("2026-11-01T21:00:00.123Z");
  });

  it("sends Cache-Control: no-store on success", async () => {
    createDraftSpy.mockResolvedValueOnce(draftFixture());
    const res = await POST(prepareRequest());
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("returns 503 not_configured and makes no database call when RP_ID is unset", async () => {
    delete process.env.RP_ID;
    const res = await POST(prepareRequest());

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "not_configured" });
    expect(createDraftSpy).not.toHaveBeenCalled();
  });

  it("returns 503 not_configured when RP_ID is only whitespace", async () => {
    process.env.RP_ID = "   ";
    const res = await POST(prepareRequest());

    expect(res.status).toBe(503);
    expect(createDraftSpy).not.toHaveBeenCalled();
  });

  it("returns 429 busy when createDraft reports the draft cap", async () => {
    createDraftSpy.mockRejectedValueOnce(new LetterStoreError("busy"));
    const res = await POST(prepareRequest());

    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "busy" });
  });

  it("returns 500 internal for any other failure", async () => {
    createDraftSpy.mockRejectedValueOnce(new Error("The draft could not be created."));
    const res = await POST(prepareRequest());

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "internal" });
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("ignores the request body, even when it is not JSON", async () => {
    createDraftSpy.mockResolvedValueOnce(draftFixture());
    const res = await POST(prepareRequest("{not json"));

    expect(res.status).toBe(201);
    expect(createDraftSpy).toHaveBeenCalledTimes(1);
  });

  it("keeps the server secret out of the response and console output when the database fails", async () => {
    const secret = encodeBase64url(new Uint8Array(32).fill(7));
    // A driver-style failure whose message echoes the secret. The route must
    // turn it into the fixed 500 body without repeating any part of it.
    createDraftSpy.mockRejectedValueOnce(
      new Error(`duplicate key detail: ${secret}`),
    );

    const res = await POST(prepareRequest());
    const text = await res.text();

    expect(res.status).toBe(500);
    expect(text).not.toContain(secret);
    expect(text).toBe('{"error":"internal"}');
    for (const spy of logSpies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});
