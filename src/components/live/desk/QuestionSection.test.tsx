import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LIVE_COPY } from "../copy";

import { DESK_COPY } from "./copy";
import { QuestionSection, type QuestionSectionProps } from "./QuestionSection";

const PILLS_MARK = "PILLS_SLOT";

const render = (props: Partial<QuestionSectionProps> = {}) =>
  renderToStaticMarkup(
    createElement(QuestionSection, {
      questions: [],
      onChange: () => {},
      onRemove: () => {},
      pills: createElement("span", null, PILLS_MARK),
      ...props,
    }),
  );

const countOf = (html: string, needle: string): number =>
  html.split(needle).length - 1;

describe("QuestionSection (spec 14, W6)", () => {
  it("renders a fieldset with the P.S. legend and the intro", () => {
    const html = render();
    expect(html).toMatch(/<fieldset[^>]*data-question-section=""[^>]*>/);
    expect(html).toContain(`>${DESK_COPY.psLegend}</legend>`);
    expect(html).toContain("When it opens, you answer each one from memory");
  });

  it("renders one row per question, in order", () => {
    const html = render({ questions: ["First question?", "Second question?"] });
    expect(countOf(html, "data-question-row")).toBe(2);
    expect(html.indexOf("First question?")).toBeLessThan(
      html.indexOf("Second question?"),
    );
    expect(html).toContain(
      `aria-label="${LIVE_COPY.authorQuestionRemove.replace("{n}", "2")}"`,
    );
  });

  it("still renders the pills area with no rows", () => {
    const html = render({ questions: [] });
    expect(html).toMatch(/<div[^>]*data-pills-area=""[^>]*>/);
    expect(html).toContain(PILLS_MARK);
    expect(html).not.toContain(DESK_COPY.questionsFull);
  });

  it("shows the pills and not the limit line under three rows", () => {
    const html = render({ questions: ["One?", "Two?"] });
    expect(html).toContain(PILLS_MARK);
    expect(html).not.toContain(DESK_COPY.questionsFull);
  });

  it("shows the limit line instead of the pills at three rows", () => {
    const html = render({ questions: ["One?", "Two?", "Three?"] });
    expect(html).toContain(DESK_COPY.questionsFull);
    expect(html).not.toContain(PILLS_MARK);
  });

  it("renders the nothing-to-testify line once, under the rows", () => {
    const html = render({ questions: [], nothingToTestify: true });
    expect(countOf(html, LIVE_COPY.nothingToTestify)).toBe(1);
    expect(html).toMatch(/<p id="live-figures-problem"[^>]*>/);
  });

  it("does not render the nothing-to-testify line by default", () => {
    const html = render({ questions: ["A question?"] });
    expect(html).not.toContain(LIVE_COPY.nothingToTestify);
  });

  it("shows the too-long message only on the flagged row", () => {
    const html = render({
      questions: ["Short?", "Long?"],
      tooLongIndices: [1],
    });
    expect(countOf(html, LIVE_COPY.questionTooLong)).toBe(1);
  });

  it("names only the unanswered question the fold pointed at (spec 15, R7.4)", () => {
    const html = render({
      questions: ["First?", "Second?"],
      answers: ["Yes", ""],
      missingAnswerIndex: 1,
    });
    expect(countOf(html, "has no answer yet")).toBe(1);
    expect(html).toContain(DESK_COPY.answerMissing.replace("{n}", "2"));
    expect(html).toMatch(/data-answer-input=""/);
  });

  it("names nothing when no fold has named an answer", () => {
    const html = render({ questions: ["First?"], answers: [""] });
    expect(html).not.toContain("has no answer yet");
  });
});
