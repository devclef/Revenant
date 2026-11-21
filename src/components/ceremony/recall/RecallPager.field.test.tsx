// Feature: 08-judge-polish, task 2 (issue #190): the recall number field and the
// unit helper line in the Recall_Pager (R32.4, R32.7, R32.8, R32.13, R7.8).
//
// The pager is rendered to static markup, so these tests read the first paint:
// the parsed value, the two readings, the unreadable message and the disabled
// Next control. The state changes (typing, picking) are covered by the field
// tests in recall-field.test.ts.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { REVEAL_COPY } from "@/components/reveal/copy";
import { CEREMONY_COPY } from "../copy";
import { RecallPager, type RecallPagerProps } from "./RecallPager";
import type { PayloadV1 } from "@/lib/seal-format";

type Payload = Pick<PayloadV1, "metrics" | "recall_questions">;

function payloadFor(unit: string): Payload {
  return {
    metrics: [{ id: "m1", unit } as unknown as PayloadV1["metrics"][number]],
    recall_questions: [
      {
        id: "q1",
        text: "What do you think it cost then?",
        answer_type: "number",
        metric_id: "m1",
      } as unknown as PayloadV1["recall_questions"][number],
    ],
  };
}

function render(
  text: string,
  unit = "USD per gallon",
  overrides: Partial<RecallPagerProps> = {},
): string {
  const props: RecallPagerProps = {
    payload: payloadFor(unit),
    drafts: { q1: { text, noAnswer: false } },
    invalid: [],
    submitting: false,
    onEdit: () => undefined,
    onToggleNoAnswer: () => undefined,
    onSubmit: () => undefined,
    ...overrides,
  };
  return renderToStaticMarkup(<RecallPager {...props} />);
}

/** The opening tag of the advance control: the NavRow main button on a number question. */
function nextButton(markup: string): string {
  const match = /<button[^>]*data-fit="advance"[^>]*>/.exec(markup);
  return match?.[0] ?? "";
}

describe("no parsed-value line (T2.3)", () => {
  it("shows no Read as line, and the number reaches the Recall_Scale label only", () => {
    const markup = render("1585.76");
    expect(markup).not.toContain("Read as");
    expect(markup).not.toMatch(/recall-q1-parsed/);
    expect(markup).toContain('data-readout="readout"');
    expect(markup).toContain("1,585.76");
  });

  it("shows no parsed value for an empty field (R32.13)", () => {
    const markup = render("");
    expect(markup).not.toContain("Read as");
    expect(markup).not.toContain(CEREMONY_COPY.numberUnreadable);
  });

  it("shows no value in the Recall_Scale label while the field is ambiguous", () => {
    const markup = render("1.585");
    expect(markup).not.toContain('data-readout="readout"');
    expect(markup).toContain(CEREMONY_COPY.recallNoMarkYet);
  });

  it("shows no value in the Recall_Scale label while the field is unreadable", () => {
    const markup = render("12a");
    expect(markup).not.toContain('data-readout="readout"');
    expect(markup).toContain(CEREMONY_COPY.recallNoMarkYet);
  });
});

describe("the next control waits for a reading (R32.5, R32.13)", () => {
  it("is enabled once the field resolves to a value", () => {
    expect(nextButton(render("1585.76"))).not.toContain("disabled");
  });

  it("is disabled for an empty field", () => {
    expect(nextButton(render(""))).toContain("disabled");
  });

  it("is disabled for an ambiguous field until a reading is picked", () => {
    expect(nextButton(render("1.585"))).toContain("disabled");
  });

  it("is enabled for an empty field when no answer is ticked", () => {
    const markup = render("", "USD per gallon", {
      drafts: { q1: { text: "", noAnswer: true } },
    });
    expect(nextButton(markup)).not.toContain("disabled");
  });
});

describe("the two readings of an Ambiguous_Input (R32.4)", () => {
  it("offers the decimal reading first, neither checked, in words", () => {
    const markup = render("1.585");
    expect(markup).toContain(CEREMONY_COPY.readingLegend);
    const decimal = markup.indexOf("1 point 585");
    const grouping = markup.indexOf("1 thousand 585");
    expect(decimal).toBeGreaterThan(-1);
    expect(grouping).toBeGreaterThan(decimal);
    expect(markup).not.toMatch(/type="radio"[^>]*checked/);
  });

  it("writes the grouping reading of a 000 tail as just the thousands (R32.4)", () => {
    const markup = render("3,000");
    expect(markup).toContain("3 point 000");
    expect(markup).toContain(">3 thousand<");
  });

  it("links the group from the field by aria-describedby", () => {
    expect(render("1.585")).toMatch(/aria-describedby="[^"]*recall-q1-readings/);
  });
});

describe("the unreadable message (R32.7)", () => {
  it("shows the fixed example and keeps the field invalid", () => {
    const markup = render("12a");
    expect(markup).toContain(CEREMONY_COPY.numberUnreadable);
    expect(markup).toContain('aria-invalid="true"');
  });

  it("keeps the next control disabled for an unreadable field", () => {
    expect(nextButton(render("12a"))).toContain("disabled");
  });
});

describe("the EUR per litre display with its rescale note (C8)", () => {
  it("shows the displayed unit and the note, linked by aria-describedby", () => {
    const markup = render("1200", "EUR per 1,000 litres");
    expect(markup).toContain("EUR per litre");
    expect(markup).not.toContain("EUR per 1,000 litres");
    expect(markup).toContain("Published per 1,000 litres, shown per litre.");
    expect(markup).toMatch(/aria-describedby="[^"]*recall-q1-unit-help/);
  });

  it("shows no note for a USD block", () => {
    const markup = render("3.47", "USD per gallon");
    expect(markup).not.toContain("Published per");
    expect(markup).not.toContain("recall-q1-unit-help");
  });
});

// T2.1 (spec 14): the number question's parts come in one order, the main
// button sits in the Nav_Row, and no parsed-value line is shown (T2.3, T2.5).
describe("number question order and the Nav_Row main button (T2.1, T2.3, T2.5)", () => {
  function twoNumberQuestions(): Payload {
    const metric = { id: "m1", unit: "USD per gallon" } as unknown as PayloadV1["metrics"][number];
    const question = (id: string) =>
      ({
        id,
        text: `Question ${id}?`,
        answer_type: "number",
        metric_id: "m1",
      }) as unknown as PayloadV1["recall_questions"][number];
    return { metrics: [metric], recall_questions: [question("q1"), question("q2")] };
  }

  it("shows the parts in the T2.1 order, with the Nav_Row last", () => {
    const markup = render("3.59", "USD per gallon", {
      samples: { q1: "3.59" },
    });
    const parts = [
      'data-fit="counter"',
      'data-fit="question"',
      REVEAL_COPY.recallHint,
      'id="recall-q1-unit"',
      'id="recall-q1"',
      REVEAL_COPY.sampleNote,
      'role="slider"',
      'id="recall-q1-no-answer"',
      'data-nav-row=""',
    ];
    let last = -1;
    for (const part of parts) {
      const at = markup.indexOf(part);
      expect(at, part).toBeGreaterThan(last);
      last = at;
    }
  });

  it("shows no parsed-value line or id, and no read-as text (T2.3)", () => {
    const markup = render("1585.76");
    expect(markup).not.toContain("Read as");
    expect(markup).not.toMatch(/recall-q1-parsed/);
    expect(markup).not.toMatch(/aria-describedby="[^"]*-parsed/);
  });

  it("keeps the main button out of the answer row (T2.5)", () => {
    const markup = render("3.59");
    const start = markup.indexOf('data-fit="answer"');
    const end = markup.indexOf("</div>", start);
    expect(start).toBeGreaterThan(-1);
    expect(markup.slice(start, end)).not.toContain("<button");
    expect(markup.slice(start, end)).not.toContain('data-fit="advance"');
  });

  it("puts the main button in the Nav_Row on question 1, with no Previous control", () => {
    const markup = render("3.59", "USD per gallon", {
      payload: twoNumberQuestions(),
      drafts: { q1: { text: "3.59", noAnswer: false }, q2: { text: "", noAnswer: false } },
    });
    const nav = markup.indexOf('data-nav-row=""');
    const advance = markup.indexOf('data-fit="advance"');
    expect(nav).toBeGreaterThan(-1);
    expect(advance).toBeGreaterThan(nav);
    expect(markup).toContain(`>${REVEAL_COPY.nextQuestion}</button>`);
    expect(markup).not.toContain(REVEAL_COPY.previousQuestion);
  });
});
