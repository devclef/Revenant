// Feature: spec 15 (the flow), task 11.1: author questions and persona
// recollections on the Testify step. Covers the prototype screens testify-text,
// testify-number and testify-last (docs/design/15-flow/README.md, entries 23 to
// 25).
//
// The pager is rendered to static markup (no DOM in the node test environment).
// React escapes the apostrophe in "I don't remember" as &#x27;, so the expected
// strings go through `escaped` before a markup check.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { REVEAL_COPY } from "@/components/reveal/copy";
import { RecallPager, type RecallPagerProps } from "./RecallPager";
import type { PayloadV1 } from "@/lib/seal-format";

type Payload = Pick<PayloadV1, "metrics" | "recall_questions">;

const SEALED_AT = "2026-11-19T10:00:00Z";
const TIME_ZONE = "Europe/Stockholm";
const WRITTEN_ON = "19 November 2026";

const TEXT_QUESTION = "What is on my mind about work right now?";
const SECOND_TEXT_QUESTION = "What do I most want to remember this week?";
const FIGURE_QUESTION =
  "What do you think a gallon of regular gasoline cost then?";

const textPayload: Payload = {
  metrics: [
    {
      id: "m1",
      unit: "USD per gallon",
    } as unknown as PayloadV1["metrics"][number],
  ],
  recall_questions: [
    { id: "a1", text: TEXT_QUESTION, answer_type: "text" },
    { id: "a2", text: SECOND_TEXT_QUESTION, answer_type: "text" },
  ] as unknown as Payload["recall_questions"],
};

const figurePayload: Payload = {
  metrics: [
    {
      id: "m1",
      unit: "USD per gallon",
    } as unknown as PayloadV1["metrics"][number],
  ],
  recall_questions: [
    { id: "q1", text: FIGURE_QUESTION, answer_type: "number", metric_id: "m1" },
  ] as unknown as Payload["recall_questions"],
};

function render(
  payload: Payload,
  overrides: Partial<RecallPagerProps> = {},
): string {
  return renderToStaticMarkup(
    <RecallPager
      payload={payload}
      drafts={{}}
      invalid={[]}
      submitting={false}
      writtenOn={{ sealedAt: SEALED_AT, timeZone: TIME_ZONE }}
      onEdit={() => undefined}
      onToggleNoAnswer={() => undefined}
      onSubmit={() => undefined}
      {...overrides}
    />,
  );
}

/** The text as React writes it into static markup (apostrophes escaped). */
function escaped(text: string): string {
  return text.replace(/'/g, "&#x27;");
}

describe("testify-text: an author question (spec 15, 11.1)", () => {
  it("shows the sealing day on its own line, before the question", () => {
    const markup = render(textPayload);
    const line = escaped(`On ${WRITTEN_ON} you asked yourself:`);
    expect(markup).toContain(line);
    expect(markup).toContain('data-asked-line=""');
    expect(markup.indexOf(line)).toBeLessThan(markup.indexOf(TEXT_QUESTION));
  });

  it("keeps the date out of the question itself", () => {
    const markup = render(textPayload);
    const heading = markup.slice(
      markup.indexOf('id="recall-a1-title"'),
      markup.indexOf("</h2>"),
    );
    expect(heading).toContain(TEXT_QUESTION);
    expect(heading).not.toContain(WRITTEN_ON);
  });

  it("labels the field 'What you think you answered' with its hint", () => {
    const markup = render(textPayload);
    expect(REVEAL_COPY.answerFromMemory).toBe("What you think you answered");
    expect(markup).toContain(escaped(REVEAL_COPY.answerFromMemory));
    expect(markup).toContain(escaped(REVEAL_COPY.answerHint));
  });

  it("offers I don't remember in place of No answer", () => {
    const markup = render(textPayload);
    expect(markup).toContain(`${escaped(REVEAL_COPY.dontRemember)}</label>`);
    expect(markup).not.toContain(`${REVEAL_COPY.noAnswer}</label>`);
  });

  it("uses the persona's as-of date when the letter has one", () => {
    const markup = render(textPayload, {
      writtenOn: undefined,
      writtenAsOf: "2024-05-12",
    });
    expect(markup).toContain(
      escaped(REVEAL_COPY.askedAsOf.replace("{date}", "12 May 2024")),
    );
  });

  it("shows no asked line when the sealing instant does not parse", () => {
    const markup = render(textPayload, {
      writtenOn: { sealedAt: "not a date", timeZone: TIME_ZONE },
    });
    expect(markup).not.toContain('data-asked-line=""');
  });
});

describe("testify-number: a figure question keeps today's controls", () => {
  it("shows no asked line and no author-question label", () => {
    const markup = render(figurePayload);
    expect(markup).not.toContain('data-asked-line=""');
    expect(markup).not.toContain(escaped(REVEAL_COPY.answerFromMemory));
  });

  it("keeps No answer and does not offer I don't remember", () => {
    const markup = render(figurePayload);
    expect(markup).toContain(`${REVEAL_COPY.noAnswer}</label>`);
    expect(markup).not.toContain(escaped(REVEAL_COPY.dontRemember));
  });
});

describe("testify-last: the last author question", () => {
  it("names its own sealing day and offers the submit control", () => {
    const markup = render(textPayload, { initialIndex: 1 });
    expect(markup).toContain(escaped(`On ${WRITTEN_ON} you asked yourself:`));
    expect(markup).toContain(SECOND_TEXT_QUESTION);
    expect(markup).toContain(REVEAL_COPY.submit);
    expect(markup).not.toContain(REVEAL_COPY.nextQuestion);
  });

  it("still offers I don't remember on the last question", () => {
    const markup = render(textPayload, { initialIndex: 1 });
    expect(markup).toContain(`${escaped(REVEAL_COPY.dontRemember)}</label>`);
  });

  it("shows the plain counter on a live letter's author question", () => {
    const markup = render(textPayload, { initialIndex: 1 });
    expect(markup).toContain("Question 2 of 2");
    expect(markup).not.toContain("you wrote this on");
    expect(markup).not.toContain("sealed on");
  });
});
