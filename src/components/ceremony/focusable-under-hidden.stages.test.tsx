// Feature: 11-any-letter, Property 12 (X5.4)
//
// Every Stage of the ceremony, rendered at a wide and a phone layout, has no
// focusable element under an `aria-hidden="true"` ancestor. A Stage that renders
// a control under a hidden subtree fails here.
//
// The layout only changes CSS in this codebase (`isWideLayout` is read by the
// scene's geometry, not by the markup), so the two layouts render the same
// markup. Both are checked anyway, so a later change that makes the markup
// depend on the width is caught. Stages the flow cannot reach statically
// (`seal` and `figures`, which need a local view) are rendered from their own
// views with the same checks.

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { Opened, FlowState } from "../reveal/opening-machine";
import type { PayloadV1 } from "@/lib/seal-format";
import type { RecallRecordV2, Draft } from "@/lib/recall";
import { focusableUnderHidden } from "./focusable-under-hidden";
import { stageFor, DEFAULT_LOCAL_VIEW, type Stage } from "./stages";
import type { SealController } from "./seal/useSealBreak";

// --- fixtures ----------------------------------------------------------------

const QUESTIONS: PayloadV1["recall_questions"] = [
  {
    id: "q-fuel",
    answer_type: "number",
    text: "QUESTION_FUEL_TEXT what did a gallon cost then?",
    metric_id: "fuel",
  },
];

const PAYLOAD = {
  format_version: 1,
  letter_text: "LETTER_BODY_SECRET the letter text.",
  metrics: [
    {
      id: "fuel",
      display_name: "Regular gasoline",
      unit: "USD per gallon",
      region: "U.S. city average",
      source: "U.S. EIA",
      series_id: "EMM_EPMR_PTE_NUS_DPG",
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

const RECORD: RecallRecordV2 = {
  version: 2,
  answers: [{ question_id: "q-fuel", kind: "number", value: "3.50" }],
};

const DRAFTS: Record<string, Draft> = {
  "q-fuel": { text: "3.50", noAnswer: false },
};

/** One FlowState per reachable Flow state, with the Stage it resolves to. */
const FLOW_STATES: Array<{ name: string; state: FlowState; stage: Stage }> = [
  { name: "loading", state: { tag: "loading" }, stage: "emerging" },
  {
    name: "sealed",
    state: { tag: "sealed", opensAt: "2024-11-05T00:00:00.000Z" },
    stage: "sealed",
  },
  {
    name: "awaiting_key",
    state: {
      tag: "awaiting_key",
      envelope: {},
      envelopeHash: "h",
      unlock: { passkey: { rpId: "revenant.devclef.se" }, backup: true },
      notice: null,
    },
    stage: "envelope",
  },
  {
    name: "recall",
    state: { tag: "recall", opened: OPENED, drafts: DRAFTS, invalid: [] },
    stage: "recall",
  },
  {
    name: "reveal stage 1 (marks)",
    state: { tag: "reveal", opened: OPENED, record: RECORD, stage: 1 },
    stage: "marks",
  },
  {
    name: "reveal stage 2 (letter)",
    state: { tag: "reveal", opened: OPENED, record: RECORD, stage: 2 },
    stage: "letter",
  },
  {
    name: "reveal stage 3 (close, settled)",
    state: { tag: "reveal", opened: OPENED, record: RECORD, stage: 3 },
    stage: "close",
  },
  { name: "not_placed", state: { tag: "not_placed" }, stage: "error" },
  { name: "unreachable", state: { tag: "unreachable" }, stage: "error" },
];

// --- mocks -------------------------------------------------------------------

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

// The motion mode is `full` for the layout pass. `MotionProvider` passes
// children through so the tree mounts as on a real page.
vi.mock("./motion", () => ({
  useMotion: () => ({ mode: "full", setCalm: vi.fn() }),
  useCalmInForce: () => false,
  MotionProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("./skip", () => ({
  useSequence: () => ({
    hasActive: false,
    register: () => () => {},
    skipAll: vi.fn(),
  }),
  SkipProvider: ({ children }: { children: ReactNode }) => children,
}));

// Imported after the mocks (vi.mock is hoisted).
import { OpeningFlow } from "../reveal/OpeningFlow";
import { SealBreak } from "./seal/SealBreak";
import { FiguresFadeUp } from "./figures/FiguresFadeUp";
import { LiveRegionProvider } from "./LiveRegion";
import { LocalViewProvider } from "./local-view";

/** The two layouts the ceremony is checked at (spec 11 X5.4). */
const LAYOUTS = [
  { name: "wide", width: 1280, height: 800 },
  { name: "phone", width: 360, height: 640 },
] as const;

function renderFlow(state: FlowState): string {
  currentState = state;
  return renderToStaticMarkup(
    createElement(OpeningFlow, {
      letterId: "letter-1",
      personaName: "Maya",
      mode: "persona",
    }),
  );
}

/** A stub seal controller, so `SealBreak` renders its Seal_Group. */
function stubSeal(): SealController {
  return {
    hold: { phase: "idle" } as unknown as SealController["hold"],
    broken: false,
    progress: 0,
    press: () => {},
    breakNow: () => {},
    showAll: () => {},
  } as unknown as SealController;
}

describe("focusable elements under aria-hidden, every Stage (spec 11 X5.4)", () => {
  // The Stage list is fixed by stages.ts. Every Stage must be rendered below.
  const COVERED: Stage[] = [
    "emerging",
    "sealed",
    "envelope",
    "recall",
    "marks",
    "seal",
    "letter",
    "figures",
    "close",
    "error",
  ];

  it("covers every Stage the ceremony can resolve", () => {
    const resolved = new Set<Stage>(
      FLOW_STATES.map((entry) => stageFor(entry.state, DEFAULT_LOCAL_VIEW)),
    );
    // `seal` and `figures` need a local view the static render never holds, so
    // they are checked through their own views below.
    resolved.add(
      stageFor(
        { tag: "reveal", opened: OPENED, record: RECORD, stage: 1 },
        { ...DEFAULT_LOCAL_VIEW, sealing: true },
      ),
    );
    resolved.add(
      stageFor(
        { tag: "reveal", opened: OPENED, record: RECORD, stage: 3 },
        { ...DEFAULT_LOCAL_VIEW, figures: "running" },
      ),
    );
    for (const stage of COVERED) {
      expect(resolved.has(stage)).toBe(true);
    }
  });

  for (const layout of LAYOUTS) {
    describe(`at ${layout.name} (${layout.width}x${layout.height})`, () => {
      for (const entry of FLOW_STATES) {
        it(`renders stage "${entry.stage}" (${entry.name}) with no focusable element under aria-hidden`, () => {
          const html = renderFlow(entry.state);
          expect(html.length).toBeGreaterThan(0);
          expect(focusableUnderHidden(html)).toEqual([]);
        });
      }

      it('renders stage "seal" (the Seal_Group) with no focusable element under aria-hidden', () => {
        const html = renderToStaticMarkup(
          createElement(
            LiveRegionProvider,
            null,
            createElement(SealBreak, {
              patternKey: "maya",
              seal: stubSeal(),
              calm: false,
              hasFigures: true,
            }),
          ),
        );
        // The check is not vacuous: the Seal_Group renders a button to check.
        expect(html).toMatch(/<button/);
        expect(focusableUnderHidden(html)).toEqual([]);
      });

      it('renders stage "figures" (the figures column) with no focusable element under aria-hidden', () => {
        const html = renderToStaticMarkup(
          <LocalViewProvider>
            <FiguresFadeUp count={1}>
              <div>figure</div>
            </FiguresFadeUp>
          </LocalViewProvider>,
        );
        expect(focusableUnderHidden(html)).toEqual([]);
      });
    });
  }
});
