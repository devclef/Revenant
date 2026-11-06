// Tests for the browser Figures_API client (figures-api.ts, issue #202).
//
// These run in the node environment. `loadFigures` takes an injected fetch, so
// no test touches the network or the global fetch. Each test checks what the
// client sent and how it mapped the outcome.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  FIGURES_TIMEOUT_MS,
  FIGURES_URL,
  loadFigures,
} from "./figures-api";

const VALID_BODY = {
  format: "revenant-figures-v1",
  generated_at: "2026-11-05T15:00:00Z",
  source_mode: "file",
  series: [],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** A fetch that never answers until its signal aborts, then rejects. */
function hangingFetch(): typeof fetch {
  return vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("aborted", "AbortError"));
      });
    });
  }) as unknown as typeof fetch;
}

describe("loadFigures: one request", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends exactly one GET to the fixed relative route per call", async () => {
    const fetchMock = vi.fn(async () => jsonResponse(VALID_BODY));
    const fetchImpl = fetchMock as unknown as typeof fetch;

    await loadFigures(fetchImpl);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(FIGURES_URL);
    expect(url).toBe("/api/figures");
    // No method is set, so the request is a plain GET.
    expect(init.method).toBeUndefined();
    expect(init.cache).toBe("no-store");
    expect(init.credentials).toBe("same-origin");
    expect(init.referrerPolicy).toBe("no-referrer");
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("loadFigures: 30 second abort", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("uses a 30 second timeout", () => {
    expect(FIGURES_TIMEOUT_MS).toBe(30_000);
  });

  it("aborts a request that has not answered after 30 seconds and reports failed", async () => {
    const fetchImpl = hangingFetch();
    const pending = loadFigures(fetchImpl);

    await vi.advanceTimersByTimeAsync(FIGURES_TIMEOUT_MS - 1);
    const signal = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0]?.[1]?.signal as AbortSignal;
    expect(signal.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    expect(signal.aborted).toBe(true);
    await expect(pending).resolves.toEqual({ status: "failed" });
  });

  it("does not abort a request that answers before 30 seconds", async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      await new Promise((resolve) => setTimeout(resolve, 1_000));
      expect(init?.signal?.aborted).toBe(false);
      return jsonResponse(VALID_BODY);
    }) as unknown as typeof fetch;

    const pending = loadFigures(fetchImpl);
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(pending).resolves.toMatchObject({ status: "ready" });
  });
});

describe("loadFigures: failure modes", () => {
  it("maps a thrown fetch (offline, DNS) to failed", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }) as unknown as typeof fetch;

    await expect(loadFigures(fetchImpl)).resolves.toEqual({ status: "failed" });
  });

  it.each([400, 404, 500, 503])("maps a %i status to failed", async (status) => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(VALID_BODY, status),
    ) as unknown as typeof fetch;

    await expect(loadFigures(fetchImpl)).resolves.toEqual({ status: "failed" });
  });

  it("maps a body that is not JSON to failed", async () => {
    const fetchImpl = vi.fn(
      async () => new Response("<html>oops</html>", { status: 200 }),
    ) as unknown as typeof fetch;

    await expect(loadFigures(fetchImpl)).resolves.toEqual({ status: "failed" });
  });

  it("maps a JSON body that parseFiguresResponse rejects to failed", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ ...VALID_BODY, format: "something-else" }),
    ) as unknown as typeof fetch;

    await expect(loadFigures(fetchImpl)).resolves.toEqual({ status: "failed" });
  });

  it("maps an extra field to failed, because the schema is strict", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ ...VALID_BODY, extra: true }),
    ) as unknown as typeof fetch;

    await expect(loadFigures(fetchImpl)).resolves.toEqual({ status: "failed" });
  });
});

describe("loadFigures: success", () => {
  it("parses a valid body and returns it as ready", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(VALID_BODY),
    ) as unknown as typeof fetch;

    await expect(loadFigures(fetchImpl)).resolves.toEqual({
      status: "ready",
      figures: VALID_BODY,
    });
  });
});
