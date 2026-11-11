// Feature: 11-any-letter, task 19 (P1): the Text_Persona reading view.
//
// The `recall` Stage of the Text_Persona shows one question at a time, each
// with her answer and the Fictional_Label. It has no field, no "No answer", no
// sample, no "Record my answers" and no Memory_Line. The last question's
// control is "Break the seal". Validates P1.5, P1.6, P1.7.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RecallReader } from "./RecallReader";
import { REVEAL_COPY } from "@/components/reveal/copy";
import { CEREMONY_COPY } from "../copy";
import { formatCalendarDate } from "@/components/ui/letter-date";

const TESTIMONY = [
  { question: "What were you looking forward to most?", answer: "The coast trip." },
  { question: "What were you worried about?", answer: "The extra shift." },
];

function render(index: number, extra: Record<string, unknown> = {}): string {
  return renderToStaticMarkup(
    createElement(RecallReader, {
      testimony: TESTIMONY,
      index,
      onNext: () => {},
      onReadDone: () => {},
      writtenAsOf: "2024-05-12",
      ...extra,
    }),
  );
}

describe("RecallReader (Text_Persona reading view)", () => {
  it("shows one question and her answer, labelled as fictional", () => {
    const html = render(0);
    expect(html).toContain(TESTIMONY[0].question);
    expect(html).toContain(TESTIMONY[0].answer);
    expect(html).toContain(REVEAL_COPY.personaAnswerLabel);
    expect(html).not.toContain(TESTIMONY[1].question);
    expect(html).not.toContain(TESTIMONY[1].answer);
  });

  it("uses the exact Fictional_Label copy", () => {
    expect(REVEAL_COPY.personaAnswerLabel).toBe("Her answer (fictional)");
  });

  it("offers Next question on every question but the last", () => {
    const html = render(0);
    expect(html).toContain(REVEAL_COPY.nextQuestion);
    expect(html).not.toContain(CEREMONY_COPY.sealButton);
  });

  it("offers Break the seal on the last question", () => {
    const html = render(1);
    expect(html).toContain(CEREMONY_COPY.sealButton);
    expect(html).not.toContain(REVEAL_COPY.nextQuestion);
  });

  it("has no field, no No answer, no Record my answers and no Sample_Answer", () => {
    for (const index of [0, 1]) {
      const html = render(index);
      expect(html).not.toMatch(/<input/);
      expect(html).not.toMatch(/<textarea/);
      expect(html).not.toMatch(/<select/);
      expect(html).not.toContain(REVEAL_COPY.noAnswer);
      expect(html).not.toContain(REVEAL_COPY.submit);
      expect(html).not.toContain("data-sample");
    }
  });

  it("names the question and the written-as-of date in the counter", () => {
    const html = render(0);
    expect(html).toContain(
      REVEAL_COPY.questionCounter.replace("{n}", "1").replace("{total}", "2"),
    );
    expect(html).toContain(
      REVEAL_COPY.questionCounterAsOf.replace(
        "{date}",
        formatCalendarDate("2024-05-12"),
      ),
    );
  });

  it("renders nothing for an index outside the testimony", () => {
    expect(render(5)).toBe("");
  });
});
