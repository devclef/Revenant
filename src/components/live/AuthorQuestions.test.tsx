import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CATALOGUE } from "@/lib/figures";
import { firstPoliticalTerm } from "@/lib/personas/banned-terms";
import { checkRecallSubject } from "@/lib/recall";

import { AuthorQuestions, type AuthorQuestionsProps } from "./AuthorQuestions";
import { LIVE_COPY } from "./copy";

const noop = () => {};

function render(overrides: Partial<AuthorQuestionsProps> = {}): string {
  return renderToStaticMarkup(
    createElement(AuthorQuestions, {
      questions: [],
      onAdd: noop,
      onChange: noop,
      onRemove: noop,
      ...overrides,
    }),
  );
}

describe("AuthorQuestions copy (spec 10, C2.1, C2.3 to C2.5)", () => {
  it("uses the exact strings", () => {
    expect(LIVE_COPY.authorQuestionsLegend).toBe(
      "Questions for your future self",
    );
    expect(LIVE_COPY.authorQuestionsHint).toBe(
      "When the letter opens, you'll answer these from memory before you read it.",
    );
    expect(LIVE_COPY.authorQuestionLabel).toBe("Question {n}");
    expect(LIVE_COPY.authorQuestionRemove).toBe("Remove question {n}");
    expect(LIVE_COPY.authorQuestionAdd).toBe("Add a question");
    expect(LIVE_COPY.answerInLetter).toBe(
      "Answer them in your letter too, in your own words.",
    );
    expect(LIVE_COPY.questionTooLong).toBe(
      "Keep each question to 200 characters or fewer.",
    );
    expect(LIVE_COPY.livePrefill).toBe(
      "Before you read it, what do you remember about the day you sealed this?",
    );
  });
});

describe("Live_Prefill passes the recall and neutrality checks", () => {
  const text = LIVE_COPY.livePrefill;

  it('has no digit, no "!" and no political term', () => {
    expect(text).not.toMatch(/\d/);
    expect(text).not.toContain("!");
    expect(firstPoliticalTerm(text)).toBeNull();
  });

  it("passes checkRecallSubject for every catalogue metric", () => {
    for (const series of CATALOGUE) {
      expect(
        checkRecallSubject(text, series.metric),
        series.metric.id,
      ).toBeNull();
    }
  });
});

describe("AuthorQuestions rendering", () => {
  it("renders a fieldset with the legend and one hint line after the Add control", () => {
    const html = render();
    expect(html).toContain("<fieldset");
    expect(html).toContain(`<legend`);
    expect(html).toContain(LIVE_COPY.authorQuestionsLegend);
    const hint = html.indexOf(
      LIVE_COPY.authorQuestionsHint.replace(/'/g, "&#x27;"),
    );
    expect(hint).toBeGreaterThan(-1);
    expect(hint).toBeGreaterThan(html.indexOf(LIVE_COPY.authorQuestionAdd));
    // Above Next the step holds one hint line only (L3.5), so the
    // answer-in-letter line is not rendered.
    expect(html).not.toContain(LIVE_COPY.answerInLetter);
  });

  it("offers Add a question while fewer than 3 rows exist, and not at 3", () => {
    expect(render({ questions: [] })).toContain(LIVE_COPY.authorQuestionAdd);
    expect(render({ questions: ["a", "b"] })).toContain(
      LIVE_COPY.authorQuestionAdd,
    );
    expect(render({ questions: ["a", "b", "c"] })).not.toContain(
      LIVE_COPY.authorQuestionAdd,
    );
  });

  it("labels each row Question n and gives it a Remove button", () => {
    const html = render({ questions: ["first", "second"] });
    expect(html).toContain("Question 1");
    expect(html).toContain("Question 2");
    expect(html).toContain("Remove question 1");
    expect(html).toContain("Remove question 2");
    expect(html).not.toContain("Question 3");
  });

  it("renders no starter buttons: the only button is Add (spec 11, L2.7)", () => {
    const html = render();
    expect((html.match(/type="button"/g) ?? []).length).toBe(1);
    expect(html).not.toContain("Start from one:");
  });

  it("marks a row whose text differs from the Live_Prefill with data-user-content", () => {
    const html = render({ questions: [LIVE_COPY.livePrefill, "My own words"] });
    // CSS module class names carry a hash suffix, so match the stem.
    const rows = html.split(/<div class="[^"]*questionRow[^"]*"/).slice(1);
    expect(rows).toHaveLength(2);
    expect(rows[0]).not.toContain("data-user-content");
    expect(rows[1]).toContain("data-user-content");
  });

  it("shows the too-long message only for the flagged row", () => {
    const html = render({ questions: ["short", "long"], tooLongIndices: [1] });
    expect(html.split(LIVE_COPY.questionTooLong)).toHaveLength(2);
  });
});
