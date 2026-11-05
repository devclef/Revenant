/**
 * Tests for the sealing API client (api.ts). They run in the node environment
 * with a replacement `globalThis.fetch` installed AFTER import, which is how the
 * QA stub replaces fetch. Each test checks the request shape (fixed relative
 * path, no-store, same-origin, no-referrer, only the route's fields) and the
 * mapping from status and body to the result.
 */

import { describe, it, expect, afterEach, vi } from "vitest";

import { realSealApi, PREPARE_PATH, SEAL_PATH } from "./api";

const realFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = realFetch;
  vi.restoreAllMocks();
});

function installFetch(response: () => Response | Promise<Response>) {
  const spy = vi.fn(async () => response());
  globalThis.fetch = spy as unknown as typeof fetch;
  return spy;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const PREPARED = {
  letterId: "AAAAAAAAAAAAAAAAAAAAAA",
  serverSecret: "AAAA",
  serverNow: "2026-11-02T10:00:00.000Z",
};

const SEALED = {
  letterId: "AAAAAAAAAAAAAAAAAAAAAA",
  sealedAt: "2026-11-02T10:00:01.000Z",
  opensAt: "2026-11-02T10:00:31.000Z",
  envelopeHash: "a".repeat(64),
};

describe("realSealApi calls the global fetch at call time", () => {
  it("uses a fetch installed after import for prepare", async () => {
    const spy = installFetch(() => json(201, PREPARED));
    const result = await realSealApi.prepare();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true, ...PREPARED });
  });

  it("uses a fetch installed after import for seal", async () => {
    const spy = installFetch(() => json(201, SEALED));
    await realSealApi.seal({ letterId: "L", envelope: { a: 1 }, envelopeHash: "h" });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("request shape", () => {
  it("prepare: fixed path, POST, no-store, same-origin, no-referrer", async () => {
    const spy = installFetch(() => json(201, PREPARED));
    await realSealApi.prepare();
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(PREPARE_PATH);
    expect(init.method).toBe("POST");
    expect(init.cache).toBe("no-store");
    expect(init.credentials).toBe("same-origin");
    expect(init.referrerPolicy).toBe("no-referrer");
  });

  it("seal: fixed path and exactly letterId, envelope and envelopeHash in the body", async () => {
    const spy = installFetch(() => json(201, SEALED));
    await realSealApi.seal({ letterId: "L", envelope: { v: 1 }, envelopeHash: "h" });
    const [url, init] = spy.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(SEAL_PATH);
    expect(init.cache).toBe("no-store");
    expect(init.credentials).toBe("same-origin");
    expect(init.referrerPolicy).toBe("no-referrer");
    expect(Object.keys(JSON.parse(String(init.body))).sort()).toEqual([
      "envelope",
      "envelopeHash",
      "letterId",
    ]);
  });

  it("uses only relative paths under /api/letters/demo/", () => {
    expect(PREPARE_PATH).toBe("/api/letters/demo/prepare");
    expect(SEAL_PATH).toBe("/api/letters/demo/seal");
  });
});

describe("prepare result mapping", () => {
  it("maps 429 to busy", async () => {
    installFetch(() => json(429, { error: "busy" }));
    expect(await realSealApi.prepare()).toEqual({ ok: false, kind: "busy" });
  });

  it("maps 503 to not_configured", async () => {
    installFetch(() => json(503, { error: "not_configured" }));
    expect(await realSealApi.prepare()).toEqual({ ok: false, kind: "not_configured" });
  });

  it("maps 500 to server", async () => {
    installFetch(() => json(500, { error: "internal" }));
    expect(await realSealApi.prepare()).toEqual({ ok: false, kind: "server" });
  });

  it("maps a 201 body that does not match the schema to server", async () => {
    installFetch(() => json(201, { letterId: 3 }));
    expect(await realSealApi.prepare()).toEqual({ ok: false, kind: "server" });
  });

  it("maps a non-JSON 201 body to server", async () => {
    installFetch(() => new Response("not json", { status: 201 }));
    expect(await realSealApi.prepare()).toEqual({ ok: false, kind: "server" });
  });

  it("maps a thrown fetch to network and never throws", async () => {
    installFetch(() => {
      throw new TypeError("offline");
    });
    await expect(realSealApi.prepare()).resolves.toEqual({ ok: false, kind: "network" });
  });
});

describe("seal result mapping", () => {
  it("maps 201 with a valid body to ok", async () => {
    installFetch(() => json(201, SEALED));
    expect(await realSealApi.seal({ letterId: "L", envelope: {}, envelopeHash: "h" })).toEqual({
      ok: true,
      ...SEALED,
    });
  });

  it.each([
    [429, "busy"],
    [422, "clock"],
    [404, "not_found"],
    [400, "invalid"],
    [500, "server"],
    [503, "server"],
  ] as const)("maps %i to %s", async (status, kind) => {
    installFetch(() => json(status, { error: "x" }));
    expect(await realSealApi.seal({ letterId: "L", envelope: {}, envelopeHash: "h" })).toEqual({
      ok: false,
      kind,
    });
  });

  it("maps a 201 body missing opensAt to server", async () => {
    installFetch(() => json(201, { letterId: "L", sealedAt: "x" }));
    expect(await realSealApi.seal({ letterId: "L", envelope: {}, envelopeHash: "h" })).toEqual({
      ok: false,
      kind: "server",
    });
  });

  it("carries a 64-char hex envelopeHash from the body onto an ok result", async () => {
    installFetch(() => json(201, SEALED));
    const result = await realSealApi.seal({ letterId: "L", envelope: {}, envelopeHash: "h" });
    expect(result).toEqual({ ok: true, ...SEALED });
    if (result.ok) expect(result.envelopeHash).toBe("a".repeat(64));
  });

  it("maps a 201 body missing envelopeHash to server", async () => {
    installFetch(() => json(201, { letterId: "L", sealedAt: "x", opensAt: "y" }));
    expect(await realSealApi.seal({ letterId: "L", envelope: {}, envelopeHash: "h" })).toEqual({
      ok: false,
      kind: "server",
    });
  });

  it("maps a 201 body whose envelopeHash is not 64 lowercase hex to server", async () => {
    installFetch(() =>
      json(201, { ...SEALED, envelopeHash: "A".repeat(64) }),
    );
    expect(await realSealApi.seal({ letterId: "L", envelope: {}, envelopeHash: "h" })).toEqual({
      ok: false,
      kind: "server",
    });
    installFetch(() => json(201, { ...SEALED, envelopeHash: "abc" }));
    expect(await realSealApi.seal({ letterId: "L", envelope: {}, envelopeHash: "h" })).toEqual({
      ok: false,
      kind: "server",
    });
  });

  it("maps a thrown fetch to network and never throws", async () => {
    installFetch(() => {
      throw new TypeError("dns");
    });
    await expect(
      realSealApi.seal({ letterId: "L", envelope: {}, envelopeHash: "h" }),
    ).resolves.toEqual({ ok: false, kind: "network" });
  });
});
