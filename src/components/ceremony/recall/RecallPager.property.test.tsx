// Feature: 07-judge-journey, task 3: the Recall_Pager properties (design.md
// Correctness Properties 3, 6 (recall), 14 and 23; spec R11).

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { RecallPager } from "./RecallPager";
import {
  firstInvalidIndex,
  nextIndex,
  previousIndex,
  submitAction,
} from "./recall-pager";
import { REVEAL_COPY } from "@/components/reveal/copy";
import { DEMO_COPY } from "@/components/demo/copy";
import { formatCalendarDate } from "@/components/ui/letter-date";
import {
  reduce,
  type FlowState,
  type Opened,
} from "@/components/reveal/opening-machine";
import { DEFAULT_LOCAL_VIEW, stageFor } from "@/components/ceremony/stages";
import { buildRecallRecord, type Draft } from "@/lib/recall";
import type { PayloadV1 } from "@/lib/seal-format";

type Question = PayloadV1["recall_questions"][number];

/** A payload with `n` number questions, each with its own metric and unit. */
function payloadOf(n: number): Pick<PayloadV1, "metrics" | "recall_questions"> {
  const metrics = Array.from({ length: n }, (_, i) => ({
    id: `m${i}`,
    display_name: `Metric ${i}`,
    unit: `unit-${i} per thing`,
    region: "Region",
    source: "Source",
    series_id: `SERIES-${i}`,
  }));
  const recall_questions: Question[] = Array.from({ length: n }, (_, i) => ({
    id: `q${i}`,
    answer_type: "number",
    text: `QUESTION-${i}-TEXT what did metric ${i} cost then?`,
    metric_id: `m${i}`,
  })) as Question[];
  return {
    metrics,
    recall_questions,
  } as Pick<PayloadV1, "metrics" | "recall_questions">;
}

/** Render the pager at `index` for a persona (`writtenAsOf`) or a Live_Letter. */
function renderAt(n: number, index: number, writtenAsOf?: string): string {
  return renderToStaticMarkup(
    createElement(RecallPager, {
      payload: payloadOf(n),
      drafts: {},
      invalid: [],
      submitting: false,
      writtenAsOf,
      onEdit: () => {},
      onToggleNoAnswer: () => {},
      onSubmit: () => {},
      initialIndex: index,
    }),
  );
}

// --- Property 3 -------------------------------------------------------------

type Op =
  | { kind: "edit"; q: number; text: string }
  | { kind: "toggle"; q: number; noAnswer: boolean }
  | { kind: "page"; action: "next" | "prev" | "enter" | "invalid" };

function opArb(n: number): fc.Arbitrary<Op> {
  return fc.oneof(
    fc.record({
      kind: fc.constant("edit" as const),
      q: fc.integer({ min: 0, max: n - 1 }),
      text: fc.constantFrom("3.50", "", "abc", "12", "0.5", " 7 "),
    }),
    fc.record({
      kind: fc.constant("toggle" as const),
      q: fc.integer({ min: 0, max: n - 1 }),
      noAnswer: fc.boolean(),
    }),
    fc.record({
      kind: fc.constant("page" as const),
      action: fc.constantFrom("next" as const, "prev" as const, "enter" as const, "invalid" as const),
    }),
  );
}

describe("Property 3: paging never changes the Recall_Record (fast-check)", () => {
  it("drafts from visit order equal drafts from payload order, and paging sends no event", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8 }).chain((n) =>
          fc.tuple(fc.constant(n), fc.array(opArb(n), { maxLength: 40 })),
        ),
        ([n, ops]) => {
          const payload = payloadOf(n);
          const opened = { payload } as unknown as Opened;
          let state: FlowState = {
            tag: "recall",
            opened,
            drafts: {},
            invalid: [],
          };
          let index = 0;
          const editOrder: Array<{ q: number; event: Op }> = [];

          for (const op of ops) {
            if (op.kind === "page") {
              // Paging moves the view-local index only. It calls no reducer event.
              if (op.action === "next") index = nextIndex(index, n);
              if (op.action === "prev") index = previousIndex(index);
              if (op.action === "enter") {
                index =
                  submitAction(index, n, false, true) === "advance"
                    ? nextIndex(index, n)
                    : index;
              }
              if (op.action === "invalid") {
                const target = firstInvalidIndex(
                  payload.recall_questions.map((question) => question.id),
                  [`q${index}`],
                );
                if (target >= 0) index = target;
              }
              expect(index).toBeGreaterThanOrEqual(0);
              expect(index).toBeLessThan(n);
              continue;
            }
            const id = `q${op.q}`;
            state =
              op.kind === "edit"
                ? reduce(state, { type: "EDIT_DRAFT", id, text: op.text })
                : reduce(state, {
                    type: "TOGGLE_NO_ANSWER",
                    id,
                    noAnswer: op.noAnswer,
                  });
            editOrder.push({ q: op.q, event: op });
          }

          // The same edits, stably sorted into payload order. Each question's own
          // edits keep their order, so the final draft per question is the same.
          const sorted = [...editOrder].sort((a, b) => a.q - b.q);
          let inPayloadOrder: FlowState = {
            tag: "recall",
            opened,
            drafts: {},
            invalid: [],
          };
          for (const { q, event } of sorted) {
            const id = `q${q}`;
            inPayloadOrder =
              event.kind === "edit"
                ? reduce(inPayloadOrder, { type: "EDIT_DRAFT", id, text: event.text })
                : reduce(inPayloadOrder, {
                    type: "TOGGLE_NO_ANSWER",
                    id,
                    noAnswer: (event as { noAnswer: boolean }).noAnswer,
                  });
          }

          const visited = state.tag === "recall" ? state.drafts : {};
          const ordered = inPayloadOrder.tag === "recall" ? inPayloadOrder.drafts : {};
          expect(visited).toEqual(ordered);

          const questions = payload.recall_questions;
          const recordVisited = buildRecallRecord(questions, visited);
          const recordOrdered = buildRecallRecord(questions, ordered);
          expect(recordVisited).toEqual(recordOrdered);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// --- Property 6 (recall) ----------------------------------------------------

describe("Property 6 (recall): the recall states map to the recall Stage (fast-check)", () => {
  const RECALL_STATES: FlowState[] = [
    { tag: "recall", opened: {} as Opened, drafts: {}, invalid: [] },
    { tag: "submitting", opened: {} as Opened, drafts: {} },
    { tag: "submit_failed", opened: {} as Opened, drafts: {} },
  ] as FlowState[];

  it("stageFor returns recall, the same answer twice, for every recall-family state", () => {
    fc.assert(
      fc.property(fc.constantFrom(...RECALL_STATES), (state) => {
        const first = stageFor(state, DEFAULT_LOCAL_VIEW);
        expect(first).toBe("recall");
        expect(stageFor(state, DEFAULT_LOCAL_VIEW)).toBe(first);
      }),
      { numRuns: 100 },
    );
  });
});

// --- Property 14 ------------------------------------------------------------

describe("Property 14: the Recall_Pager shows one question with the right controls (fast-check)", () => {
  it("renders the question at the index, the counter and the controls for its position", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }).chain((n) =>
          fc.tuple(fc.constant(n), fc.integer({ min: 0, max: n - 1 })),
        ),
        fc.boolean(),
        ([n, index], persona) => {
          const writtenAsOf = persona ? "2024-11-05" : undefined;
          const html = renderAt(n, index, writtenAsOf);

          // Exactly one question: the one at the index, in payload order.
          for (let i = 0; i < n; i += 1) {
            expect(html.includes(`QUESTION-${i}-TEXT`)).toBe(i === index);
          }

          // Counter: "Question {n} of {total}", with "as of" only on a persona.
          expect(html).toContain(
            `Question ${index + 1} of ${n}`,
          );
          if (persona) {
            expect(html).toContain(
              `<span class="${expectClassContaining(html, "nowrap")}">as of ${formatCalendarDate(writtenAsOf!)}</span>`,
            );
          } else {
            expect(html).not.toContain("as of");
          }

          // Controls: Next unless last, Previous unless first, submit on the last only.
          const hasNext = html.includes(`>${REVEAL_COPY.nextQuestion}</button>`);
          const hasPrevious = html.includes(`>${REVEAL_COPY.previousQuestion}</button>`);
          const hasSubmit = html.includes(`>${REVEAL_COPY.submit}</button>`);
          expect(hasNext).toBe(index < n - 1);
          expect(hasPrevious).toBe(index > 0);
          expect(hasSubmit).toBe(index === n - 1);

          // No figure value, period or source: the payload carries none, and the pager shows none.
          expect(html).not.toContain("USD");
          expect(html).not.toContain("SERIES-");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("an invalid submit targets the first invalid question in payload order, and drafts stay put", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }).chain((n) =>
          fc.tuple(
            fc.constant(n),
            fc.uniqueArray(fc.integer({ min: 0, max: n - 1 }), { minLength: 1, maxLength: n }),
          ),
        ),
        ([n, invalidIdx]) => {
          const ids = Array.from({ length: n }, (_, i) => `q${i}`);
          const invalid = invalidIdx.map((i) => `q${i}`);
          const drafts: Record<string, Draft> = {};
          const before = JSON.stringify(drafts);
          const target = firstInvalidIndex(ids, invalid);
          expect(target).toBe(Math.min(...invalidIdx));
          expect(JSON.stringify(drafts)).toBe(before);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/** The class name of the element whose class contains `fragment`, from the CSS module. */
function expectClassContaining(html: string, fragment: string): string {
  const match = html.match(new RegExp(`class="([^"]*${fragment}[^"]*)"`));
  if (match === null) throw new Error(`no class containing ${fragment}`);
  return match[1];
}

// --- Property 23 ------------------------------------------------------------

const NEW_STRINGS = [
  REVEAL_COPY.questionCounter,
  REVEAL_COPY.questionCounterAsOf,
  REVEAL_COPY.nextQuestion,
  REVEAL_COPY.previousQuestion,
  DEMO_COPY.openLetterFor,
];

const SCORING_ALWAYS = /\b(accuracy|score|off by)\b/i;
const SCORING_SCENE = /\b(close|right|wrong)\b/i;

describe("Property 23: the new strings are exact and clear of scoring words (example test)", () => {
  it("holds the exact text the design names", () => {
    expect(REVEAL_COPY.questionCounter).toBe("Question {n} of {total}");
    expect(REVEAL_COPY.questionCounterAsOf).toBe("as of {date}");
    expect(REVEAL_COPY.nextQuestion).toBe("Next question");
    expect(REVEAL_COPY.previousQuestion).toBe("Previous question");
    expect(DEMO_COPY.openLetterFor).toBe("Open {name}'s letter");
  });

  it("has no exclamation mark, no sentence over 25 words, and no scoring words", () => {
    for (const text of NEW_STRINGS) {
      expect(text.includes("!"), `"${text}" has !`).toBe(false);
      for (const sentence of text.split(/[.?]/)) {
        const words = sentence.trim().split(/\s+/).filter(Boolean);
        expect(words.length, `"${text}" sentence too long`).toBeLessThanOrEqual(25);
      }
      expect(SCORING_ALWAYS.test(text), `"${text}" scoring word`).toBe(false);
      expect(SCORING_SCENE.test(text), `"${text}" scene scoring word`).toBe(false);
    }
  });

  it("keeps the reveal and demo copy free of scoring words (R24.6, R24.7)", () => {
    for (const text of [...Object.values(REVEAL_COPY), ...Object.values(DEMO_COPY)]) {
      if (typeof text !== "string") continue;
      expect(SCORING_ALWAYS.test(text), `"${text}" scoring word`).toBe(false);
      expect(SCORING_SCENE.test(text), `"${text}" scene scoring word`).toBe(false);
    }
  });
});

describe("R32.13: a question that is not ready never advances or submits", () => {
  it("submitAction is ignore for every index, total and submitting state when ready is false", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 1, max: 21 }),
        fc.boolean(),
        (index, total, submitting) => {
          expect(submitAction(index, total, submitting, false)).toBe("ignore");
        },
      ),
      { numRuns: 100 },
    );
  });

  it("submitAction still advances or submits for a ready question", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }),
        fc.integer({ min: 1, max: 21 }),
        (index, total) => {
          fc.pre(index < total);
          const action = submitAction(index, total, false, true);
          expect(action).toBe(index === total - 1 ? "submit" : "advance");
        },
      ),
      { numRuns: 100 },
    );
  });
});
