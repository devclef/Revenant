/**
 * Demo markup goldens for SealPage (spec 19, task 1.1).
 *
 * Each (step, Seal_State) pair in the design's table renders SealPage in
 * Demo_Mode with renderToStaticMarkup and is compared byte for byte with the
 * file under `__golden__/seal-page-demo/`. These files were recorded at the
 * baseline commit (see the commit message). Run with RECORD_GOLDEN=1 to write
 * them again. Without it the test only reads them.
 *
 * The seal flow is mocked (state per pair). The stepper is the real one, and
 * it starts from the real initialStepperState with one fixed step and draft.
 * The clock is frozen, the timezone is UTC, and the figures come from
 * DEMO_FIGURES, so the markup is the same on every run.
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
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { FiguresState } from "@/components/reveal/figures-api";
import { figuresResponseFrom } from "@/components/reveal/figures-stub";
import { DEMO_FIGURES } from "@/lib/figures/demo";

import type { SealState } from "./seal-machine";
import type { LiveStep } from "./stepper/live-steps";
import type { WriteDraft } from "./write-draft";

const stub = vi.hoisted(() => ({
  step: "write" as string,
  state: { tag: "write" } as import("./seal-machine").SealState,
}));

vi.mock("./useSealFlow", () => ({
  useSealFlow: () => ({
    state: stub.state,
    onCreatePress: () => {},
    onConfirmPress: () => {},
    onFallbackStart: () => {},
    onFallbackSealPress: () => {},
    onFallbackDecline: () => {},
    onRetry: () => {},
    getBackupKeyText: () => SAMPLE_BACKUP_KEY,
  }),
}));

vi.mock("./useCryptoModule", () => ({
  useCryptoModule: () => null,
}));

vi.mock("./prf-hint", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./prf-hint")>()),
  usePrfHint: () => "none",
}));

let readyState: FiguresState | null = null;

vi.mock("@/components/reveal/figures-api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/reveal/figures-api")>()),
  useFigures: (): FiguresState => {
    readyState ??= { status: "ready", figures: figuresResponseFrom(DEMO_FIGURES) };
    return readyState;
  },
}));

vi.mock("./stepper/live-steps", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./stepper/live-steps")>();
  return {
    ...actual,
    initialStepperState: (...args: Parameters<typeof actual.initialStepperState>) => ({
      ...actual.initialStepperState(...args),
      step: stub.step as LiveStep,
      draft: fixedDraft(),
    }),
  };
});

import { SealPage } from "./SealPage";

const RP_ID = "localhost";
const APP_ORIGIN = "http://localhost:3000";
const NOW_MS = Date.parse("2026-11-24T14:00:00.000Z");
const LETTER_ID = "5c1e2f3a-7b8d-4e9f-8a0b-1c2d3e4f5a6b";
const ENVELOPE_HASH = "ab".repeat(32);

/** The one metric the fixed draft chooses: the first series of DEMO_FIGURES. */
function metricId(): string {
  return [...DEMO_FIGURES.series.values()][0].metric.id;
}

/**
 * A fixed sample backup key in the card form: 27 Crockford characters in
 * groups of four. It is the output of formatBackupKey for the 16 bytes
 * (i * 37 + 11) & 0xff, so its checksum is valid. Written out here because
 * components/** may not statically import lib/crypto (import-boundary test).
 */
const SAMPLE_BACKUP_KEY = "0B61-AQN7-Y4X4-736P-3XMB-3YR4-9P7";

/** The one fixed draft: letter text, two questions with answers, one figure. */
function fixedDraft(): WriteDraft {
  return {
    text: "The bins go out on Tuesdays. The garden fence needs replacing.",
    metricIds: [metricId()],
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

interface GoldenCase {
  /** The stepper step, as the step name. */
  step: LiveStep;
  /** The Seal_State tag, or a tag that names one Seal_State variant. */
  tag: string;
  state: SealState;
}

const SEALED = (factors: "passkey" | "backup"): SealState => ({
  tag: "sealed",
  letterId: LETTER_ID,
  sealedAt: "2026-11-24T14:00:00.000Z",
  opensAt: "2027-11-24T00:00:00.000Z",
  offsetMs: 3_600_000,
  factors,
  envelopeHash: ENVELOPE_HASH,
});

/** Every (step, Seal_State) pair in the design's table (design.md, Step 0). */
const CASES: readonly GoldenCase[] = [
  { step: "write", tag: "write", state: { tag: "write" } },
  { step: "seal", tag: "write", state: { tag: "write" } },
  { step: "seal", tag: "creating", state: { tag: "creating" } },
  { step: "seal", tag: "created", state: { tag: "created" } },
  { step: "seal", tag: "confirming", state: { tag: "confirming" } },
  { step: "seal", tag: "preparing", state: { tag: "preparing" } },
  { step: "seal", tag: "sealing", state: { tag: "sealing" } },
  {
    step: "seal",
    tag: "cannot_lock-passkey",
    state: { tag: "cannot_lock", passkeyCreated: true },
  },
  {
    step: "seal",
    tag: "cannot_lock-no-passkey",
    state: { tag: "cannot_lock", passkeyCreated: false },
  },
  { step: "seal", tag: "cancelled", state: { tag: "cancelled" } },
  {
    step: "seal",
    tag: "failed-network",
    state: { tag: "failed", kind: "network", passkeyCreated: false },
  },
  {
    step: "seal",
    tag: "failed-server",
    state: { tag: "failed", kind: "server", passkeyCreated: false },
  },
  {
    step: "seal",
    tag: "failed-missing_then",
    state: { tag: "failed", kind: "missing_then", passkeyCreated: false },
  },
  {
    step: "seal",
    tag: "failed-clock",
    state: { tag: "failed", kind: "clock", passkeyCreated: false },
  },
  {
    step: "seal",
    tag: "failed-busy",
    state: { tag: "failed", kind: "busy", passkeyCreated: false },
  },
  {
    step: "seal",
    tag: "fallback_key",
    state: { tag: "fallback_key", origin: "cannot_lock", passkeyCreated: false },
  },
  ...(["wait", "testify", "break", "receipts"] as const).flatMap((step) =>
    (["passkey", "backup"] as const).map((factors) => ({
      step,
      tag: `sealed-${factors}`,
      state: SEALED(factors),
    })),
  ),
];

const GOLDEN_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "__golden__",
  "seal-page-demo",
);
const RECORD = process.env.RECORD_GOLDEN === "1";

function renderCase(golden: GoldenCase): string {
  stub.step = golden.step;
  stub.state = golden.state;
  return renderToStaticMarkup(
    createElement(SealPage, {
      rpId: RP_ID,
      appOrigin: APP_ORIGIN,
      mode: "demo",
      deps: { nowMs: () => NOW_MS },
    }),
  );
}

describe("SealPage demo markup goldens (spec 19, task 1.1)", () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW_MS);
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  for (const golden of CASES) {
    const file = `${golden.step}--${golden.tag}.html`;
    it(`matches the baseline golden ${file}`, () => {
      const html = renderCase(golden);
      const path = join(GOLDEN_DIR, file);
      if (RECORD) {
        mkdirSync(GOLDEN_DIR, { recursive: true });
        writeFileSync(path, html, "utf8");
        return;
      }
      expect(existsSync(path), `missing golden ${file}`).toBe(true);
      expect(readFileSync(path, "utf8")).toBe(html);
    });
  }
});
