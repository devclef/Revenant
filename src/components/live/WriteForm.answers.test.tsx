// The real /seal route with the legacy question rows (spec 15, R7.1, R7.4).
// A blank answer blocks the press with a visible message, and a filled answer
// lets the press through. Static markup only: the project has no DOM test library.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEMO_FIGURES } from "@/lib/figures/demo";

import { listPickableSeries } from "./catalogue-list";
import { buildLivePayload } from "./build-payload";
import { DESK_COPY } from "./desk/copy";
import { DEFAULT_QUESTION } from "./occasions";
import type { SealState } from "./seal-machine";
import { INITIAL_TOUCHED, type TouchedState } from "./touched";
import { WriteForm, type WriteFormProps } from "./WriteForm";
import {
  canPress,
  initialWriteDraft,
  type WriteDraft,
} from "./write-draft";

const SERIES = listPickableSeries(DEMO_FIGURES);
const SEALING_DAY = "2026-11-20";

const REAL_DATE = {
  value: "2027-06-01",
  min: "2027-01-01",
  timeZoneFallback: false,
  onChange: () => {},
};

function realForm(
  answers: string[],
  touched: TouchedState = INITIAL_TOUCHED,
): string {
  const props: WriteFormProps = {
    series: SERIES,
    state: { tag: "write" } as SealState,
    cryptoLoaded: true,
    onCreatePress: () => {},
    onConfirmPress: () => {},
    text: "A letter to my future self.",
    metricIds: [],
    warningTicked: true,
    backupCardTicked: true,
    touched,
    onTextChange: () => {},
    onToggleFigure: () => {},
    onWarningChange: () => {},
    onBackupCardChange: () => {},
    realDate: REAL_DATE,
    sealingDay: SEALING_DAY,
    questions: [DEFAULT_QUESTION],
    answers,
  };
  return renderToStaticMarkup(createElement(WriteForm, props));
}

/** The press button's markup, so its aria-disabled state can be read. */
function pressTag(html: string): string {
  const start = html.lastIndexOf("<button", html.indexOf(">Press the seal"));
  return html.slice(start, html.indexOf(">", start) + 1);
}

describe("/seal legacy question rows: the answer gates the press", () => {
  it("renders an answer field for the default question", () => {
    const html = realForm([""]);
    expect(html).toContain(`Answer to question 1`);
    expect(html).toContain(DESK_COPY.answerPlaceholder);
  });

  it("blocks the press while the answer is blank", () => {
    const html = realForm([""]);
    expect(pressTag(html)).toContain('aria-disabled="true"');
  });

  it("shows the missing-answer message once a seal was attempted", () => {
    const html = realForm([""], { ...INITIAL_TOUCHED, attempted: true });
    expect(html).toContain(DESK_COPY.answerMissing.replace("{n}", "1"));
  });

  it("lets the press through once the answer is filled in", () => {
    const html = realForm(["I was at the coast with my sister."]);
    expect(pressTag(html)).not.toContain("aria-disabled");
  });
});

describe("the press gate and the payload read the answers", () => {
  const draft = (answers: string[]): WriteDraft => ({
    ...initialWriteDraft("real"),
    text: "A letter to my future self.",
    backupChoice: "card",
    backupCardTicked: true,
    warningTicked: true,
    answers,
  });

  it("canPress is false for a blank answer and true for a filled one", () => {
    expect(canPress(draft([""]), SEALING_DAY)).toBe(false);
    expect(canPress(draft(["   "]), SEALING_DAY)).toBe(false);
    expect(canPress(draft(["A filled answer."]), SEALING_DAY)).toBe(true);
  });

  it("buildLivePayload never builds a whitespace-only sealed_answer", () => {
    expect(() =>
      buildLivePayload({
        text: "A letter.",
        metricIds: [],
        authorQuestions: [DEFAULT_QUESTION],
        authorAnswers: ["   "],
        sealedDate: SEALING_DAY,
        figures: { series: new Map() } as never,
      }),
    ).toThrow(/non-blank sealed answer/);
  });
});
