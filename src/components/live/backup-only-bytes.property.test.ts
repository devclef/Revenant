/**
 * Property 10 (spec 06 backup-only paths, R9.3, R9.10): both backup-only paths
 * seal the same bytes. The Seal_Step start ("Not now" to a backup key) and the
 * cannot_lock fallback start both reach the same seal with the same draft.
 * With a fixed clock, a seeded random source and a fake api, the two paths
 * produce the same envelope, the same envelope hash and the same printed key.
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

const TEXTS = ["A short note.", "Remember the bins.", "Ring Mum on Sunday."] as const;

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

/** Seeded byte source (mulberry32). The state is reset before each key is made. */
let seedState = 0;

function reseed(seed: number): void {
  seedState = seed >>> 0;
}

function nextByte(): number {
  seedState = (seedState + 0x6d2b79f5) >>> 0;
  let t = seedState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) & 0xff;
}

/** Fills a typed array from the seeded stream, as `crypto.getRandomValues` does. */
function fillSeeded<T extends ArrayBufferView>(view: T): T {
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  for (let i = 0; i < bytes.length; i++) bytes[i] = nextByte();
  return view;
}

function draft(text: string): SealDraft {
  return {
    text,
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
 * Builds deps for one run. The port reports no passkey support, so the create
 * step fails with `unsupported` before any random draw, and the flow reaches
 * cannot_lock. The key generator reseeds the stream first, so both paths start
 * the stream from the same state.
 */
async function buildDeps(seed: number) {
  const crypto = await import("@/lib/crypto");
  const generateSpy = vi.fn(() => {
    reseed(seed);
    return crypto.generateBackupKey();
  });
  const cryptoWithSeed = {
    ...crypto,
    generateBackupKey: generateSpy,
  } as unknown as CryptoModule;
  const createSpy = vi.fn(async () => {
    throw new Error("passkey create must not run for a backup-only path");
  });
  const getSpy = vi.fn(async () => {
    throw new Error("passkey get must not run for a backup-only path");
  });
  const port = {
    isAvailable: () => false,
    create: createSpy,
    get: getSpy,
  };
  const api = {
    prepare: vi.fn(async () => PREPARED),
    seal: vi.fn(async () => SEALED),
  };
  const deps = {
    crypto: cryptoWithSeed,
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

/** Lets the pending promise chains of the press handlers settle. */
async function settle(): Promise<void> {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve, 0));
}

interface SealedBytes {
  envelope: unknown;
  envelopeHash: string;
  backupKeyText: string | null;
}

/**
 * Runs one backup-only path to its seal. "seal_step" starts from the write step
 * (Not now, then a backup key). "cannot_lock" fails the passkey create, then
 * starts the fallback.
 */
async function runPath(
  path: "seal_step" | "cannot_lock",
  seed: number,
  text: string,
): Promise<SealedBytes> {
  const { deps, generateSpy, createSpy, getSpy, api } = await buildDeps(seed);
  const flow = mount(deps, draft(text));

  if (path === "seal_step") {
    expect(flow.onBackupOnlyStart()).toBe(true);
  } else {
    flow.onCreatePress();
    await settle();
    flow.onFallbackStart();
  }
  await settle();
  expect(generateSpy).toHaveBeenCalledTimes(1);

  flow.onFallbackSealPress();
  await settle();

  expect(createSpy).not.toHaveBeenCalled();
  expect(getSpy).not.toHaveBeenCalled();
  expect(api.seal).toHaveBeenCalledTimes(1);

  const sealCalls = api.seal.mock.calls as unknown as Array<
    [{ envelope: unknown; envelopeHash: string }]
  >;
  const body = sealCalls[0]![0];
  return {
    envelope: body.envelope,
    envelopeHash: body.envelopeHash,
    backupKeyText: flow.getBackupKeyText(),
  };
}

describe("Property 10: both backup-only paths seal the same bytes", () => {
  it("the Seal_Step start and the cannot_lock fallback produce identical envelopes", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 0x7fffffff }),
        fc.constantFrom(...TEXTS),
        async (seed, text) => {
          const spy = vi
            .spyOn(globalThis.crypto, "getRandomValues")
            .mockImplementation(
              ((view: ArrayBufferView) => fillSeeded(view)) as unknown as typeof globalThis.crypto.getRandomValues,
            );
          try {
            const fromSealStep = await runPath("seal_step", seed, text);
            const fromCannotLock = await runPath("cannot_lock", seed, text);

            expect(fromSealStep.backupKeyText).not.toBeNull();
            expect(fromCannotLock.backupKeyText).toBe(fromSealStep.backupKeyText);
            expect(fromCannotLock.envelopeHash).toBe(fromSealStep.envelopeHash);
            expect(JSON.stringify(fromCannotLock.envelope)).toBe(
              JSON.stringify(fromSealStep.envelope),
            );
          } finally {
            spy.mockRestore();
          }
        },
      ),
      { numRuns: 10 },
    );
  });
});
