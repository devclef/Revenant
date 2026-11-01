// Feature: 03-persona-demo, Property 17
//
// Property: nothing from inside the letter is revealed before the encrypted
// recall record is stored. This holds the Opening_Flow to its non-negotiable
// gate across the whole event space, not a handful of worked sequences.
//
// Two halves, both with fast-check (numRuns 100):
//
// 1. Reducer clauses. From the initial state, apply a random sequence of every
//    FlowEvent type and assert the clauses that gate the reveal in full, after
//    EVERY step of EVERY sequence:
//      - recall is reached only after a verified open (R7.5);
//      - reveal is entered only directly after POST_OK in submitting, always at
//        stage 1 (R8.1, R8.6, R9.1);
//      - stage only increases, by 1 per ADVANCE or straight to 3 per SHOW_ALL,
//        never past 3 and never backwards (R9.4);
//      - in submitting, SUBMIT/RETRY_POST (and any resubmit) leave it unchanged
//        (R8.9);
//      - RETRY_POST from submit_failed carries the identical sealed ciphertext
//        and nonce (R8.7);
//      - START is accepted only in initial/unreachable/sealed (R7.1).
//
// 2. Render clauses. For every state this task's views render, assert the
//    renderToStaticMarkup output:
//      - the sealed letter text appears only in a reveal at stage >= 2
//        (SealedLetter), and nowhere earlier (R9.1);
//      - the sealed figure value/source/series/url appear only in a reveal at
//        stage 3 (FiguresThenNow), and nowhere earlier; the raw figure period
//        is reformatted so it never appears verbatim, at any stage (R9.1);
//      - recall question text appears only in recall/submitting/submit_failed/
//        reveal (R8.1, R9.4);
//      - no sealed payload string appears at all in verification_failed/
//        open_failed/not_placed/unreachable (R7.6, R7.7).
//
// Validates R7.1, R7.5, R7.6, R7.7, R8.1, R8.6, R8.7, R8.9, R9.1, R9.4.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fc from "fast-check";

import type { RecallRecordV1, Draft } from "@/lib/recall";
import type { PayloadV1 } from "@/lib/seal-format";
import { CEREMONY_COPY } from "@/components/ceremony/copy";
import {
  INITIAL_STATE,
  reduce,
  type FlowState,
  type FlowEvent,
  type Opened,
  type SealedRecord,
  type OpenFailedKind,
} from "./opening-machine";

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
      // Chosen so the figure's period ("July 2024") never collides with the
      // seal date ("1 October 2024") or opening date ("5 November 2024"), so the
      // stage-3 period assertion below distinguishes the figure stage cleanly.
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
};

const RECORD: RecallRecordV1 = {
  version: 1,
  answers: [
    { question_id: "q-fuel", kind: "number", value: "3.50" },
    { question_id: "q-milk", kind: "no_answer" },
  ],
};

const SEALED: SealedRecord = {
  ciphertext: "Y2lwaGVydGV4dA",
  nonce: "bm9uY2U",
};

/**
 * Strings from inside the letter that appear only in the figure stage (reveal
 * stage 3) and never earlier. These are the raw sealed values as stored; the
 * period is held separately because `FigureLine` reformats it (see
 * STAGE3_FIGURE_RENDERED below), so its raw form never appears in any markup.
 */
const SEALED_PAYLOAD_STRINGS = [
  "3.412", // the sealed figure value (formatValue keeps the digits verbatim)
  "2024-07", // the figure's period, raw: reformatted at stage 3, so never shown
  "U.S. EIA", // the figure's source
  "EMM_EPMR_PTE_NUS_DPG", // the series id
  "https://www.eia.gov/fixture", // the source url
] as const;

/**
 * The figure strings that DO render verbatim in the stage-3 markup. The period
 * is omitted on purpose: `FigureLine` formats "2024-07" to "July 2024"
 * (format-change.ts `formatPeriod`), so the raw period never appears anywhere.
 * Its formatted form is asserted via STAGE3_FIGURE_RENDERED instead.
 */
const STAGE3_VERBATIM_STRINGS = [
  "3.412",
  "U.S. EIA",
  "EMM_EPMR_PTE_NUS_DPG",
  "https://www.eia.gov/fixture",
] as const;

/** The sealed period as stage 3 renders it ("2024-07" -> "July 2024"). */
const STAGE3_FIGURE_RENDERED = "July 2024";

const QUESTION_TEXTS = QUESTIONS.map((q) => q.text);

// --- arbitraries -------------------------------------------------------------

const OPEN_FAILED_KINDS: OpenFailedKind[] = [
  "wrong_key",
  "tampered",
  "unsupported_format",
  "invalid_payload",
  "invalid_input",
];

// Every FlowEvent type, with fixed payloads so the oracle below can reason about
// them. Covers all events the reducer handles; payload values are the fixtures
// so equality checks stay exact.
const eventArb: fc.Arbitrary<FlowEvent> = fc.oneof(
  fc.constant<FlowEvent>({ type: "START" }),
  fc.constant<FlowEvent>({
    type: "LETTER_SEALED",
    opensAt: "2030-01-01T00:00:00.000Z",
  }),
  fc.constant<FlowEvent>({
    type: "LETTER_OPENABLE",
    envelope: { e: 1 },
    envelopeHash: "hash",
  }),
  fc.constant<FlowEvent>({ type: "LETTER_NOT_PLACED" }),
  fc.constant<FlowEvent>({ type: "UNREACHABLE" }),
  fc.constant<FlowEvent>({
    type: "SECRET_FORBIDDEN",
    opensAt: "2030-01-01T00:00:00.000Z",
  }),
  fc.constant<FlowEvent>({ type: "SECRET_OK" }),
  fc.constant<FlowEvent>({ type: "OPENED", opened: OPENED }),
  fc.constant<FlowEvent>({ type: "VERIFICATION_FAILED" }),
  ...OPEN_FAILED_KINDS.map((kind) =>
    fc.constant<FlowEvent>({ type: "OPEN_FAILED", kind }),
  ),
  fc.constant<FlowEvent>({ type: "BEGIN" }),
  fc.constant<FlowEvent>({ type: "EDIT_DRAFT", id: "q-fuel", text: "3.50" }),
  fc.constant<FlowEvent>({
    type: "TOGGLE_NO_ANSWER",
    id: "q-milk",
    noAnswer: true,
  }),
  fc.constant<FlowEvent>({ type: "SUBMIT_INVALID", invalid: ["q-fuel"] }),
  fc.constant<FlowEvent>({
    type: "RECORD_SEALED",
    record: RECORD,
    sealed: SEALED,
  }),
  fc.constant<FlowEvent>({ type: "POST_OK" }),
  fc.constant<FlowEvent>({ type: "POST_FAILED" }),
  fc.constant<FlowEvent>({ type: "RETRY_POST" }),
  fc.constant<FlowEvent>({ type: "ADVANCE" }),
  fc.constant<FlowEvent>({ type: "SHOW_ALL" }),
);

const sequenceArb = fc.array(eventArb, { minLength: 1, maxLength: 40 });

// --- reducer clauses ---------------------------------------------------------

describe("Property 17: reducer never reveals before answers are stored", () => {
  it("holds every reveal-gating clause after each step of a random sequence", () => {
    fc.assert(
      fc.property(sequenceArb, (events) => {
        let state: FlowState = INITIAL_STATE;

        for (const event of events) {
          const prev = state;
          const next = reduce(prev, event);

          // R7.5: recall is reached only from a verified open via BEGIN.
          if (next.tag === "recall" && prev.tag !== "recall") {
            expect(prev.tag).toBe("verified");
            expect(event.type).toBe("BEGIN");
          }

          // R8.1, R8.6, R9.1: reveal is entered only directly after POST_OK in
          // submitting, and always at stage 1.
          if (next.tag === "reveal" && prev.tag !== "reveal") {
            expect(prev.tag).toBe("submitting");
            expect(event.type).toBe("POST_OK");
            expect(next.stage).toBe(1);
          }

          // R9.4: within reveal, the stage only moves forward: +1 on ADVANCE
          // (capped at 3), straight to 3 on SHOW_ALL, unchanged otherwise. It
          // never decreases and never passes 3.
          if (prev.tag === "reveal" && next.tag === "reveal") {
            expect(next.stage).toBeGreaterThanOrEqual(prev.stage);
            expect(next.stage).toBeLessThanOrEqual(3);
            if (event.type === "ADVANCE") {
              expect(next.stage).toBe(Math.min(3, prev.stage + 1));
            } else if (event.type === "SHOW_ALL") {
              expect(next.stage).toBe(3);
            } else {
              expect(next.stage).toBe(prev.stage);
            }
          }

          // R8.9: in submitting, only POST_OK or POST_FAILED move the flow. A
          // resubmit (RECORD_SEALED) or RETRY_POST leaves it unchanged.
          if (prev.tag === "submitting") {
            if (event.type === "POST_OK") {
              expect(next.tag).toBe("reveal");
            } else if (event.type === "POST_FAILED") {
              expect(next.tag).toBe("submit_failed");
            } else {
              expect(next).toBe(prev);
            }
          }

          // R8.7: RETRY_POST from submit_failed re-enters submitting with the
          // identical sealed bytes and record (same reference, same bytes).
          if (prev.tag === "submit_failed" && event.type === "RETRY_POST") {
            expect(next.tag).toBe("submitting");
            if (next.tag === "submitting") {
              expect(next.sealed).toBe(prev.sealed);
              expect(next.sealed.ciphertext).toBe(prev.sealed.ciphertext);
              expect(next.sealed.nonce).toBe(prev.sealed.nonce);
              expect(next.record).toBe(prev.record);
            }
          }

          // R7.1: START only (re)starts the fetch from initial/unreachable/
          // sealed; it is ignored everywhere else.
          if (event.type === "START") {
            if (
              prev.tag === "loading" ||
              prev.tag === "unreachable" ||
              prev.tag === "sealed"
            ) {
              expect(next).toEqual({ tag: "loading" });
            } else {
              expect(next).toBe(prev);
            }
          }

          state = next;
        }
      }),
      { numRuns: 100 },
    );
  });
});

// --- render clauses ----------------------------------------------------------
//
// Render every state this task's views can reach and scan the static markup.
// `OpeningFlow` calls `useOpeningFlow` once; its effects do not run under a
// static render, so the hook is mocked to return a fixed state and no-op
// handlers (the same technique as OpeningFlow.test.tsx). A fetch guard fails any
// network call, since the selector must render from state alone.

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

vi.mock("./useOpeningFlow", () => ({
  useOpeningFlow: () => ({ state: currentState, ...handlers }),
}));

// Imported after the mock is declared (vi.mock is hoisted).
import { OpeningFlow } from "./OpeningFlow";

function render(state: FlowState): string {
  currentState = state;
  return renderToStaticMarkup(
    createElement(OpeningFlow, { letterId: "letter-1", personaName: "Maya" }),
  );
}

// Every reachable state this task renders, with the slice each view needs. The
// `revealsQuestion` flag marks the states whose view may render a recall
// question text (RecallStep or RememberedAnswers); every other state must not.
// `revealsLetter` marks the states that render the sealed letter text (reveal
// stage >= 2); `revealsFigures` marks the states that render the sealed figure
// values/period/source/series/url (reveal stage 3 only).
type RenderCase = {
  state: FlowState;
  revealsQuestion: boolean;
  revealsLetter: boolean;
  revealsFigures: boolean;
};

const RENDER_CASES: RenderCase[] = [
  {
    state: { tag: "loading" },
    revealsQuestion: false,
    revealsLetter: false,
    revealsFigures: false,
  },
  {
    state: { tag: "sealed", opensAt: "2024-11-05T00:00:00.000Z" },
    revealsQuestion: false,
    revealsLetter: false,
    revealsFigures: false,
  },
  {
    state: { tag: "openable", envelope: {}, envelopeHash: "h" },
    revealsQuestion: false,
    revealsLetter: false,
    revealsFigures: false,
  },
  {
    state: { tag: "verifying" },
    revealsQuestion: false,
    revealsLetter: false,
    revealsFigures: false,
  },
  {
    state: { tag: "verified", opened: OPENED },
    revealsQuestion: false,
    revealsLetter: false,
    revealsFigures: false,
  },
  {
    state: {
      tag: "recall",
      opened: OPENED,
      drafts: {} as Record<string, Draft>,
      invalid: [],
    },
    revealsQuestion: true,
    revealsLetter: false,
    revealsFigures: false,
  },
  {
    state: {
      tag: "submitting",
      opened: OPENED,
      drafts: {} as Record<string, Draft>,
      record: RECORD,
      sealed: SEALED,
    },
    revealsQuestion: true,
    revealsLetter: false,
    revealsFigures: false,
  },
  {
    state: {
      tag: "submit_failed",
      opened: OPENED,
      drafts: {} as Record<string, Draft>,
      record: RECORD,
      sealed: SEALED,
    },
    revealsQuestion: true,
    revealsLetter: false,
    revealsFigures: false,
  },
  // Reveal stage 1: the `marks` Stage. The judge's remembered answers, the
  // unbroken seal and the "Break the seal" button. No letter, no figures.
  {
    state: { tag: "reveal", opened: OPENED, record: RECORD, stage: 1 },
    revealsQuestion: true,
    revealsLetter: false,
    revealsFigures: false,
  },
  // Reveal stage 2: the sealed letter is now shown (R9.1); figures are not yet.
  {
    state: { tag: "reveal", opened: OPENED, record: RECORD, stage: 2 },
    revealsQuestion: true,
    revealsLetter: true,
    revealsFigures: false,
  },
  // Reveal stage 3: letter and the figures then vs now are both shown.
  {
    state: { tag: "reveal", opened: OPENED, record: RECORD, stage: 3 },
    revealsQuestion: true,
    revealsLetter: true,
    revealsFigures: true,
  },
  {
    state: { tag: "not_placed" },
    revealsQuestion: false,
    revealsLetter: false,
    revealsFigures: false,
  },
  {
    state: { tag: "unreachable" },
    revealsQuestion: false,
    revealsLetter: false,
    revealsFigures: false,
  },
  {
    state: { tag: "verification_failed" },
    revealsQuestion: false,
    revealsLetter: false,
    revealsFigures: false,
  },
  {
    state: { tag: "open_failed", kind: "wrong_key" },
    revealsQuestion: false,
    revealsLetter: false,
    revealsFigures: false,
  },
];

// The states whose view holds NO Opened at all, so not one sealed payload string
// may appear (R7.6, R7.7).
const PAYLOAD_FREE_TAGS = new Set([
  "verification_failed",
  "open_failed",
  "not_placed",
  "unreachable",
]);

describe("Property 17: views never render letter content before the reveal", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => {
        throw new Error("a rendered view tried to fetch");
      }),
    );
    for (const handler of Object.values(handlers)) {
      handler.mockClear();
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the letter text only in a reveal at stage >= 2 (R9.1)", () => {
    // The letter body belongs to reveal stage 2 (SealedLetter): it appears in a
    // reveal at stage 2 or 3 and nowhere else. fast-check drives the same render
    // repeatedly to pin the invariant with numRuns 100, as Property 17 requires.
    fc.assert(
      fc.property(
        fc.constantFrom(...RENDER_CASES),
        ({ state, revealsLetter }) => {
          const html = render(state);
          if (revealsLetter) {
            expect(html).toContain(PAYLOAD.letter_text);
          } else {
            expect(
              html.includes(PAYLOAD.letter_text),
              `${state.tag} must not render the sealed letter text`,
            ).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("renders the marks Stage at reveal stage 1: unbroken seal and \"Break the seal\" (SealBreak)", () => {
    // Stage 1 is the `marks` Stage. It shows the seal-break control and never
    // the old stage-1 \"Read the letter\" button (stage1Next was removed). The
    // seal-break control belongs to stage 1 only: once the seal has broken and
    // the reveal is at stage 2 or 3, it is gone.
    const stage1 = RENDER_CASES.filter(
      (c) => c.state.tag === "reveal" && c.state.stage === 1,
    );
    const afterBreak = RENDER_CASES.filter(
      (c) =>
        c.state.tag === "reveal" && (c.state.stage === 2 || c.state.stage === 3),
    );
    fc.assert(
      fc.property(fc.constantFrom(...stage1), ({ state }) => {
        const html = render(state);
        expect(html).toContain(CEREMONY_COPY.sealButton);
        expect(html).not.toContain("Read the letter");
        expect(html).not.toContain(PAYLOAD.letter_text);
        for (const needle of STAGE3_VERBATIM_STRINGS) {
          expect(html.includes(needle)).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
    fc.assert(
      fc.property(fc.constantFrom(...afterBreak), ({ state }) => {
        const html = render(state);
        expect(
          html.includes(CEREMONY_COPY.sealButton),
          `${state.tag} must not render the seal-break button after the break`,
        ).toBe(false);
        expect(html.includes("Read the letter")).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("renders recall question text only in recall/submitting/submit_failed/reveal", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...RENDER_CASES),
        ({ state, revealsQuestion }) => {
          const html = render(state);
          for (const text of QUESTION_TEXTS) {
            if (revealsQuestion) {
              // RememberedAnswers (reveal) and RecallStep render every question.
              expect(html).toContain(text);
            } else {
              expect(
                html.includes(text),
                `${state.tag} must not render question "${text}"`,
              ).toBe(false);
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("renders no sealed payload string in any payload-free error state", () => {
    const errorCases = RENDER_CASES.filter((c) =>
      PAYLOAD_FREE_TAGS.has(c.state.tag),
    );
    fc.assert(
      fc.property(fc.constantFrom(...errorCases), ({ state }) => {
        const html = render(state);
        // The letter body must never leak from a payload-free error state.
        expect(
          html.includes(PAYLOAD.letter_text),
          `${state.tag} must not leak the letter text`,
        ).toBe(false);
        for (const needle of SEALED_PAYLOAD_STRINGS) {
          expect(
            html.includes(needle),
            `${state.tag} must not leak "${needle}"`,
          ).toBe(false);
        }
        for (const text of QUESTION_TEXTS) {
          expect(
            html.includes(text),
            `${state.tag} must not leak question "${text}"`,
          ).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("renders the sealed figure strings only in the reveal's figure stage (stage 3, R9.1)", () => {
    // The figure value, source, series and url belong to reveal stage 3
    // (FiguresThenNow): they appear only in a reveal at stage 3 and nowhere
    // earlier. The raw period "2024-07" is never shown even at stage 3, because
    // FigureLine reformats it to "July 2024"; the formatted form is asserted at
    // stage 3 and the raw form is asserted absent everywhere.
    fc.assert(
      fc.property(
        fc.constantFrom(...RENDER_CASES),
        ({ state, revealsFigures }) => {
          const html = render(state);

          // The raw period is reformatted by FigureLine, so it never appears in
          // any markup, at any stage.
          expect(
            html.includes("2024-07"),
            `${state.tag} must not render the raw sealed period`,
          ).toBe(false);

          if (revealsFigures) {
            for (const needle of STAGE3_VERBATIM_STRINGS) {
              expect(html).toContain(needle);
            }
            // The period is shown, formatted, only at the figure stage.
            expect(html).toContain(STAGE3_FIGURE_RENDERED);
          } else {
            for (const needle of STAGE3_VERBATIM_STRINGS) {
              expect(
                html.includes(needle),
                `${state.tag} must not leak sealed figure "${needle}"`,
              ).toBe(false);
            }
            expect(
              html.includes(STAGE3_FIGURE_RENDERED),
              `${state.tag} must not render the sealed figure period`,
            ).toBe(false);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
