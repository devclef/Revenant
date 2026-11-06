// Unit tests for POST /api/letters/prepare with `createDraft` mocked.
//
// Covers the REAL_SEALING flag (every value other than "on" returns 404 and
// creates nothing), that real drafts go to `letter_drafts`, the RP_ID check, the
// 429 busy and 500 mappings, and the 201 shape.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { letterDrafts } from "@/lib/db/schema/letters";
import { LetterStoreError } from "@/lib/letter-store/store";
import type { Draft } from "@/lib/letter-store/drafts";
import { encodeBase64url } from "@/lib/seal-format";

// feature-flags.ts imports `server-only`, which throws outside a server bundle.
vi.mock("server-only", () => ({}));

const createDraftSpy = vi.fn<(...args: unknown[]) => Promise<Draft>>();

vi.mock("@/lib/letter-store/drafts", () => ({
  createDraft: (...args: unknown[]) => createDraftSpy(...args),
}));

import { POST } from "./route";

const URL_UNDER_TEST = "http://x/api/letters/prepare";

function draftFixture(): Draft {
  return {
    letterId: encodeBase64url(new Uint8Array(16).fill(3)),
    serverSecret: new Uint8Array(32).fill(7),
    serverNow: new Date("2026-11-06T14:00:00.123Z"),
  };
}

let previousRpId: string | undefined;
let previousFlag: string | undefined;

beforeEach(() => {
  previousRpId = process.env.RP_ID;
  previousFlag = process.env.REAL_SEALING;
  process.env.RP_ID = "localhost";
  process.env.REAL_SEALING = "on";
  createDraftSpy.mockReset();
  createDraftSpy.mockResolvedValue(draftFixture());
});

afterEach(() => {
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

describe("POST /api/letters/prepare", () => {
  it.each([
    ["unset", undefined],
    ["yes", "yes"],
    ["ON", "ON"],
    ["true", "true"],
    ["1", "1"],
  ])("REAL_SEALING %s gives 404 real_sealing_off and creates no draft", async (_label, value) => {
    if (value === undefined) {
      delete process.env.REAL_SEALING;
    } else {
      process.env.REAL_SEALING = value;
    }
    const res = await POST(new Request(URL_UNDER_TEST, { method: "POST" }));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "real_sealing_off" });
    expect(createDraftSpy).not.toHaveBeenCalled();
  });

  it("creates the draft in letter_drafts and returns 201 with the draft shape", async () => {
    const res = await POST(new Request(URL_UNDER_TEST, { method: "POST" }));
    expect(res.status).toBe(201);
    expect(createDraftSpy).toHaveBeenCalledTimes(1);
    expect(createDraftSpy.mock.calls[0][1]).toBe(letterDrafts);
    const body = await res.json();
    expect(body).toEqual({
      letterId: draftFixture().letterId,
      serverSecret: encodeBase64url(new Uint8Array(32).fill(7)),
      serverNow: "2026-11-06T14:00:00.123Z",
    });
  });

  it("RP_ID unset gives 503 not_configured without touching the database", async () => {
    delete process.env.RP_ID;
    const res = await POST(new Request(URL_UNDER_TEST, { method: "POST" }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "not_configured" });
    expect(createDraftSpy).not.toHaveBeenCalled();
  });

  it("the draft cap gives 429 busy", async () => {
    createDraftSpy.mockRejectedValueOnce(new LetterStoreError("busy"));
    const res = await POST(new Request(URL_UNDER_TEST, { method: "POST" }));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "busy" });
  });

  it("any other failure gives the fixed 500 body without the driver detail", async () => {
    createDraftSpy.mockRejectedValueOnce(new Error("driver detail MARKER-4412"));
    const res = await POST(new Request(URL_UNDER_TEST, { method: "POST" }));
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: "internal" });
    expect(text).not.toContain("MARKER-4412");
  });
});
