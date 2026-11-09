// Feature: 10-own-questions, task 13 (issue #309): the Author_Testimony.
//
// Property 19: the Author_Testimony shows the words as given. Every question
// and answer is escaped text inside `data-user-content`, line breaks are kept,
// a missing answer reads "No answer", and nothing is injected as HTML.
// Validates C8.2, C8.3, C8.4, C8.5, C8.6, C8.7, C8.8.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import type { RecallRecordV2 } from "@/lib/recall";
import { AuthorTestimony } from "./AuthorTestimony";
import { REVEAL_COPY } from "./copy";
import type { RecallQuestion } from "./opening-machine";

type TextQuestion = Extract<RecallQuestion, { answer_type: "text" }>;

function textQuestion(id: string, text: string): TextQuestion {
  return { id, answer_type: "text", text } as TextQuestion;
}

function render(
  questions: readonly RecallQuestion[],
  record: RecallRecordV2,
): string {
  return renderToStaticMarkup(
    createElement(AuthorTestimony, { questions, record }),
  );
}

describe("AuthorTestimony copy", () => {
  it("uses the exact copy strings from the design", () => {
    expect(REVEAL_COPY.authorTestimonyTitle).toBe(
      "Questions you left for yourself",
    );
    expect(REVEAL_COPY.saidJustNow).toBe("What you said just now");
    expect(REVEAL_COPY.noAnswer).toBe("No answer");
  });
});

describe("AuthorTestimony", () => {
  it("renders nothing when the payload has no text question", () => {
    expect(render([], { version: 2, answers: [] })).toBe("");
  });

  it("renders the heading with tabindex -1 and the testimony marker", () => {
    const html = render([textQuestion("q1", "Where were you?")], {
      version: 2,
      answers: [],
    });
    expect(html).toContain('data-author-testimony=""');
    expect(html).toMatch(
      /<h2[^>]*tabindex="-1"[^>]*data-author-testimony-heading=""[^>]*>Questions you left for yourself<\/h2>/,
    );
  });

  it("lists each question in payload order with its answer in full", () => {
    const html = render(
      [textQuestion("q1", "First question"), textQuestion("q2", "Second question")],
      {
        version: 2,
        answers: [
          { question_id: "q2", kind: "text", value: "Second answer" },
          { question_id: "q1", kind: "text", value: "First answer" },
        ],
      },
    );
    const first = html.indexOf("First question");
    const second = html.indexOf("Second question");
    expect(first).toBeGreaterThanOrEqual(0);
    expect(second).toBeGreaterThan(first);
    expect(html.indexOf("First answer")).toBeGreaterThan(first);
    expect(html.indexOf("Second answer")).toBeGreaterThan(second);
    expect(html.split("What you said just now").length - 1).toBe(2);
  });

  it("shows No answer for a question with no text answer", () => {
    const html = render([textQuestion("q1", "Unanswered")], {
      version: 2,
      answers: [{ question_id: "q1", kind: "no_answer" }],
    });
    expect(html).toContain(REVEAL_COPY.noAnswer);
  });

  it("keeps line breaks in the answer (white-space: pre-wrap in the module)", () => {
    const html = render([textQuestion("q1", "Q")], {
      version: 2,
      answers: [{ question_id: "q1", kind: "text", value: "line one\nline two" }],
    });
    expect(html).toContain("line one\nline two");
  });

  it("marks the question and answer as the judge's own content", () => {
    const html = render([textQuestion("q1", "Q")], {
      version: 2,
      answers: [{ question_id: "q1", kind: "text", value: "A" }],
    });
    const marked = html.match(/data-user-content=""/g) ?? [];
    expect(marked.length).toBe(2);
  });

  it("never injects HTML from the question or the answer", () => {
    const html = render([textQuestion("q1", "<img src=x onerror=alert(1)>")], {
      version: 2,
      answers: [
        { question_id: "q1", kind: "text", value: "<script>alert(1)</script>" },
      ],
    });
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;img");
    expect(html).toContain("&lt;script&gt;");
  });
});

describe("Property 19: the Author_Testimony shows the words as given", () => {
  const word = fc.string({ minLength: 1, maxLength: 60 });

  it("keeps every question and answer exactly, escaped, for any text", () => {
    fc.assert(
      fc.property(
        fc.array(fc.tuple(word, fc.option(word, { nil: null })), {
          minLength: 1,
          maxLength: 3,
        }),
        (pairs) => {
          const questions = pairs.map(([q], i) => textQuestion(`q${i}`, q));
          const answers = pairs.map(([, a], i) =>
            a === null
              ? { question_id: `q${i}`, kind: "no_answer" as const }
              : { question_id: `q${i}`, kind: "text" as const, value: a },
          );
          const html = render(questions, { version: 2, answers });
          for (const [q, a] of pairs) {
            const esc = (s: string) =>
              s
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#x27;");
            expect(html).toContain(esc(q));
            if (a === null) {
              expect(html).toContain(REVEAL_COPY.noAnswer);
            } else {
              expect(html).toContain(esc(a));
            }
          }
          expect(html).not.toContain("<script");
        },
      ),
    );
  });
});
