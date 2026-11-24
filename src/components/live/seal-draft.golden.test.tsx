/**
 * Draft and request goldens for the seal flow (spec 19, task 1.2).
 *
 * SealPage renders once per mode (demo, real) with renderToStaticMarkup. A spy
 * on useSealFlow records the SealDeps and the SealDraft that the page builds.
 * The test then seals that recorded draft through the real pressCreate,
 * pressConfirm and sealWithPasskey, with:
 *   - a fake authenticator port (fixed PRF output),
 *   - a seeded crypto.getRandomValues,
 *   - a fixed clock (the server clock and the browser clock both read NOW_ISO),
 *   - a stubbed fetch that records method, path and body.
 * The sealed envelope is then opened with openLetter, so the golden holds the
 * decrypted payload as well as the request list.
 *
 * Real mode: a static render cannot pick a date, so the harness fixes
 * `opensOn` to REAL_OPENS_ON on the recorded draft. Everything else is the
 * draft the page built.
 *
 * Run with RECORD_GOLDEN=1 to write the files under `__golden__/seal-draft/`.
 * Without it the test compares against them.
 */

// Set before any import, so Intl and Date read UTC for the whole file.
vi.hoisted(() => {
  process.env.TZ = "UTC";
});

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import type { FiguresState } from "@/components/reveal/figures-api";
import { figuresResponseFrom } from "@/components/reveal/figures-stub";
import { DEMO_FIGURES } from "@/lib/figures/demo";
import { encodeBase64url } from "@/lib/seal-format";

import type { CryptoModule } from "./crypto-module";
import {
  PREPARE_PATH,
  REAL_PREPARE_PATH,
  REAL_SEAL_PATH,
  SEAL_PATH,
} from "./api";
import { checkRealOpening, type RealOpening } from "./real-opening";
import {
  pressConfirm,
  pressCreate,
  sealWithPasskey,
  type AuthenticatorPort,
  type SealDeps,
  type SealDraft,
} from "./seal-runner";
import type { WriteDraft } from "./write-draft";
import type { SealPageMode } from "./SealPage";

const hold = vi.hoisted(() => ({
  crypto: null as unknown as CryptoModule,
  createFake: null as unknown as () => AuthenticatorPort,
  recorded: [] as Array<{ deps: SealDeps; draft: SealDraft }>,
}));

vi.mock("./useSealFlow", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./useSealFlow")>();
  return {
    ...actual,
    useSealFlow: (deps: SealDeps | null, draft: SealDraft) => {
      if (deps !== null) hold.recorded.push({ deps, draft });
      return actual.useSealFlow(deps, draft);
    },
  };
});

vi.mock("./useCryptoModule", () => ({
  useCryptoModule: () => hold.crypto,
}));

vi.mock("./prf-hint", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./prf-hint")>()),
  usePrfHint: () => "none",
}));

let readyFigures: FiguresState | null = null;

vi.mock("@/components/reveal/figures-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/reveal/figures-api")>()),
  useFigures: (): FiguresState => {
    readyFigures ??= {
      status: "ready",
      figures: figuresResponseFrom(DEMO_FIGURES),
    };
    return readyFigures;
  },
}));

vi.mock("./stepper/live-steps", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./stepper/live-steps")>();
  return {
    ...actual,
    initialStepperState: (
      ...args: Parameters<typeof actual.initialStepperState>
    ) => ({
      ...actual.initialStepperState(...args),
      draft: fixedWriteDraft(),
    }),
  };
});

import { SealPage } from "./SealPage";

const RP_ID = "localhost";
const APP_ORIGIN = "http://localhost:3000";
const NOW_MS = Date.parse("2026-11-24T14:00:00.000Z");
const NOW_ISO = "2026-11-24T14:00:00.000Z";
/** Real mode cannot pick a date in a static render, so the harness fixes it. */
const REAL_OPENS_ON = "2027-06-01";
const REAL_OPENS_AT = "2027-06-01T00:00:00.000Z";
const DEMO_OPENS_AT = "2026-11-24T14:00:30.000Z";
const SERVER_SECRET = Uint8Array.from(
  { length: 32 },
  (_, i) => (i * 5 + 3) & 0xff,
);
const LETTER_ID = Uint8Array.from(
  { length: 16 },
  (_, i) => (i * 11 + 7) & 0xff,
);
const SEED: Record<SealPageMode, number> = { demo: 0x5eed01, real: 0x5eed02 };

const DEMO_ROUTES: readonly string[] = [PREPARE_PATH, SEAL_PATH];
const REAL_ROUTES: readonly string[] = [REAL_PREPARE_PATH, REAL_SEAL_PATH];

/** The one fixed draft: letter text, two questions with answers, one figure. */
function fixedWriteDraft(): WriteDraft {
  return {
    text: "The bins go out on Tuesdays. The garden fence needs replacing.",
    metricIds: [[...DEMO_FIGURES.series.values()][0].metric.id],
    backupChoice: null,
    warningTicked: false,
    backupCardTicked: false,
    questions: [
      "What worries me most right now?",
      "What do I want to have finished by spring?",
    ],
    answers: ["The cost of the car repairs.", "The garden fence."],
    selfReported: [],
  };
}

interface RequestRecord {
  method: string;
  path: string;
  body: unknown;
}

/** Replaces the global crypto.getRandomValues with a seeded generator. */
function seedRandom(seed: number): void {
  let state = seed >>> 0;
  Object.defineProperty(globalThis.crypto, "getRandomValues", {
    configurable: true,
    value: <T extends ArrayBufferView>(array: T): T => {
      const bytes = new Uint8Array(
        array.buffer,
        array.byteOffset,
        array.byteLength,
      );
      for (let i = 0; i < bytes.length; i++) {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        bytes[i] = state >>> 24;
      }
      return array;
    },
  });
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

/** Stubs fetch with fixed server answers and returns the list it records into. */
function stubFetch(requests: RequestRecord[]): void {
  vi.stubGlobal("fetch", async (input: string, init?: RequestInit) => {
    const path = String(input);
    const method = init?.method ?? "GET";
    const body: unknown =
      typeof init?.body === "string" ? JSON.parse(init.body) : null;
    requests.push({ method, path, body });
    if (path === PREPARE_PATH || path === REAL_PREPARE_PATH) {
      return json(201, {
        letterId: encodeBase64url(LETTER_ID),
        serverSecret: encodeBase64url(SERVER_SECRET),
        serverNow: NOW_ISO,
      });
    }
    if (path === SEAL_PATH || path === REAL_SEAL_PATH) {
      const sent = body as { letterId: string; envelopeHash: string };
      return json(201, {
        letterId: sent.letterId,
        sealedAt: NOW_ISO,
        opensAt: REAL_ROUTES.includes(path) ? REAL_OPENS_AT : DEMO_OPENS_AT,
        envelopeHash: sent.envelopeHash,
      });
    }
    return json(404, {});
  });
}

/** Maps Map and Uint8Array values to JSON so the golden holds them. */
function toJsonable(_key: string, value: unknown): unknown {
  if (value instanceof Map) return { __map: [...value.entries()] };
  if (value instanceof Uint8Array) return encodeBase64url(value);
  return value;
}

interface SealGolden {
  mode: SealPageMode;
  draft: unknown;
  requests: RequestRecord[];
  outcome: unknown;
  envelopeHash: string;
  header: unknown;
  payload: unknown;
}

/** Renders SealPage in one mode, then seals the recorded draft through the runner. */
async function sealRecordedDraft(mode: SealPageMode): Promise<SealGolden> {
  const requests: RequestRecord[] = [];
  hold.recorded = [];
  stubFetch(requests);
  seedRandom(SEED[mode]);

  renderToStaticMarkup(
    createElement(SealPage, {
      rpId: RP_ID,
      appOrigin: APP_ORIGIN,
      mode,
      deps: { port: hold.createFake(), nowMs: () => NOW_MS },
    }),
  );
  const recorded = hold.recorded.at(-1);
  if (recorded === undefined) throw new Error("useSealFlow was not rendered");
  const { deps } = recorded;
  const draft: SealDraft =
    recorded.draft.real !== undefined
      ? {
          ...recorded.draft,
          real: { opensOn: REAL_OPENS_ON, timeZone: "UTC" } as RealOpening,
        }
      : recorded.draft;

  const check =
    draft.real !== undefined ? checkRealOpening(draft.real, deps.now()) : null;
  if (check !== null && !check.ok)
    throw new Error(`date refused: ${check.kind}`);

  const created = await pressCreate(
    deps,
    check?.ok ? check.userName : undefined,
  );
  if (!created.ok) throw new Error(`create refused: ${created.event.type}`);
  const confirmed = await pressConfirm(deps, created.created);
  if (!confirmed.ok)
    throw new Error(`confirm refused: ${confirmed.event.type}`);

  // sealWithPasskey zeroes confirmed.prfOutput, so the open below needs a copy.
  const prfOutput = confirmed.confirmed.prfOutput.slice();
  const outcome = await sealWithPasskey(deps, {
    draft,
    confirmed: confirmed.confirmed,
  });
  if (!outcome.ok) throw new Error(`seal refused: ${outcome.event.type}`);

  const sealRequest = requests.find(
    (r) => r.method === "POST" && r.path.endsWith("seal"),
  );
  if (sealRequest === undefined) throw new Error("no seal request was sent");
  const sent = sealRequest.body as {
    envelope: { header: unknown };
    envelopeHash: string;
  };

  const opened = await deps.crypto.openLetter({
    envelope: sent.envelope,
    envelopeHash: sent.envelopeHash,
    serverSecret: SERVER_SECRET.slice(),
    passkey: { prfOutput },
  });
  if (!opened.ok) throw new Error(`open failed: ${opened.error.kind}`);
  expect(JSON.stringify(opened.payload)).toContain(draft.text);

  return {
    mode,
    draft,
    requests,
    outcome: outcome.event,
    envelopeHash: sent.envelopeHash,
    header: sent.envelope.header,
    payload: opened.payload,
  };
}

const GOLDEN_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "__golden__",
  "seal-draft",
);
const RECORD = process.env.RECORD_GOLDEN === "1";

describe("seal draft and request goldens (spec 19, task 1.2)", () => {
  beforeAll(async () => {
    hold.crypto = (await import("@/lib/crypto")) as unknown as CryptoModule;
    const fake = await import("@/lib/crypto/testing/fake-authenticator");
    hold.createFake = () => fake.createFakeAuthenticator();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(globalThis.crypto, "getRandomValues");
  });

  for (const mode of ["demo", "real"] as const) {
    it(`${mode}: seals the recorded draft and matches its golden`, async () => {
      const golden = await sealRecordedDraft(mode);

      const allowed = mode === "demo" ? DEMO_ROUTES : REAL_ROUTES;
      const other = mode === "demo" ? REAL_ROUTES : DEMO_ROUTES;
      const paths = golden.requests.map((r) => r.path);
      expect(paths.length).toBeGreaterThan(0);
      expect(paths.every((p) => allowed.includes(p))).toBe(true);
      expect(paths.some((p) => other.includes(p))).toBe(false);

      const text = `${JSON.stringify(golden, toJsonable, 2)}\n`;
      const path = join(GOLDEN_DIR, `${mode}.json`);
      if (RECORD) {
        mkdirSync(GOLDEN_DIR, { recursive: true });
        writeFileSync(path, text, "utf8");
        return;
      }
      expect(existsSync(path), `missing golden ${mode}.json`).toBe(true);
      expect(readFileSync(path, "utf8")).toBe(text);
    });
  }
});
