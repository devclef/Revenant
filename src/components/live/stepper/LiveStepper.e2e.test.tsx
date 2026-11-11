// End-to-end render test of the Live_Stepper from Write to Receipts (spec 10,
// C2, C9.2 and C9.3). The project has no DOM test library, so the test drives
// the stepper reducer through each step, feeds the sealed question list into
// the Testify pager and the Reveal, and reads the order of the static markup.

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Reveal, type RevealProps } from "@/components/reveal/Reveal";
import type { Opened } from "@/components/reveal/opening-machine";
import { RecallPager, type RecallPagerProps } from "@/components/ceremony/recall/RecallPager";
import { MotionProvider } from "@/components/ceremony/motion";
import { SkipProvider } from "@/components/ceremony/skip";
import { LiveRegionProvider } from "@/components/ceremony/LiveRegion";
import { LocalViewProvider } from "@/components/ceremony/local-view";
import type { RecallRecordV2 } from "@/lib/recall";
import type { PayloadV1 } from "@/lib/seal-format";
import { CATALOGUE } from "@/lib/figures/catalogue";
import { DEMO_FIGURES } from "@/lib/figures/demo";
import { thenAndNow } from "@/lib/figures/then-now";
import { listPickableSeries } from "../catalogue-list";
import { questionsForSeal } from "../author-questions";
import { DEFAULT_QUESTION } from "../occasions";
import type { SealState } from "../seal-machine";
import { WriteForm, type WriteFormProps } from "../WriteForm";
import { LiveStepper, type StepView } from "./LiveStepper";
import {
  initialStepperState,
  reduceStepper,
  type StepperAction,
  type StepperState,
} from "./live-steps";

const { useFiguresSpy } = vi.hoisted(() => ({ useFiguresSpy: vi.fn() }));

vi.mock("@/components/reveal/figures-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/reveal/figures-api")>();
  return {
    ...actual,
    useFigures: () => {
      useFiguresSpy();
      return { status: "loading" as const };
    },
  };
});

const SERIES = listPickableSeries(DEMO_FIGURES);
const STARTER = "Who were you thinking about most when you wrote this?";
const TYPED = "Where was the bakery?";
const LETTER = "A letter from the past that says the same thing as before.";
const FIGURE_QUESTION = "What did a gallon of gas cost then?";

/** Static markup escapes the apostrophe, so text is matched in escaped form. */
function escaped(text: string): string {
  return text.replace(/'/g, "&#x27;");
}

/** Folds actions into the stepper state, as SealPage does. */
function run(state: StepperState, ...actions: StepperAction[]): StepperState {
  return actions.reduce(reduceStepper, state);
}

function indexOfOrFail(markup: string, needle: string): number {
  const at = markup.indexOf(needle);
  expect(at, `${needle} is in the markup`).toBeGreaterThanOrEqual(0);
  return at;
}

/** The value of every Author_Question input, in row order. */
function rowValues(html: string): string[] {
  const values: string[] = [];
  for (const match of html.matchAll(/<input[^>]*id="[^"]*-q\d+"[^>]*>/g)) {
    const value = match[0].match(/value="([^"]*)"/);
    values.push(value?.[1] ?? "");
  }
  return values;
}

/** Renders the Write step: the stepper card with the WriteForm rows inside. */
function renderWriteStep(state: StepperState): string {
  return renderToStaticMarkup(
    createElement(LiveStepper, {
      state,
      dispatch: () => undefined,
      renderStep: (view: StepView): ReactNode =>
        createElement(WriteForm, {
          series: SERIES,
          state: { tag: "write" } as SealState,
          cryptoLoaded: true,
          text: view.draft.text,
          metricIds: view.draft.metricIds,
          warningTicked: view.draft.warningTicked,
          backupCardTicked: view.draft.backupCardTicked,
          questions: view.draft.questions,
          section: "write",
          onTextChange: () => undefined,
          onToggleFigure: () => undefined,
          onWarningChange: () => undefined,
          onBackupCardChange: () => undefined,
          onCreatePress: () => undefined,
          onConfirmPress: () => undefined,
        } satisfies WriteFormProps),
    }),
  );
}

// The Write step: Live_Prefill kept, one starter added, one row removed.
const WRITTEN = run(
  initialStepperState("write", "demo"),
  { type: "DRAFT", event: { type: "QUESTION_ADDED" } },
  { type: "DRAFT", event: { type: "QUESTION_CHANGED", index: 1, text: STARTER } },
  { type: "DRAFT", event: { type: "QUESTION_ADDED" } },
  { type: "DRAFT", event: { type: "QUESTION_CHANGED", index: 2, text: TYPED } },
  { type: "DRAFT", event: { type: "QUESTION_REMOVED", index: 1 } },
);

// The sealed Author_Questions, read from the draft before the seal is stored.
const SEALED_QUESTIONS = questionsForSeal(WRITTEN.draft.questions);

/** The stepper after the seal is stored and the reader moves through Wait. */
const AT_TESTIFY = run(
  WRITTEN,
  { type: "SEALED" },
  { type: "GOTO", step: "wait" },
  { type: "GOTO", step: "testify" },
);
const AT_RECEIPTS = run(AT_TESTIFY, { type: "GOTO", step: "receipts" });

const METRIC_ID = "us-gasoline-regular";
const AS_OF = "2024-10-15";
const series = CATALOGUE.find((entry) => entry.metric.id === METRIC_ID);
const then = thenAndNow(METRIC_ID, AS_OF, DEMO_FIGURES).then;
if (series === undefined || !then.found) {
  throw new Error(`test setup: no sealed figure for ${METRIC_ID} on ${AS_OF}`);
}

/** The sealed recall questions: the Author_Questions first, then the figure question. */
const RECALL_QUESTIONS = [
  ...SEALED_QUESTIONS.map((text, i) => ({
    id: `a${i + 1}`,
    answer_type: "text" as const,
    text,
  })),
  {
    id: "q1",
    answer_type: "number" as const,
    metric_id: METRIC_ID,
    text: FIGURE_QUESTION,
  },
];

const PAYLOAD_METRICS = [
  { id: "m1", unit: "USD per gallon" } as unknown as PayloadV1["metrics"][number],
];

function renderTestify(initialIndex: number): string {
  const props: RecallPagerProps = {
    payload: {
      metrics: PAYLOAD_METRICS,
      recall_questions: RECALL_QUESTIONS as unknown as PayloadV1["recall_questions"],
    },
    drafts: {},
    invalid: [],
    submitting: false,
    onEdit: () => undefined,
    onToggleNoAnswer: () => undefined,
    onSubmit: () => undefined,
    initialIndex,
  };
  return renderToStaticMarkup(createElement(RecallPager, props));
}

const OPENED: Opened = {
  letterId: "letter-live-stepper-e2e",
  header: {
    sealedAt: "2026-11-01T00:00:00.000Z",
    opensAt: "2026-11-09T00:00:00.000Z",
  },
  openingKey: {} as unknown as CryptoKey,
  envelopeHash:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  payload: {
    format_version: 1,
    letter_text: LETTER,
    metrics: [series.metric],
    figures: [then.figure],
    recall_questions: RECALL_QUESTIONS,
  } as unknown as PayloadV1,
};

const RECORD: RecallRecordV2 = {
  version: 2,
  answers: [
    { question_id: "a1", kind: "text", value: "Coffee with Ana." },
    { question_id: "a2", kind: "text", value: "By the bakery on Elm Street." },
    { question_id: "q1", kind: "no_answer" },
  ],
};

function renderReceipts(stage: 2 | 3): string {
  const props: RevealProps = {
    opened: OPENED,
    record: RECORD,
    personaName: "Live letter",
    letterId: OPENED.letterId,
    letterKind: "live",
    variant: "live",
    stage,
    onAdvance: () => {},
    onShowAll: () => {},
    phone: false,
  };
  return renderToStaticMarkup(
    createElement(
      MotionProvider,
      null,
      createElement(
        SkipProvider,
        null,
        createElement(
          LiveRegionProvider,
          null,
          createElement(LocalViewProvider, null, createElement(Reveal, props)),
        ),
      ),
    ),
  );
}

describe("Live_Stepper end to end: Write to Receipts (spec 10 C2, C9.2, C9.3)", () => {
  beforeEach(() => {
    useFiguresSpy.mockClear();
  });

  it("the Write step keeps the Live_Prefill first, shows the starter row, and drops the removed row", () => {
    expect(WRITTEN.step).toBe("write");
    expect(WRITTEN.draft.questions).toEqual([DEFAULT_QUESTION, TYPED]);

    const html = renderWriteStep(WRITTEN);
    expect(rowValues(html)).toEqual([escaped(DEFAULT_QUESTION), TYPED]);
    // The starter buttons always render. Only the row inputs hold sealed text.
    expect(rowValues(html)).not.toContain(escaped(STARTER));
    expect(indexOfOrFail(html, escaped(DEFAULT_QUESTION))).toBeLessThan(
      indexOfOrFail(html, TYPED),
    );
  });

  it("seals only the kept rows, in row order, and clears the draft once sealed", () => {
    expect(SEALED_QUESTIONS).toEqual([DEFAULT_QUESTION, TYPED]);
    expect(AT_TESTIFY.sealed).toBe(true);
    expect(AT_TESTIFY.draft.questions).toEqual([]);
  });

  it("Testify asks the Live_Prefill first, then the typed Author_Question, then the figure", () => {
    expect(AT_TESTIFY.step).toBe("testify");

    const first = renderTestify(0);
    expect(first).toContain(escaped(DEFAULT_QUESTION));
    expect(first).not.toContain(TYPED);
    expect(first).not.toContain(FIGURE_QUESTION);

    const second = renderTestify(1);
    expect(second).toContain(TYPED);
    expect(second).not.toContain(escaped(DEFAULT_QUESTION));

    const third = renderTestify(2);
    expect(third).toContain(FIGURE_QUESTION);
  });

  it("Receipts lead with the Answer_List, then the Author_Testimony, then the letter", () => {
    expect(AT_RECEIPTS.step).toBe("receipts");

    const markup = renderReceipts(2);
    const list = indexOfOrFail(markup, "data-answer-list");
    const prefill = indexOfOrFail(markup, escaped(DEFAULT_QUESTION));
    const typed = indexOfOrFail(markup, TYPED);
    const testimony = indexOfOrFail(markup, "data-author-testimony");
    const letter = indexOfOrFail(markup, "data-letter-text");
    expect(list).toBeLessThan(prefill);
    expect(prefill).toBeLessThan(typed);
    expect(typed).toBeLessThan(testimony);
    expect(testimony).toBeLessThan(letter);
  });

  it("Receipts show the figures after the letter at stage 3", () => {
    const markup = renderReceipts(3);
    const testimony = indexOfOrFail(markup, "data-author-testimony");
    const letter = indexOfOrFail(markup, "data-letter-text");
    const figures = indexOfOrFail(markup, "data-figures-panel");
    expect(testimony).toBeLessThan(letter);
    expect(letter).toBeLessThan(figures);
  });
});
