/**
 * Property 8 (spec 06 backup-only start, R7.3, R7.6, R7.12): a backup-only
 * start makes one backup key and touches no passkey port. The start works once
 * from the write step. Repeat starts are refused and make no further key.
 */

import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { CryptoModule } from "./crypto-module";
import type { PrepareResult, SealApi, SealPostResult } from "./api";
import type { SealDeps, SealDraft } from "./seal-runner";
import { useSealFlow, type SealFlow } from "./useSealFlow";
import { catalogueMetric, makeFigures } from "./test-figures";
import { encodeBase64url } from "@/lib/seal-format";

const T0 = Date.parse("2026-11-02T10:00:00.000Z");

const PREPARED: PrepareResult = {
  ok: true,
  letterId: encodeBase64url(new Uint8Array(16)),
  serverSecret: encodeBase64url(new Uint8Array(32)),
  serverNow: "2026-11-02T10:00:00.000Z",
};

const SEALED: SealPostResult = {
  ok: true,
  letterId: encodeBase64url(new Uint8Array(16)),
  sealedAt: "2026-11-02T10:00:00.000Z",
  opensAt: "2026-11-02T10:00:30.000Z",
  envelopeHash: "a".repeat(64),
};

function draft(): SealDraft {
  return {
    text: "A short note.",
    metricIds: ["us-gasoline-regular"],
    figures: makeFigures([
      {
        metric: catalogueMetric("us-gasoline-regular"),
        figures: [{ period: "2026-10-26", value: "3.412" }],
      },
    ]),
  };
}

/**
 * Builds deps whose passkey port and generator are spies. The port's create
 * and get must never run for a backup-only start.
 */
async function buildDeps() {
  const crypto = await import("@/lib/crypto");
  const generateSpy = vi.fn(crypto.generateBackupKey);
  const cryptoSpy = {
    ...crypto,
    generateBackupKey: generateSpy,
  } as unknown as CryptoModule;
  const createSpy = vi.fn(async () => {
    throw new Error("passkey create must not run for a backup-only start");
  });
  const getSpy = vi.fn(async () => {
    throw new Error("passkey get must not run for a backup-only start");
  });
  const port = {
    isAvailable: () => true,
    create: createSpy,
    get: getSpy,
  };
  const api = {
    prepare: vi.fn(async () => PREPARED),
    seal: vi.fn(async () => SEALED),
  };
  const deps = {
    crypto: cryptoSpy,
    port,
    api: api as unknown as SealApi,
    rpId: "localhost",
    now: () => T0,
  } as SealDeps;
  return { deps, generateSpy, createSpy, getSpy, api };
}

/** Renders the hook once and returns the handlers it produced. */
function mount(deps: SealDeps | null, d: SealDraft): SealFlow {
  let captured: SealFlow | undefined;
  function Capture() {
    captured = useSealFlow(deps, d);
    return null;
  }
  renderToStaticMarkup(createElement(Capture));
  if (captured === undefined) throw new Error("hook did not render");
  return captured;
}

describe("Property 8: a backup-only start makes one key and touches no port", () => {
  it("the first start succeeds, later starts are refused, and only one key is made", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 4 }), async (presses) => {
        const { deps, generateSpy, createSpy, getSpy, api } = await buildDeps();
        const flow = mount(deps, draft());

        const results: boolean[] = [];
        for (let i = 0; i < presses; i++)
          results.push(flow.onBackupOnlyStart());

        expect(results[0]).toBe(true);
        expect(results.slice(1).every((r) => r === false)).toBe(true);
        expect(generateSpy).toHaveBeenCalledTimes(1);
        expect(createSpy).not.toHaveBeenCalled();
        expect(getSpy).not.toHaveBeenCalled();
        expect(api.prepare).not.toHaveBeenCalled();
        expect(api.seal).not.toHaveBeenCalled();
        expect(flow.getBackupKeyText()).not.toBeNull();
      }),
      { numRuns: 25 },
    );
  });
});
