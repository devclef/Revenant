import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LIVE_COPY } from "../copy";

import { DESK_COPY } from "./copy";
import { QuestionRow, type QuestionRowProps } from "./QuestionRow";

const render = (props: Partial<QuestionRowProps> = {}) =>
  renderToStaticMarkup(
    createElement(QuestionRow, {
      index: 1,
      text: "When you wrote this, what did you expect?",
      onChange: () => {},
      onRemove: () => {},
      ...props,
    }),
  );

describe("QuestionRow (spec 14, W7)", () => {
  it("renders one list item with the wax disc numbered from 1", () => {
    const html = render({ index: 0 });
    expect(html).toMatch(/<li[^>]*data-question-row=""/);
    expect(html).toMatch(
      /<span[^>]*aria-hidden="true"[^>]*data-wax-disc=""[^>]*>1<\/span>/,
    );
  });

  it("labels the input 'Question {n}' with its visible number", () => {
    const html = render({ index: 1 });
    expect(html).toContain(
      `>${LIVE_COPY.authorQuestionLabel.replace("{n}", "2")}</label>`,
    );
  });

  it("uses the question placeholder and the question text", () => {
    const html = render();
    expect(html).toContain(`placeholder="${DESK_COPY.questionPlaceholder}"`);
    expect(html).toContain(
      "When you wrote this, what did you expect?</textarea>",
    );
  });

  it("references the Lock_Line from aria-describedby", () => {
    const html = render();
    const lockId = html.match(/<p id="([^"]+)"[^>]*>(?=<svg)/)?.[1];
    expect(lockId, "the Lock_Line has an id").toBeTruthy();
    expect(html).toContain(`aria-describedby="${lockId}"`);
    expect(html).toContain(DESK_COPY.lockLine);
  });

  it("adds the problem id to aria-describedby and marks the input invalid when there is a problem", () => {
    const html = render({ problem: LIVE_COPY.questionTooLong });
    const lockId = html.match(/<p id="([^"]+)"[^>]*>(?=<svg)/)?.[1];
    const problemId = html.match(
      /<p id="([^"]+)"[^>]*>Keep each question/,
    )?.[1];
    expect(problemId, "the problem has an id").toBeTruthy();
    expect(html).toContain(`aria-describedby="${lockId} ${problemId}"`);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain(LIVE_COPY.questionTooLong);
  });

  it("shows no problem line and no aria-invalid when the row is fine", () => {
    const html = render();
    expect(html).not.toContain("aria-invalid");
    expect(html).not.toContain(LIVE_COPY.questionTooLong);
  });

  it("renders the Edit control aria-hidden with no tabIndex", () => {
    const html = render();
    expect(html).toMatch(
      /<span[^>]*class="[^"]*edit[^"]*"[^>]*aria-hidden="true"[^>]*>/,
    );
    expect(html).toContain(DESK_COPY.edit);
    expect(html).not.toMatch(/tabindex/i);
  });

  it("names the Remove control 'Remove question {n}' with the visible text Remove", () => {
    const html = render({ index: 2 });
    expect(html).toContain(
      `aria-label="${LIVE_COPY.authorQuestionRemove.replace("{n}", "3")}"`,
    );
    expect(html).toContain(`>${LIVE_COPY.authorQuestionRemoveText}</button>`);
  });

  it("gives the Lock_Line no focus stop: it is not a button, link or input", () => {
    const html = render();
    const lock =
      html.match(/<p id="[^"]+"[^>]*>(<svg[\s\S]*?)<\/p>/)?.[0] ?? "";
    expect(lock).not.toMatch(/<(button|a|input|textarea)\b/);
    expect(lock).not.toMatch(/tabindex/i);
  });

  it("renders an answer field under the question with its label and placeholder (spec 15, R7.1)", () => {
    const html = render({ answer: "I was still unsure." });
    expect(html).toContain(`>${DESK_COPY.answerLabel}</label>`);
    expect(html).toContain(`placeholder="${DESK_COPY.answerPlaceholder}"`);
    expect(html).toContain(
      `aria-label="${DESK_COPY.answerLabelFor.replace("{n}", "2")}"`,
    );
    expect(html).toContain("I was still unsure.</textarea>");
  });

  it("gives the answer field the paper's own ink colour, not an inherited one (spec 15, R7.1)", () => {
    const html = render();
    expect(html).toMatch(/<textarea[^>]*class="[^"]*answerInput[^"]*"/);
  });

  it("shows the answer's problem and marks the answer invalid when it is over 1,000 characters", () => {
    const html = render({ answerProblem: LIVE_COPY.answerTooLong });
    const answerProblemId = html.match(
      /<p id="([^"]+)"[^>]*>Keep each answer/,
    )?.[1];
    expect(answerProblemId, "the answer problem has an id").toBeTruthy();
    expect(html).toContain(`aria-describedby="${answerProblemId}"`);
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain(LIVE_COPY.answerTooLong);
  });

  it("shows no answer problem when the answer is fine", () => {
    const html = render({ answer: "short" });
    expect(html).not.toContain(LIVE_COPY.answerTooLong);
  });
});
