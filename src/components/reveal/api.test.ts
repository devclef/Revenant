/**
 * Tests for the client API wrapper (api.ts).
 *
 * These run in the node environment with a stubbed `global.fetch`. There is no
 * real network: a guard fails any unstubbed call, so a test that forgets to
 * arm a response fails loudly rather than reaching out. Each test arms exactly
 * the responses the call under test should make, in order, then asserts both
 * the request the wrapper sent (URL, method, body, no-store/same-origin/
 * no-referrer options) and the outcome it mapped the response to.
 *
 * The assertions follow the task and design.md "Error Handling":
 * - Every request URL starts with `/api/` (no origin, no cross-origin call).
 * - The only POST is `postOpening`, and its body has exactly the keys
 *   `letterId`, `ciphertext`, `nonce` — nothing else.
 * - `getLetter`: 200 sealed -> `sealed`; 200 openable -> `openable`;
 *   404 -> `not_placed`; a thrown fetch, a 5xx, another 4xx, or a body that
 *   does not match the schema -> `unreachable`.
 * - `getSecret`: 403 (well-formed) -> `forbidden` with `opensAt`; 200
 *   (well-formed) -> `ok`; a thrown fetch, a 5xx, another non-200, a 403 whose
 *   body does not match, or a 200 body that does not match -> `unreachable`.
 * - `postOpening`: 201 -> `ok`; anything else or a thrown fetch -> `failed`.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getLetter, getSecret, postOpening } from "./api";

// --- fetch stub --------------------------------------------------------------

/** One armed response: the status and the JSON body `.json()` should resolve
 * to. `throws` makes the fetch call itself reject (offline/DNS/abort), and
 * `nonJson` makes `.json()` reject (a body that is not JSON at all). */
type ArmedResponse =
  | { kind: "json"; status: number; body: unknown }
  | { kind: "nonJson"; status: number }
  | { kind: "throws" };

/** Every call fetch received, for request-shape assertions. */
type RecordedCall = { url: string; init: RequestInit | undefined };

let armed: ArmedResponse[] = [];
let calls: RecordedCall[] = [];

function makeResponse(armedResponse: ArmedResponse): Response {
  if (armedResponse.kind === "throws") {
    // Handled before reaching here; keeps the type exhaustive.
    throw new Error("unreachable");
  }
  const status = armedResponse.status;
  return {
    status,
    async json() {
      if (armedResponse.kind === "nonJson") {
        throw new SyntaxError("not JSON");
      }
      return armedResponse.body;
    },
  } as unknown as Response;
}

/** Arm the responses fetch will return, in call order. */
function arm(...responses: ArmedResponse[]): void {
  armed = [...responses];
}

beforeEach(() => {
  armed = [];
  calls = [];
  const stub = vi.fn(
    (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      calls.push({ url: String(input), init });
      const next = armed.shift();
      if (next === undefined) {
        // The guard: an unstubbed call must fail the test, never hit the
        // network.
        throw new Error(`unstubbed fetch call to ${String(input)}`);
      }
      if (next.kind === "throws") {
        return Promise.reject(new TypeError("Failed to fetch"));
      }
      return Promise.resolve(makeResponse(next));
    },
  );
  vi.stubGlobal("fetch", stub);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Assert the single recorded call and return it. */
function onlyCall(): RecordedCall {
  expect(calls).toHaveLength(1);
  return calls[0];
}

// --- shared request-shape assertions ----------------------------------------

describe("every request", () => {
  it("uses a same-origin relative URL under /api/ with no-store and no-referrer", async () => {
    arm({ kind: "json", status: 200, body: { status: "sealed", opensAt: "x" } });
    await getLetter("abc");

    const call = onlyCall();
    expect(call.url.startsWith("/api/")).toBe(true);
    expect(call.init?.cache).toBe("no-store");
    expect(call.init?.credentials).toBe("same-origin");
    expect(call.init?.referrerPolicy).toBe("no-referrer");
  });

  it("every call across all three wrappers targets a /api/ URL", async () => {
    arm(
      { kind: "json", status: 200, body: { status: "sealed", opensAt: "x" } },
      { kind: "json", status: 200, body: { serverSecret: "s" } },
      { kind: "json", status: 201, body: {} },
    );
    await getLetter("id1");
    await getSecret("id2");
    await postOpening({ letterId: "id3", ciphertext: "c", nonce: "n" });

    expect(calls).toHaveLength(3);
    for (const call of calls) {
      expect(call.url.startsWith("/api/")).toBe(true);
    }
  });
});

// --- getLetter --------------------------------------------------------------

describe("getLetter", () => {
  it("requests exactly /api/letters/{id} with GET (no method -> GET)", async () => {
    arm({ kind: "json", status: 200, body: { status: "sealed", opensAt: "x" } });
    await getLetter("the-id");

    const call = onlyCall();
    expect(call.url).toBe("/api/letters/the-id");
    // getLetter sets no method, so it is a GET; it is never the POST.
    expect(call.init?.method).toBeUndefined();
  });

  it("maps a 200 sealed body to sealed with its opensAt", async () => {
    arm({
      kind: "json",
      status: 200,
      body: { status: "sealed", opensAt: "2024-06-01T00:00:00.000Z" },
    });
    const result = await getLetter("id");
    expect(result).toEqual({
      outcome: "sealed",
      opensAt: "2024-06-01T00:00:00.000Z",
    });
  });

  it("maps a 200 openable body to openable with envelope and hash", async () => {
    arm({
      kind: "json",
      status: 200,
      body: { status: "openable", envelope: { a: 1 }, envelopeHash: "h" },
    });
    const result = await getLetter("id");
    expect(result).toEqual({
      outcome: "openable",
      envelope: { a: 1 },
      envelopeHash: "h",
    });
  });

  it("maps 404 to not_placed", async () => {
    arm({ kind: "json", status: 404, body: {} });
    expect(await getLetter("id")).toEqual({ outcome: "not_placed" });
  });

  it("maps a 5xx to unreachable", async () => {
    arm({ kind: "json", status: 500, body: {} });
    expect(await getLetter("id")).toEqual({ outcome: "unreachable" });
  });

  it("maps another 4xx to unreachable", async () => {
    arm({ kind: "json", status: 400, body: {} });
    expect(await getLetter("id")).toEqual({ outcome: "unreachable" });
  });

  it("maps a thrown fetch (network error) to unreachable", async () => {
    arm({ kind: "throws" });
    expect(await getLetter("id")).toEqual({ outcome: "unreachable" });
  });

  it("maps a 200 body with an unknown status to unreachable", async () => {
    arm({ kind: "json", status: 200, body: { status: "weird" } });
    expect(await getLetter("id")).toEqual({ outcome: "unreachable" });
  });

  it("maps a 200 sealed body missing opensAt to unreachable", async () => {
    arm({ kind: "json", status: 200, body: { status: "sealed" } });
    expect(await getLetter("id")).toEqual({ outcome: "unreachable" });
  });

  it("maps a non-JSON 200 body to unreachable", async () => {
    arm({ kind: "nonJson", status: 200 });
    expect(await getLetter("id")).toEqual({ outcome: "unreachable" });
  });
});

// --- getSecret --------------------------------------------------------------

describe("getSecret", () => {
  it("requests exactly /api/letters/{id}/secret with GET", async () => {
    arm({ kind: "json", status: 200, body: { serverSecret: "s" } });
    await getSecret("the-id");

    const call = onlyCall();
    expect(call.url).toBe("/api/letters/the-id/secret");
    expect(call.init?.method).toBeUndefined();
  });

  it("maps 200 to ok with the serverSecret", async () => {
    arm({ kind: "json", status: 200, body: { serverSecret: "base64url" } });
    expect(await getSecret("id")).toEqual({
      outcome: "ok",
      serverSecret: "base64url",
    });
  });

  it("maps 403 with opensAt to forbidden carrying that opensAt", async () => {
    arm({
      kind: "json",
      status: 403,
      body: { opensAt: "2024-06-01T00:00:00.000Z" },
    });
    expect(await getSecret("id")).toEqual({
      outcome: "forbidden",
      opensAt: "2024-06-01T00:00:00.000Z",
    });
  });

  it("maps a 403 whose body lacks opensAt to unreachable", async () => {
    arm({ kind: "json", status: 403, body: {} });
    expect(await getSecret("id")).toEqual({ outcome: "unreachable" });
  });

  it("maps a 200 body lacking serverSecret to unreachable", async () => {
    arm({ kind: "json", status: 200, body: { nope: true } });
    expect(await getSecret("id")).toEqual({ outcome: "unreachable" });
  });

  it("maps a 5xx to unreachable", async () => {
    arm({ kind: "json", status: 503, body: {} });
    expect(await getSecret("id")).toEqual({ outcome: "unreachable" });
  });

  it("maps another non-200 (404) to unreachable", async () => {
    arm({ kind: "json", status: 404, body: {} });
    expect(await getSecret("id")).toEqual({ outcome: "unreachable" });
  });

  it("maps a thrown fetch to unreachable", async () => {
    arm({ kind: "throws" });
    expect(await getSecret("id")).toEqual({ outcome: "unreachable" });
  });

  it("maps a non-JSON 403 body to unreachable", async () => {
    arm({ kind: "nonJson", status: 403 });
    expect(await getSecret("id")).toEqual({ outcome: "unreachable" });
  });
});

// --- postOpening ------------------------------------------------------------

describe("postOpening", () => {
  it("POSTs /api/openings with exactly letterId, ciphertext, nonce", async () => {
    arm({ kind: "json", status: 201, body: {} });
    await postOpening({ letterId: "L", ciphertext: "C", nonce: "N" });

    const call = onlyCall();
    expect(call.url).toBe("/api/openings");
    expect(call.init?.method).toBe("POST");
    expect(call.init?.cache).toBe("no-store");
    expect(call.init?.credentials).toBe("same-origin");
    expect(call.init?.referrerPolicy).toBe("no-referrer");

    const sent = JSON.parse(String(call.init?.body));
    expect(Object.keys(sent).sort()).toEqual([
      "ciphertext",
      "letterId",
      "nonce",
    ]);
    expect(sent).toEqual({ letterId: "L", ciphertext: "C", nonce: "N" });
  });

  it("sends only the three named fields even when extra keys are passed", async () => {
    arm({ kind: "json", status: 201, body: {} });
    // A caller passing extra keys (e.g. a stray client clock) must not leak
    // them onto the wire: the wrapper reconstructs the body from named fields.
    const dirty = {
      letterId: "L",
      ciphertext: "C",
      nonce: "N",
      openedAt: "2024-01-01T00:00:00.000Z",
      extra: "leak",
    } as unknown as { letterId: string; ciphertext: string; nonce: string };

    await postOpening(dirty);

    const call = onlyCall();
    const sent = JSON.parse(String(call.init?.body));
    expect(Object.keys(sent).sort()).toEqual([
      "ciphertext",
      "letterId",
      "nonce",
    ]);
    expect("openedAt" in sent).toBe(false);
    expect("extra" in sent).toBe(false);
  });

  it("maps 201 to ok", async () => {
    arm({ kind: "json", status: 201, body: {} });
    expect(
      await postOpening({ letterId: "L", ciphertext: "C", nonce: "N" }),
    ).toEqual({ outcome: "ok" });
  });

  it("maps a 200 (not 201) to failed", async () => {
    arm({ kind: "json", status: 200, body: {} });
    expect(
      await postOpening({ letterId: "L", ciphertext: "C", nonce: "N" }),
    ).toEqual({ outcome: "failed" });
  });

  it("maps a 4xx to failed", async () => {
    arm({ kind: "json", status: 400, body: {} });
    expect(
      await postOpening({ letterId: "L", ciphertext: "C", nonce: "N" }),
    ).toEqual({ outcome: "failed" });
  });

  it("maps a 5xx to failed", async () => {
    arm({ kind: "json", status: 500, body: {} });
    expect(
      await postOpening({ letterId: "L", ciphertext: "C", nonce: "N" }),
    ).toEqual({ outcome: "failed" });
  });

  it("maps a thrown fetch to failed", async () => {
    arm({ kind: "throws" });
    expect(
      await postOpening({ letterId: "L", ciphertext: "C", nonce: "N" }),
    ).toEqual({ outcome: "failed" });
  });

  it("is the only call that sends a POST method", async () => {
    arm(
      { kind: "json", status: 200, body: { status: "sealed", opensAt: "x" } },
      { kind: "json", status: 200, body: { serverSecret: "s" } },
      { kind: "json", status: 201, body: {} },
    );
    await getLetter("a");
    await getSecret("b");
    await postOpening({ letterId: "c", ciphertext: "d", nonce: "e" });

    const posts = calls.filter((c) => c.init?.method === "POST");
    expect(posts).toHaveLength(1);
    expect(posts[0].url).toBe("/api/openings");
  });
});
