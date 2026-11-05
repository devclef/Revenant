// Feature: 05-reveal-ceremony, Properties 19, 20 and 21
//
// Three properties over the Ceremony views, each checked with fast-check
// (numRuns 100) across the reachable Flow states:
//
//   - Property 19: every gesture has a plain control, and every running
//     sequence renders a visible Skip (R11.1, R11.4, R6.3).
//   - Property 20: Calm_Mode starts no animation. Every plan that takes a
//     motion mode returns an empty plan, and each view renders its settled
//     final state (R11.2, R11.3). The desk decor clause went with the desk
//     (spec 07 task 9).
//   - Property 21: the same render on the server and the client. Rendering
//     twice with `Math.random` and `Date.now` stubbed to different values gives
//     identical markup (R17.3, R8.4).
//
// The views are rendered with `renderToStaticMarkup`. `useOpeningFlow` is
// mocked to return a fixed state (the same technique as OpeningFlow.test.tsx),
// and the motion mode and the Skip context are mocked so each render can show
// any mode and any running-sequence state.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";

import type { RecallRecordV1, Draft } from "@/lib/recall";
import type { PayloadV1 } from "@/lib/seal-format";
import { formatPeriod } from "@/lib/figures";
import { CEREMONY_COPY } from "./copy";
import { planSealBreak } from "./seal/SealBreak";
import type { FlowState, Opened } from "../reveal/opening-machine";

// --- fixtures ----------------------------------------------------------------

const QUESTIONS: PayloadV1["recall_questions"] = [
  {
    id: "q-fuel",
    answer_type: "number",
    text: "QUESTION_FUEL_TEXT what did a gallon cost then?",
    metric_id: "fuel",
  },
  {
    id: "q-milk",
    answer_type: "number",
    text: "QUESTION_MILK_TEXT what did a litre of milk cost then?",
    metric_id: "milk",
  },
];

const PAYLOAD = {
  format_version: 1,
  letter_text: "LETTER_BODY_SECRET the letter text must never appear here.",
  metrics: [
    {
      id: "fuel",
      display_name: "Regular gasoline",
      unit: "USD per gallon",
      region: "U.S. city average",
      source: "U.S. EIA",
      series_id: "EMM_EPMR_PTE_NUS_DPG",
    },
    {
      id: "milk",
      display_name: "Whole milk",
      unit: "USD per gallon",
      region: "U.S. city average",
      source: "U.S. BLS",
      series_id: "APU0000709112",
    },
  ],
  figures: [
    {
      kind: "official",
      metric_id: "fuel",
      value: "3.412",
      unit: "USD per gallon",
      region: "U.S. city average",
      period: "2024-07",
      source: "U.S. EIA",
      series_id: "EMM_EPMR_PTE_NUS_DPG",
      retrieved_at: "2024-10-30T14:02:11Z",
      source_url: "https://www.eia.gov/fixture",
    },
  ],
  recall_questions: QUESTIONS,
} satisfies PayloadV1;

const OPENED: Opened = {
  letterId: "letter-1",
  header: {
    sealedAt: "2024-10-01T00:00:00.000Z",
    opensAt: "2024-11-05T00:00:00.000Z",
  },
  payload: PAYLOAD,
  openingKey: {} as unknown as CryptoKey,
  envelopeHash:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
};

const RECORD: RecallRecordV1 = {
  version: 1,
  answers: [
    { question_id: "q-fuel", kind: "number", value: "3.50" },
    { question_id: "q-milk", kind: "no_answer" },
  ],
};

const SEALED = { ciphertext: "Y2lwaGVydGV4dA", nonce: "bm9uY2U" };

const DRAFTS: Record<string, Draft> = {
  "q-fuel": { text: "3.50", noAnswer: false },
  "q-milk": { text: "", noAnswer: true },
};

/** Every reachable state the Ceremony views render, with the Flow state for each. */
const FLOW_STATES: FlowState[] = [
  { tag: "loading" },
  { tag: "sealed", opensAt: "2024-11-05T00:00:00.000Z" },
  { tag: "openable", envelope: {}, envelopeHash: "h" },
  { tag: "verifying" },
  { tag: "verified", opened: OPENED },
  { tag: "recall", opened: OPENED, drafts: DRAFTS, invalid: [] },
  {
    tag: "submitting",
    opened: OPENED,
    drafts: DRAFTS,
    record: RECORD,
    sealed: SEALED,
  },
  {
    tag: "submit_failed",
    opened: OPENED,
    drafts: DRAFTS,
    record: RECORD,
    sealed: SEALED,
  },
  { tag: "reveal", opened: OPENED, record: RECORD, stage: 1 },
  { tag: "reveal", opened: OPENED, record: RECORD, stage: 2 },
  { tag: "reveal", opened: OPENED, record: RECORD, stage: 3 },
  { tag: "not_placed" },
  { tag: "unreachable" },
  { tag: "verification_failed" },
  { tag: "open_failed", kind: "wrong_key" },
];

const MODES = ["full", "light", "calm"] as const;
type Mode = (typeof MODES)[number];

// --- mocks -------------------------------------------------------------------
//
// The flow hook returns a fixed state and no-op handlers.

let currentState: FlowState = { tag: "loading" };

const handlers = {
  retry: vi.fn(),
  begin: vi.fn(),
  editDraft: vi.fn(),
  toggleNoAnswer: vi.fn(),
  submit: vi.fn(),
  retryPost: vi.fn(),
  advance: vi.fn(),
  showAll: vi.fn(),
};

vi.mock("../reveal/useOpeningFlow", () => ({
  useOpeningFlow: () => ({ state: currentState, ...handlers }),
}));

// The motion mode is mocked so a static render can show `calm` and `light`.
// `MotionProvider` is a pass-through so the tree mounts as on a real page.
let currentMode: Mode = "full";

vi.mock("./motion", () => ({
  useMotion: () => ({ mode: currentMode, setCalm: vi.fn() }),
  MotionProvider: ({ children }: { children: ReactNode }) => children,
}));

// The Skip context is mocked so a test decides whether a sequence is running.
let sequenceRunning = false;

vi.mock("./skip", () => ({
  useSequence: () => ({
    hasActive: sequenceRunning,
    register: () => () => {},
    skipAll: vi.fn(),
  }),
  SkipProvider: ({ children }: { children: ReactNode }) => children,
}));

// Imported after the mocks (vi.mock is hoisted).
import { OpeningFlow } from "../reveal/OpeningFlow";

function render(
  state: FlowState,
  mode: "persona" | "live" = "persona",
): string {
  currentState = state;
  return renderToStaticMarkup(
    createElement(OpeningFlow, { letterId: "letter-1", personaName: "Maya", mode }),
  );
}

/** Count `<button ...>text</button>` elements whose text is exactly `text`. */
function countButtons(html: string, text: string): number {
  const pattern = new RegExp(`<button[^>]*>${text}</button>`, "g");
  return (html.match(pattern) ?? []).length;
}

const HERE = dirname(fileURLToPath(import.meta.url));

/** Every non-test ceremony source file, as absolute path and text. */
function ceremonySources(): Array<{ path: string; text: string }> {
  const out: Array<{ path: string; text: string }> = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (
        /\.(ts|tsx)$/.test(entry.name) &&
        !/\.test\.(ts|tsx)$/.test(entry.name)
      ) {
        out.push({ path: full, text: readFileSync(full, "utf8") });
      }
    }
  };
  walk(HERE);
  return out;
}

// --- Property 19 -------------------------------------------------------------

describe("Property 19: every gesture has a plain control (R11.1, R11.4)", () => {
  it("gives every pointer-gesture file a key handler or a button in the same file", () => {
    const sources = ceremonySources();
    const gestureFiles = sources.filter((file) =>
      file.text.includes("onPointerDown"),
    );
    // Non-vacuous: the two known gesture views must be among them. The seal's
    // pointer target is HeldSeal (task 5); its plain control is the button in
    // the sibling SealBreak, which is checked below.
    const names = gestureFiles.map((file) => relative(HERE, file.path));
    expect(names).toContain(join("recall", "RecallScale.tsx"));
    expect(names).toContain(join("seal", "HeldSeal.tsx"));

    const sealBreak = sources.find(
      (file) => relative(HERE, file.path) === join("seal", "SealBreak.tsx"),
    );
    for (const file of gestureFiles) {
      const hasKeyHandler = file.text.includes("onKeyDown");
      const hasButton = file.text.includes("<button");
      const pairedButton =
        relative(HERE, file.path) === join("seal", "HeldSeal.tsx") &&
        (sealBreak?.text.includes("<button") ?? false);
      expect(
        hasKeyHandler || hasButton || pairedButton,
        `${relative(HERE, file.path)} has a pointer gesture with no plain control`,
      ).toBe(true);
    }
  });

  it("renders the Break the seal button at stage 1, the hold control's plain equivalent", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<FlowState>(
          { tag: "reveal", opened: OPENED, record: RECORD, stage: 1 },
        ),
        (state) => {
          const html = render(state);
          expect(countButtons(html, CEREMONY_COPY.sealButton)).toBe(1);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("renders the Look closer button wherever the recall scale can be edited", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<FlowState>(
          { tag: "recall", opened: OPENED, drafts: DRAFTS, invalid: [] },
          {
            tag: "submitting",
            opened: OPENED,
            drafts: DRAFTS,
            record: RECORD,
            sealed: SEALED,
          },
        ),
        (state) => {
          const html = render(state);
          expect(countButtons(html, CEREMONY_COPY.recallLookCloser)).toBe(1);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("Property 19: every running sequence has a visible Skip (R6.3)", () => {
  it("shows exactly one Skip while a sequence runs and none while none does", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...FLOW_STATES),
        fc.constantFrom(...MODES),
        fc.boolean(),
        (state, mode, running) => {
          currentMode = mode;
          sequenceRunning = running;
          // Live mode keeps Skip inside the region; persona mode moves it to the
          // Top_Bar (spec 07, R8.3), which this file does not render.
          const html = render(state, "live");
          expect(
            countButtons(html, CEREMONY_COPY.skip),
            `${state.tag} in ${mode} with ${running ? "a" : "no"} running sequence`,
          ).toBe(running ? 1 : 0);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("registers the running sequences with useSequence", () => {
    // Non-vacuous: the Seal_Break and the figures fade-up each call
    // useSequence, so each one is covered by the Skip check above.
    const sources = ceremonySources();
    for (const name of [
      join("seal", "SealBreak.tsx"),
      join("figures", "FiguresFadeUp.tsx"),
    ]) {
      const file = sources.find((s) => relative(HERE, s.path) === name);
      expect(file, `${name} exists`).toBeDefined();
      expect(file?.text, `${name} registers with useSequence`).toContain(
        "useSequence(",
      );
    }
  });
});

// --- Property 20 -------------------------------------------------------------

describe("Property 20: Calm_Mode starts no animation (R11.2, R11.3)", () => {
  it("plans an empty Seal_Break in calm, and four steps in full motion", () => {
    expect(planSealBreak({ calm: true }).steps).toHaveLength(0);
    expect(planSealBreak({ calm: false }).steps).toHaveLength(4);
  });

  it("settles the figures in calm: stage 3 is close, never figures", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<FlowState>({
          tag: "reveal",
          opened: OPENED,
          record: RECORD,
          stage: 3,
        }),
        (state) => {
          currentMode = "calm";
          const html = render(state);
          expect(html).toContain('data-ceremony="close"');
          expect(html).not.toContain('data-ceremony="figures"');
          // The final state's labels and numbers are all on the page.
          expect(html).toContain("3.412");
          expect(html).toContain(formatPeriod("2024-07", "U.S. city average"));
        },
      ),
      { numRuns: 100 },
    );
  });

  it("shows the letter text in calm at stage 2, unchanged", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<FlowState>({
          tag: "reveal",
          opened: OPENED,
          record: RECORD,
          stage: 2,
        }),
        (state) => {
          currentMode = "calm";
          expect(render(state)).toContain(PAYLOAD.letter_text);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("Property 20: the /l/[id] live flow has no Ghost and no Soil (spec 07 task 2)", () => {
  it("renders no Ghost, no Soil strip and no canvas in any live Stage", () => {
    const states: FlowState[] = [
      { tag: "loading" },
      { tag: "verified", opened: OPENED },
      { tag: "reveal", opened: OPENED, record: RECORD, stage: 1 },
      { tag: "reveal", opened: OPENED, record: RECORD, stage: 3 },
    ];
    for (const state of states) {
      const html = render(state, "live");
      expect(html).not.toContain("data-ghost-box");
      expect(html).not.toContain("data-soil-strip");
      expect(html).not.toContain("<canvas");
    }
  });
});

// --- Property 21 -------------------------------------------------------------

/** Render with `Math.random` and `Date.now` pinned to the given values. */
function renderWithStubs(
  state: FlowState,
  random: number,
  now: number,
): string {
  const randomSpy = vi.spyOn(Math, "random").mockReturnValue(random);
  const nowSpy = vi.spyOn(Date, "now").mockReturnValue(now);
  try {
    return render(state);
  } finally {
    randomSpy.mockRestore();
    nowSpy.mockRestore();
  }
}

describe("Property 21: the same render on the server and the client (R17.3, R8.4)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new Error("a rendered view tried to fetch");
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders identical markup when Math.random and Date.now differ between renders", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...FLOW_STATES),
        fc.constantFrom(...MODES),
        fc.double({ min: 0, max: 1, noNaN: true, maxExcluded: true }),
        fc.double({ min: 0, max: 1, noNaN: true, maxExcluded: true }),
        fc.integer({ min: 0, max: 4_000_000_000_000 }),
        fc.integer({ min: 0, max: 4_000_000_000_000 }),
        (state, mode, randomA, randomB, nowA, nowB) => {
          currentMode = mode;
          sequenceRunning = false;
          const server = renderWithStubs(state, randomA, nowA);
          const client = renderWithStubs(state, randomB, nowB);
          expect(
            client,
            `${state.tag} in ${mode} must render the same markup`,
          ).toBe(server);
        },
      ),
      { numRuns: 100 },
    );
  });
});
