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
import { RecallStep } from "@/components/reveal/RecallStep";
import type { Opened } from "@/components/reveal/opening-machine";
import type { TestifyContextProps } from "../intro/TestifyContext";

const PERSONA_TESTIFY: TestifyContextProps = {
  kind: "persona",
  personaName: "Priya",
  writtenAsOf: "2024-05-12",
  opensAt: "2024-11-05T00:00:00.000Z",
};

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

describe("RecallReader Memory_Line (spec 11 P1.6)", () => {
  it("renders the persona Testify_Context without a Memory_Line in the reading walk", () => {
    const html = render(0, { testify: PERSONA_TESTIFY });
    expect(html).toContain("data-testify-context");
    expect(html).toContain(CEREMONY_COPY.personaNotice.replace("{name}", "Priya"));
    expect(html).not.toContain("data-memory-line");
    expect(html).not.toContain("Answer from your own memory");
  });

  it("keeps the reading walk free of an answer field, a sample and a record control", () => {
    const html = render(0, { testify: PERSONA_TESTIFY });
    expect(html).not.toMatch(/<input/);
    expect(html).not.toMatch(/<textarea/);
    expect(html).not.toContain("data-sample");
    expect(html).not.toContain(REVEAL_COPY.submit);
    expect(html).not.toContain(REVEAL_COPY.noAnswer);
    expect(html).toContain(REVEAL_COPY.personaAnswerLabel);
    expect(html).toContain(TESTIMONY[0].answer);
  });

  it("keeps the Memory_Line in the recall walk: RecallStep still renders it for a persona", () => {
    // The real recall step (RecallStep renders <TestifyContext {...testify} />
    // with no memoryLine flag). The fuel persona recall walk must still show it.
    const opened = {
      letterId: "letter-1",
      header: { sealedAt: "2024-10-01T00:00:00.000Z", opensAt: "2024-11-05T00:00:00.000Z" },
      openingKey: {} as unknown as CryptoKey,
      envelopeHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
      payload: {
        format_version: 1,
        letter_text: "A short letter.",
        metrics: [],
        figures: [],
        recall_questions: [
          { id: "q-note", answer_type: "text", text: "What do you remember most about that autumn?" },
        ],
      },
    } as unknown as Opened;
    const html = renderToStaticMarkup(
      createElement(RecallStep, {
        opened,
        drafts: {},
        invalid: [],
        submitting: false,
        onEdit: () => {},
        onToggleNoAnswer: () => {},
        onSubmit: () => {},
        testify: PERSONA_TESTIFY,
      }),
    );
    expect(html).toContain("data-memory-line");
    expect(html).toContain(REVEAL_COPY.memoryLine.replace("{month}", "May 2024"));
  });

  it("keeps the Memory_Line off for a letter Testify_Context on the reading walk without a persona", () => {
    const html = render(0, { testify: { kind: "letter" } });
    expect(html).not.toContain("data-memory-line");
    expect(html).toContain(REVEAL_COPY.sealIntact);
  });
});
