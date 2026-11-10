// Tests for the figures state mapping (figures-state.ts, spec X2 task 1).
//
// Every failure path maps to `failed`, the success path maps to `ready`, and
// the timeout aborts the request and reports `failed` (X2.1). The timeout test
// runs the real loader with fake timers and an injected fetch, so no test
// touches the network.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { loadFigures } from "@/components/reveal/figures-api";

import { FIGURES_TIMEOUT_MS, figuresStateFrom } from "./figures-state";

const VALID_BODY = {
  format: "revenant-figures-v1",
  generated_at: "2026-11-05T15:00:00Z",
  source_mode: "file",
  series: [],
};

describe("FIGURES_TIMEOUT_MS", () => {
  it("is 30 seconds", () => {
    expect(FIGURES_TIMEOUT_MS).toBe(30_000);
  });
});

describe("figuresStateFrom: failure paths", () => {
  it("maps a rejected fetch to failed", () => {
    expect(figuresStateFrom({ kind: "rejected" })).toEqual({
      status: "failed",
    });
  });

  it("maps an aborted request to failed", () => {
    expect(figuresStateFrom({ kind: "aborted" })).toEqual({ status: "failed" });
  });

  it.each([204, 400, 404, 500, 503])(
    "maps a %i status to failed even when the body is valid",
    (status) => {
      expect(
        figuresStateFrom({ kind: "response", status, body: VALID_BODY }),
      ).toEqual({ status: "failed" });
    },
  );

  it("maps a body that parseFiguresResponse rejects to failed", () => {
    expect(
      figuresStateFrom({
        kind: "response",
        status: 200,
        body: { ...VALID_BODY, format: "something-else" },
      }),
    ).toEqual({ status: "failed" });
  });

  it("maps a body with an extra field to failed, because the schema is strict", () => {
    expect(
      figuresStateFrom({
        kind: "response",
        status: 200,
        body: { ...VALID_BODY, extra: true },
      }),
    ).toEqual({ status: "failed" });
  });

  it("maps a missing body to failed", () => {
    expect(
      figuresStateFrom({ kind: "response", status: 200, body: undefined }),
    ).toEqual({ status: "failed" });
  });
});

describe("figuresStateFrom: success path", () => {
  it("maps a 200 with a valid body to ready with the parsed figures", () => {
    expect(
      figuresStateFrom({ kind: "response", status: 200, body: VALID_BODY }),
    ).toEqual({ status: "ready", figures: VALID_BODY });
  });
});

describe("the 30 second timeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("aborts a request that has not answered after 30 seconds and reports failed", async () => {
    const fetchImpl = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("aborted", "AbortError"));
        });
      });
    }) as unknown as typeof fetch;

    const pending = loadFigures(fetchImpl);
    await vi.advanceTimersByTimeAsync(FIGURES_TIMEOUT_MS);

    await expect(pending).resolves.toEqual({ status: "failed" });
  });
});
