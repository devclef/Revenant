// Property 18: The PRF_Hint shows only on a reported false (spec 08, design.md
// "PRF_Hint"; R16.2, R16.3, R16.4). Also covers the probe's timeout and the
// no-request rule (R16.3, R16.7). The hook itself needs an effect, which the
// Node test environment does not run, so the probe is tested directly.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";

import {
  PRF_HINT_TIMEOUT_MS,
  prfHintFrom,
  probePrfCapabilities,
  type PrfProbe,
} from "./prf-hint";

const prfValue = fc.oneof(
  fc.boolean(),
  fc.string(),
  fc.integer(),
  fc.constant(null),
  fc.constant(undefined),
);

const capsArb: fc.Arbitrary<Record<string, unknown>> = fc
  .tuple(fc.dictionary(fc.string(), fc.jsonValue()), fc.boolean(), prfValue)
  .map(([others, hasPrf, value]) => {
    const caps: Record<string, unknown> = { ...others };
    if (hasPrf) caps["extension:prf"] = value;
    return caps;
  });

const probeArb: fc.Arbitrary<PrfProbe> = fc.oneof(
  fc.constant({ kind: "unsupported" } as const),
  fc.constant({ kind: "rejected" } as const),
  fc.constant({ kind: "timeout" } as const),
  capsArb.map((caps) => ({ kind: "resolved" as const, caps })),
);

describe("Property 18: prfHintFrom shows missing only on a reported false", () => {
  it("returns missing exactly when resolved with extension:prf === false", () => {
    fc.assert(
      fc.property(probeArb, (probe) => {
        const expected =
          probe.kind === "resolved" && probe.caps["extension:prf"] === false
            ? "missing"
            : "none";
        expect(prfHintFrom(probe)).toBe(expected);
      }),
      { numRuns: 200 },
    );
  });

  it("is none for a true, a missing or a non-boolean false entry", () => {
    expect(prfHintFrom({ kind: "resolved", caps: { "extension:prf": true } })).toBe("none");
    expect(prfHintFrom({ kind: "resolved", caps: {} })).toBe("none");
    expect(prfHintFrom({ kind: "resolved", caps: { "extension:prf": "false" } })).toBe("none");
  });

  it("is missing for a resolved false", () => {
    expect(prfHintFrom({ kind: "resolved", caps: { "extension:prf": false } })).toBe("missing");
  });
});

describe("probePrfCapabilities", () => {
  const g = globalThis as { PublicKeyCredential?: unknown };
  let saved: unknown;

  beforeEach(() => {
    saved = g.PublicKeyCredential;
    vi.useFakeTimers();
  });

  afterEach(() => {
    g.PublicKeyCredential = saved;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("uses the 2000 ms timeout from the design", () => {
    expect(PRF_HINT_TIMEOUT_MS).toBe(2000);
  });

  it("reports unsupported when getClientCapabilities is missing", async () => {
    g.PublicKeyCredential = {};
    await expect(probePrfCapabilities()).resolves.toEqual({ kind: "unsupported" });
  });

  it("reports unsupported when PublicKeyCredential is absent", async () => {
    g.PublicKeyCredential = undefined;
    await expect(probePrfCapabilities()).resolves.toEqual({ kind: "unsupported" });
  });

  it("reports rejected when the call rejects", async () => {
    g.PublicKeyCredential = {
      getClientCapabilities: () => Promise.reject(new Error("no")),
    };
    await expect(probePrfCapabilities()).resolves.toEqual({ kind: "rejected" });
  });

  it("reports the resolved record and calls the function exactly once", async () => {
    const fn = vi.fn(async () => ({ "extension:prf": false }));
    g.PublicKeyCredential = { getClientCapabilities: fn };
    const result = await probePrfCapabilities();
    expect(result).toEqual({ kind: "resolved", caps: { "extension:prf": false } });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("reports timeout when the call has not resolved within 2000 ms", async () => {
    g.PublicKeyCredential = {
      getClientCapabilities: () => new Promise(() => undefined),
    };
    const pending = probePrfCapabilities();
    await vi.advanceTimersByTimeAsync(PRF_HINT_TIMEOUT_MS);
    await expect(pending).resolves.toEqual({ kind: "timeout" });
  });
});
