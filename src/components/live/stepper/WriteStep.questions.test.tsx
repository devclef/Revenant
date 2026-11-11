// Static-markup tests for the Write step of the Live_Stepper with its
// Author_Question rows and Question_Starters (spec 10, C2 and C9.5). The
// project has no DOM test library, so each test drives the stepper reducer,
// renders the Write step with WriteForm, and checks the first render.

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEMO_FIGURES } from "@/lib/figures/demo";

import { listPickableSeries } from "../catalogue-list";
import { questionsForSeal } from "../author-questions";
import { LIVE_COPY } from "../copy";
import type { SealState } from "../seal-machine";
import { WriteForm, type WriteFormProps } from "../WriteForm";
import { LiveStepper, type StepView } from "./LiveStepper";
import {
  initialStepperState,
  reduceStepper,
  type StepperAction,
  type StepperState,
} from "./live-steps";

const SERIES = listPickableSeries(DEMO_FIGURES);
const STARTER = "Who were you thinking about most when you wrote this?";

/** Folds actions into the stepper state, as SealPage does. */
function run(state: StepperState, ...actions: StepperAction[]): StepperState {
  return actions.reduce(reduceStepper, state);
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

/** The value of every Author_Question input, in row order. */
function rowValues(html: string): string[] {
  const values: string[] = [];
  for (const match of html.matchAll(/<input[^>]*id="[^"]*-q\d+"[^>]*>/g)) {
    const value = match[0].match(/value="([^"]*)"/);
    values.push(value?.[1] ?? "");
  }
  return values;
}

describe("Write step: Author_Question rows on the Live_Stepper", () => {
  it("keeps the Live_Prefill row as the first row by default", () => {
    const state = initialStepperState("write", "demo");
    expect(state.draft.questions).toEqual([LIVE_COPY.livePrefill]);

    const html = renderWriteStep(state);
    // Static markup escapes the apostrophe in the prefill text.
    expect(rowValues(html)).toEqual([
      LIVE_COPY.livePrefill.replace(/'/g, "&#x27;"),
    ]);
    expect(html).toContain(LIVE_COPY.authorQuestionLabel.replace("{n}", "1"));
    expect(html).not.toContain(
      LIVE_COPY.authorQuestionLabel.replace("{n}", "2"),
    );
  });

  it("adds a row typed after the Live_Prefill row", () => {
    const state = run(
      initialStepperState("write", "demo"),
      { type: "DRAFT", event: { type: "QUESTION_ADDED" } },
      {
        type: "DRAFT",
        event: { type: "QUESTION_CHANGED", index: 1, text: STARTER },
      },
    );
    expect(state.draft.questions).toEqual([LIVE_COPY.livePrefill, STARTER]);

    const html = renderWriteStep(state);
    expect(rowValues(html)).toEqual([
      LIVE_COPY.livePrefill.replace(/'/g, "&#x27;"),
      STARTER.replace(/'/g, "&#x27;"),
    ]);
    expect(html).toContain(LIVE_COPY.authorQuestionLabel.replace("{n}", "2"));
  });

  it("removes a row, so it no longer renders or seals", () => {
    const state = run(initialStepperState("write", "demo"), {
      type: "DRAFT",
      event: { type: "QUESTION_REMOVED", index: 0 },
    });
    expect(state.draft.questions).toEqual([]);

    const html = renderWriteStep(state);
    expect(rowValues(html)).toEqual([]);
    expect(html).not.toContain(
      LIVE_COPY.authorQuestionLabel.replace("{n}", "1"),
    );
  });

  it("clears a row to empty text, which keeps the row but seals nothing", () => {
    const state = run(initialStepperState("write", "demo"), {
      type: "DRAFT",
      event: { type: "QUESTION_CHANGED", index: 0, text: "   " },
    });
    expect(state.draft.questions).toEqual(["   "]);

    const html = renderWriteStep(state);
    expect(rowValues(html)).toEqual(["   "]);
  });

  it("leaves a removed or cleared row out of the sealed question list", () => {
    // Three rows: row 1 cleared to empty, row 2 kept with surrounding spaces,
    // row 3 typed then removed. The sealed list keeps only the trimmed text.
    let state = run(
      initialStepperState("write", "real"),
      { type: "DRAFT", event: { type: "QUESTION_ADDED" } },
      {
        type: "DRAFT",
        event: { type: "QUESTION_CHANGED", index: 0, text: "" },
      },
      { type: "DRAFT", event: { type: "QUESTION_ADDED" } },
      {
        type: "DRAFT",
        event: { type: "QUESTION_CHANGED", index: 1, text: "  Kept  " },
      },
      { type: "DRAFT", event: { type: "QUESTION_ADDED" } },
      {
        type: "DRAFT",
        event: { type: "QUESTION_CHANGED", index: 2, text: "Removed" },
      },
    );
    expect(state.draft.questions).toEqual(["", "  Kept  ", "Removed"]);

    state = run(state, {
      type: "DRAFT",
      event: { type: "QUESTION_REMOVED", index: 2 },
    });
    expect(state.draft.questions).toEqual(["", "  Kept  "]);

    expect(questionsForSeal(state.draft.questions)).toEqual(["Kept"]);
  });

  it("seals the demo prefill as the only question when nothing else is typed", () => {
    const state = initialStepperState("write", "demo");
    expect(questionsForSeal(state.draft.questions)).toEqual([
      LIVE_COPY.livePrefill,
    ]);
  });
});
