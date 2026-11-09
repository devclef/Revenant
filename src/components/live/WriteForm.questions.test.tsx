// Static-markup tests for the Author_Question rows in WriteForm (spec 10, C2.1,
// C2.3, C2.13, C9.5). The project has no DOM test library, so these check the
// first render: which rows appear per mode, when the too-long message shows, and
// which figure hint /seal shows.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEMO_FIGURES } from "@/lib/figures/demo";

import { listPickableSeries } from "./catalogue-list";
import { LIVE_COPY, REAL_COPY } from "./copy";
import { figureLimit } from "./form";
import type { SealState } from "./seal-machine";
import { INITIAL_TOUCHED, type TouchedState } from "./touched";
import { WriteForm, type WriteFormProps } from "./WriteForm";

const SERIES = listPickableSeries(DEMO_FIGURES);

function formProps(over: Partial<WriteFormProps> = {}): WriteFormProps {
  return {
    series: SERIES,
    state: { tag: "write" } as SealState,
    cryptoLoaded: true,
    onCreatePress: () => {},
    onConfirmPress: () => {},
    text: "",
    metricIds: [],
    warningTicked: false,
    backupCardTicked: false,
    onTextChange: () => {},
    onToggleFigure: () => {},
    onWarningChange: () => {},
    onBackupCardChange: () => {},
    ...over,
  };
}

const REAL_DATE = {
  value: null,
  min: "2027-01-01",
  timeZoneFallback: false,
  onChange: () => {},
};

const LONG_QUESTION = "a".repeat(201);

function render(over: Partial<WriteFormProps>): string {
  return renderToStaticMarkup(createElement(WriteForm, formProps(over)));
}

describe("Author_Question rows on the Write step", () => {
  it("shows the demo prefill row on /demo/live", () => {
    const html = render({ questions: [LIVE_COPY.livePrefill] });
    expect(html).toContain(LIVE_COPY.authorQuestionsLegend);
    // Static markup escapes the apostrophe in the prefill text.
    expect(html).toContain(LIVE_COPY.livePrefill.replace(/'/g, "&#x27;"));
  });

  it("shows no question row on /seal, which prefills nothing", () => {
    const html = render({ questions: [], realDate: REAL_DATE });
    expect(html).toContain(LIVE_COPY.authorQuestionsLegend);
    expect(html).not.toContain(
      LIVE_COPY.authorQuestionLabel.replace("{n}", "1"),
    );
  });

  it("shows the too-long message only after the rows were touched", () => {
    const untouched = render({ questions: [LONG_QUESTION] });
    expect(untouched).not.toContain(LIVE_COPY.questionTooLong);
    expect(untouched).toContain(LONG_QUESTION);

    const touched: TouchedState = {
      touched: { questions: true },
      attempted: false,
    };
    const shown = render({ questions: [LONG_QUESTION], touched });
    expect(shown).toContain(LIVE_COPY.questionTooLong);
    expect(shown).toContain(LONG_QUESTION);
  });

  it("shows the too-long message after a seal attempt, even untouched", () => {
    const attempted: TouchedState = { ...INITIAL_TOUCHED, attempted: true };
    const html = render({ questions: [LONG_QUESTION], touched: attempted });
    expect(html).toContain(LIVE_COPY.questionTooLong);
  });
});

describe("the figure hint on /seal (C2.13)", () => {
  it("states that a question allows no figure", () => {
    const limit = figureLimit(SERIES.length);
    const expected =
      limit === 1
        ? REAL_COPY.figuresHintRealOne
        : REAL_COPY.figuresHintReal.replace("{max}", String(limit));
    const html = render({ realDate: REAL_DATE });
    expect(html).toContain(expected);
  });

  it("keeps the demo hint on /demo/live", () => {
    const limit = figureLimit(SERIES.length);
    const expected =
      limit === 1
        ? LIVE_COPY.figuresHintOne
        : LIVE_COPY.figuresHint.replace("{max}", String(limit));
    const html = render({});
    expect(html).toContain(expected);
    expect(html).not.toContain(REAL_COPY.figuresHintReal.slice(0, 20));
  });
});
