// Feature: spec 10 (own questions), C4.5, C4.6, C7.2: the text questions and the
// placement of "No answer" in the Recall_Pager.
//
// The pager is rendered to static markup (no DOM in the node test environment),
// so these tests read the first paint. The submit refusal (an empty or too long
// text answer does not advance) runs in the browser, and its rule is tested in
// recall-field.test.ts (canAdvanceText).

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { REVEAL_COPY } from "@/components/reveal/copy";
import { CEREMONY_COPY } from "../copy";
import { RecallPager, type RecallPagerProps } from "./RecallPager";
import type { PayloadV1 } from "@/lib/seal-format";

type Payload = Pick<PayloadV1, "metrics" | "recall_questions">;

const TEXT_QUESTION = "What was the week like?";
const NUMBER_QUESTION = "What do you think a gallon of gas cost then?";

const textPayload: Payload = {
  metrics: [
    {
      id: "m1",
      unit: "USD per gallon",
    } as unknown as PayloadV1["metrics"][number],
  ],
  recall_questions: [
    { id: "a1", text: TEXT_QUESTION, answer_type: "text" },
    { id: "a2", text: "A second text question?", answer_type: "text" },
  ] as unknown as Payload["recall_questions"],
};

const numberPayload: Payload = {
  metrics: [
    {
      id: "m1",
      unit: "USD per gallon",
    } as unknown as PayloadV1["metrics"][number],
  ],
  recall_questions: [
    { id: "q1", text: NUMBER_QUESTION, answer_type: "number", metric_id: "m1" },
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
      onEdit={() => undefined}
      onToggleNoAnswer={() => undefined}
      onSubmit={() => undefined}
      {...overrides}
    />,
  );
}

describe("a text question (C4.5)", () => {
  it("renders a four-row textarea named by its heading", () => {
    const markup = render(textPayload);
    expect(markup).toContain("<textarea");
    expect(markup).toContain('rows="4"');
    expect(markup).toContain('aria-labelledby="recall-a1-title"');
    expect(markup).toContain('data-stage-focus=""');
  });

  it("shows the live count of the empty answer", () => {
    const markup = render(textPayload);
    expect(markup).toContain(fill(REVEAL_COPY.textCount, { count: 0 }));
  });

  it("shows no number parser, scale or unit", () => {
    const markup = render(textPayload);
    expect(markup).not.toContain('inputMode="decimal"');
    expect(markup).not.toContain(CEREMONY_COPY.parsedValue.split("{value}")[0]);
    expect(markup).not.toContain(CEREMONY_COPY.recallNoMarkYet);
    expect(markup).not.toContain(
      REVEAL_COPY.unitLabel.replace("{unit}", "USD per gallon"),
    );
  });

  it("keeps the Next control enabled, so a refused submit can show its message", () => {
    const markup = render(textPayload);
    expect(markup).toContain(REVEAL_COPY.nextQuestion);
    expect(buttonTag(markup, REVEAL_COPY.nextQuestion)).not.toContain(
      "disabled",
    );
  });

  it("shows the invalid message only after a refused submit", () => {
    expect(render(textPayload)).not.toContain(REVEAL_COPY.textAnswerInvalid);
    expect(render(textPayload, { invalid: ["a1"] })).toContain(
      REVEAL_COPY.textAnswerInvalid,
    );
  });

  it("offers Record my answers on the last text question", () => {
    const markup = render(textPayload, { initialIndex: 1 });
    expect(markup).toContain(REVEAL_COPY.submit);
    expect(markup).not.toContain(REVEAL_COPY.nextQuestion);
  });

  it("wraps the sealed question text in data-user-content", () => {
    expect(render(textPayload)).toContain(
      `<span data-user-content="">${TEXT_QUESTION}</span>`,
    );
  });
});

describe("No answer placement (C7.2)", () => {
  it("sits directly under the field group, before the scale, on a number question", () => {
    const markup = render(numberPayload);
    const label = `${REVEAL_COPY.noAnswer}</label>`;
    const noAnswer = markup.indexOf(label);
    const next = markup.indexOf(REVEAL_COPY.submit);
    const scale = markup.indexOf(CEREMONY_COPY.recallNoMarkYet);
    expect(next).toBeGreaterThan(-1);
    expect(noAnswer).toBeGreaterThan(next);
    expect(scale).toBeGreaterThan(noAnswer);
  });

  it("sits under the text field on a text question", () => {
    const markup = render(textPayload);
    expect(markup.indexOf("<textarea")).toBeLessThan(
      markup.indexOf(`${REVEAL_COPY.noAnswer}</label>`),
    );
  });
});

function fill(
  template: string,
  values: Record<string, string | number>,
): string {
  let text = template;
  for (const [name, value] of Object.entries(values)) {
    text = text.split(`{${name}}`).join(String(value));
  }
  return text;
}

/** The opening tag of the button whose text is `label`. */
function buttonTag(markup: string, label: string): string {
  const start = markup.indexOf(`>${label}</button>`);
  if (start < 0) return "";
  const open = markup.lastIndexOf("<button", start);
  return markup.slice(open, start);
}

// Feature: spec 14 (T1.2, T7): the recall counter. A live or real letter names
// the day it was sealed ("you wrote this on"); a persona keeps its "as of"
// counter and ignores the sealing instant.

describe("the recall counter (spec 14, T1.2)", () => {
  const sealed = {
    sealedAt: "2026-11-17T09:00:00Z",
    timeZone: "UTC",
  };

  it("shows the written-on form on a live or real letter", () => {
    const markup = render(textPayload, { writtenOn: sealed });
    expect(counterText(markup)).toBe(
      "Question 1 of 2 · you wrote this on 17 November 2026",
    );
  });

  it("marks the counter with data-recall-counter only in the written-on form", () => {
    const withDay = render(textPayload, { writtenOn: sealed });
    expect(withDay).toMatch(/data-recall-counter=""/);
    const plain = render(textPayload);
    expect(plain).not.toContain("data-recall-counter");
  });

  it("names the calendar day in the stated time zone, not in UTC", () => {
    const markup = render(textPayload, {
      writtenOn: {
        sealedAt: "2026-11-17T23:30:00Z",
        timeZone: "Europe/Stockholm",
      },
    });
    expect(markup).toContain("you wrote this on 18 November 2026");
  });

  it("keeps the plain counter when the sealing instant does not parse", () => {
    const markup = render(textPayload, {
      writtenOn: { sealedAt: "not a date", timeZone: "UTC" },
    });
    expect(markup).toContain("Question 1 of 2");
    expect(markup).not.toContain("you wrote this on");
    expect(markup).not.toContain("data-recall-counter");
  });

  it("keeps the as-of counter on a persona and ignores the sealing instant", () => {
    const markup = render(textPayload, {
      writtenAsOf: "2024-05-12",
      writtenOn: sealed,
    });
    expect(counterText(markup)).toBe("Question 1 of 2 · as of 12 May 2024");
    expect(markup).not.toContain("you wrote this on");
    expect(markup).not.toContain("data-recall-counter");
  });
});

/** The text of the question counter paragraph, with its markup removed. */
function counterText(markup: string): string {
  const match = /<p class="[^"]*" data-fit="counter"[^>]*>(.*?)<\/p>/.exec(
    markup,
  );
  return (match?.[1] ?? "").replace(/<[^>]+>/g, "");
}
