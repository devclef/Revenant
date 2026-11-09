// Feature: spec 10 (own questions), task 1: the TextAnswerField (C4.5, C4.6).
//
// The Recall_Pager is rendered to static markup in these tests (no DOM in the
// node test environment), so the tests read the first paint: the textarea's
// attributes, the count line, the invalid message and the "No answer" control.
// The question text comes from the task 6 fixtures.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PAYLOAD_TEXT_1 } from "@/lib/recall/fixtures.test-data";
import {
  TextAnswerField,
  TEXT_ANSWER_ROWS,
  type TextAnswerFieldProps,
} from "./TextAnswerField";

const HEADING_ID = "recall-a1-heading";
const FIELD_ID = "recall-a1-text";
const NO_ANSWER_ID = "recall-a1-no-answer";
const QUESTION = PAYLOAD_TEXT_1.recall_questions[0].text;
const INVALID_TEXT =
  "Write an answer of up to 1,000 characters, or choose No answer.";

function countLabel(n: number): string {
  return `${n} of 1,000 characters`;
}

/** The question heading and the field, as the pager renders them. */
function render(overrides: Partial<TextAnswerFieldProps> = {}): string {
  const props: TextAnswerFieldProps = {
    id: FIELD_ID,
    headingId: HEADING_ID,
    noAnswerId: NO_ANSWER_ID,
    value: "",
    noAnswer: false,
    invalid: false,
    countLabel,
    invalidText: INVALID_TEXT,
    onChange: () => undefined,
    onToggleNoAnswer: () => undefined,
    ...overrides,
  };
  return renderToStaticMarkup(
    <>
      <h2 id={HEADING_ID}>{QUESTION}</h2>
      <TextAnswerField {...props} />
    </>,
  );
}

/** The opening tag of the textarea. */
function textareaTag(markup: string): string {
  return /<textarea[^>]*>/.exec(markup)?.[0] ?? "";
}

describe("the textarea (C4.5)", () => {
  it("has four rows", () => {
    expect(TEXT_ANSWER_ROWS).toBe(4);
    expect(textareaTag(render())).toContain(`rows="${TEXT_ANSWER_ROWS}"`);
  });

  it("is named by its question heading", () => {
    const markup = render();
    expect(markup).toContain(`<h2 id="${HEADING_ID}">${QUESTION}</h2>`);
    expect(textareaTag(markup)).toContain(`aria-labelledby="${HEADING_ID}"`);
  });

  it("carries data-stage-focus and no data-user-content", () => {
    const tag = textareaTag(render());
    expect(tag).toContain("data-stage-focus");
    expect(tag).not.toContain("data-user-content");
  });

  it("points aria-describedby at the count line", () => {
    const tag = textareaTag(render());
    expect(tag).toContain(`aria-describedby="${FIELD_ID}-count"`);
    expect(render()).toContain(
      `<p id="${FIELD_ID}-count">0 of 1,000 characters</p>`,
    );
  });
});

describe("the code-point count (C4.5)", () => {
  it("counts an astral character once", () => {
    const markup = render({ value: "a\u{1F600}b" });
    expect(markup).toContain(
      `<p id="${FIELD_ID}-count">3 of 1,000 characters</p>`,
    );
  });

  it("counts the trimmed text, as the stored answer does", () => {
    const markup = render({ value: "  \u{1F600}  " });
    expect(markup).toContain(
      `<p id="${FIELD_ID}-count">1 of 1,000 characters</p>`,
    );
  });
});

describe("Enter inserts a line break (C4.5)", () => {
  it("has no Enter handler in the component source, so the browser's newline stands", () => {
    const source = readFileSync(
      new URL("./TextAnswerField.tsx", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(/onKeyDown|onKeyPress|onKeyUp|preventDefault/);
    expect(source).not.toMatch(/["']Enter["']/);
  });

  it("renders a textarea, not a single-line input", () => {
    const markup = render();
    expect(textareaTag(markup)).not.toBe("");
    expect(markup).not.toMatch(/<input[^>]*type="text"/);
  });
});

describe("an invalid text keeps its text (C4.6)", () => {
  it("shows the invalid message and keeps a blank answer as typed", () => {
    const markup = render({ value: "   ", invalid: true });
    const tag = textareaTag(markup);
    expect(tag).toContain('aria-invalid="true"');
    expect(tag).toContain(
      `aria-describedby="${FIELD_ID}-count ${FIELD_ID}-invalid"`,
    );
    expect(markup).toContain(`<p id="${FIELD_ID}-invalid">${INVALID_TEXT}</p>`);
  });

  it("keeps an answer of 1,001 code points as typed", () => {
    const text = "a".repeat(1001);
    const markup = render({ value: text, invalid: true });
    expect(markup).toContain(`>${text}</textarea>`);
    expect(markup).toContain(
      `<p id="${FIELD_ID}-count">1001 of 1,000 characters</p>`,
    );
    expect(markup).toContain(INVALID_TEXT);
  });

  it("shows no invalid message or aria-invalid while the text is not invalid", () => {
    const markup = render({ value: "A valid answer.", invalid: false });
    expect(textareaTag(markup)).not.toContain("aria-invalid");
    expect(markup).not.toContain(INVALID_TEXT);
  });
});

describe("No answer sits under the field (C4.6, C7.2)", () => {
  it("renders a checkbox labelled No answer after the count", () => {
    const markup = render();
    expect(markup).toContain(`id="${NO_ANSWER_ID}"`);
    expect(markup.indexOf("0 of 1,000 characters")).toBeLessThan(
      markup.indexOf(`id="${NO_ANSWER_ID}"`),
    );
    expect(markup).toContain("No answer");
  });

  it("disables the textarea and ticks the box when No answer is set", () => {
    const markup = render({ value: "kept", noAnswer: true });
    expect(textareaTag(markup)).toContain("disabled");
    expect(markup).toMatch(new RegExp(`id="${NO_ANSWER_ID}"[^>]*checked`));
  });
});
