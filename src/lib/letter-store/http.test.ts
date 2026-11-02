// Unit tests for the server-only HTTP response helpers.
//
// `json` is the single way the letter, secret and openings routes emit a
// response, so these tests pin the two invariants every route relies on:
//   - `Content-Type: application/json` and `Cache-Control: no-store` are set on
//     EVERY response, success and error alike (R6.10, R7.5).
//   - The status code is passed through unchanged.
//
// The fixed error bodies (NOT_FOUND, INTERNAL, TOO_LARGE, invalidBody) are the
// single source of truth for every error the routes return. These tests pin
// their exact serialised JSON so a malformed ID and an unknown ID return
// byte-identical `not_found` bodies wherever they appear (Property 17).

import { describe, expect, it } from "vitest";

import {
  BUSY,
  HASH_MISMATCH,
  INTERNAL,
  INVALID_ENVELOPE,
  invalidBody,
  json,
  LOCK_OUT_OF_RANGE,
  NOT_CONFIGURED,
  NOT_FOUND,
  TOO_LARGE,
} from "./http";

describe("json", () => {
  it("sets Content-Type application/json and Cache-Control no-store on a success status", async () => {
    const res = json(200, { status: "ok" });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    await expect(res.json()).resolves.toEqual({ status: "ok" });
  });

  it("sets Content-Type application/json and Cache-Control no-store on an error status", async () => {
    const res = json(404, NOT_FOUND);
    expect(res.status).toBe(404);
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    await expect(res.json()).resolves.toEqual({ error: "not_found" });
  });

  it("passes the status code through unchanged", () => {
    expect(json(200, {}).status).toBe(200);
    expect(json(400, {}).status).toBe(400);
    expect(json(403, {}).status).toBe(403);
    expect(json(404, {}).status).toBe(404);
    expect(json(413, {}).status).toBe(413);
    expect(json(500, {}).status).toBe(500);
  });

  it("sets Cache-Control no-store on a 500 error response too", () => {
    const res = json(500, INTERNAL);
    expect(res.status).toBe(500);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

describe("fixed error bodies serialise to the exact expected JSON", () => {
  it("NOT_FOUND", () => {
    expect(JSON.stringify(NOT_FOUND)).toBe('{"error":"not_found"}');
  });

  it("INTERNAL", () => {
    expect(JSON.stringify(INTERNAL)).toBe('{"error":"internal"}');
  });

  it("TOO_LARGE", () => {
    expect(JSON.stringify(TOO_LARGE)).toBe('{"error":"too_large"}');
  });

  it("BUSY", () => {
    expect(JSON.stringify(BUSY)).toBe('{"error":"busy"}');
  });

  it("NOT_CONFIGURED", () => {
    expect(JSON.stringify(NOT_CONFIGURED)).toBe('{"error":"not_configured"}');
  });

  it("INVALID_ENVELOPE", () => {
    expect(JSON.stringify(INVALID_ENVELOPE)).toBe('{"error":"invalid_envelope"}');
  });

  it("HASH_MISMATCH", () => {
    expect(JSON.stringify(HASH_MISMATCH)).toBe('{"error":"hash_mismatch"}');
  });

  it("LOCK_OUT_OF_RANGE", () => {
    expect(JSON.stringify(LOCK_OUT_OF_RANGE)).toBe('{"error":"lock_out_of_range"}');
  });

  it("invalidBody carries the field name", () => {
    expect(JSON.stringify(invalidBody("answers"))).toBe(
      '{"error":"invalid_body","field":"answers"}',
    );
    expect(JSON.stringify(invalidBody("letterId"))).toBe(
      '{"error":"invalid_body","field":"letterId"}',
    );
  });

  it("the serialised body reaching the client matches the fixed constant", async () => {
    const res = json(404, NOT_FOUND);
    await expect(res.text()).resolves.toBe('{"error":"not_found"}');
  });
});

describe("fixed error bodies are frozen (byte-identical on reuse)", () => {
  it("the error constants cannot be mutated in place", () => {
    expect(Object.isFrozen(NOT_FOUND)).toBe(true);
    expect(Object.isFrozen(INTERNAL)).toBe(true);
    expect(Object.isFrozen(TOO_LARGE)).toBe(true);
    expect(Object.isFrozen(invalidBody("x"))).toBe(true);
    expect(Object.isFrozen(BUSY)).toBe(true);
    expect(Object.isFrozen(NOT_CONFIGURED)).toBe(true);
    expect(Object.isFrozen(INVALID_ENVELOPE)).toBe(true);
    expect(Object.isFrozen(HASH_MISMATCH)).toBe(true);
    expect(Object.isFrozen(LOCK_OUT_OF_RANGE)).toBe(true);
  });
});
