import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RecallStep } from "./RecallStep";
import { REVEAL_COPY } from "./copy";
import { CEREMONY_COPY } from "@/components/ceremony/copy";
import { formatCalendarDate } from "@/components/ui/letter-date";
import { RecallPager } from "@/components/ceremony/recall/RecallPager";
import type { Opened } from "./opening-machine";
import type { Draft } from "@/lib/recall";
import type { PayloadV1 } from "@/lib/seal-format";

/**
 * Markup tests for the recall step, now the Recall_Pager (spec 07 R11).
 *
 * Spec 07 (R11.1, R11.10) replaces spec 03 R8.1 and R8.4 here. The step shows
 * one question at a time, in payload order, not a fieldset per question. The
 * step still shows the sealed question text and the figure's unit, one
 * decimal input, a "No answer" control and the inline error for an invalid
 * answer. It still leaks no sealed figure value, period, source or comparison
 * (neutrality.md).
 *
 * Rendered with `renderToStaticMarkup` and `createElement`, so the output is a
 * string. The pager's first question is shown; `initialIndex` picks another.
 * Paging itself (Enter, Next, invalid jumps) is tested in
 * `RecallPager.property.test.tsx` through the pure rules in `recall-pager.ts`.
 */

const WRITTEN_AS_OF = "2024-10-01";

const OPENED: Opened = {
  letterId: "letter-1",
  header: {
    sealedAt: "2024-10-01T00:00:00.000Z",
    opensAt: "2024-11-05T00:00:00.000Z",
  },
  openingKey: {} as unknown as CryptoKey,
  envelopeHash:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  payload: {
    format_version: 1,
    letter_text: "LETTER_BODY_SECRET the letter text must never appear here.",
    metrics: [
      {
        id: "fuel",
        display_name: "Regular gasoline",
        unit: "USD per gallon",
        region: "U.S. city average",
        source: "U.S. EIA",
        series_id: "EMM_EPMR_PTE_NUS_DPG",
      },
      {
        id: "milk",
        display_name: "Milk",
        unit: "USD per litre",
        region: "U.S. city average",
        source: "U.S. BLS",
        series_id: "APU0000709112",
      },
    ],
    figures: [
      {
        kind: "official",
        metric_id: "fuel",
        value: "3.412",
        unit: "USD per gallon",
        region: "U.S. city average",
        period: "2024-10",
        source: "U.S. EIA",
        series_id: "EMM_EPMR_PTE_NUS_DPG",
        retrieved_at: "2024-10-30T14:02:11Z",
        source_url: "https://www.eia.gov/fixture",
      },
    ],
    recall_questions: [
      {
        id: "q-fuel",
        answer_type: "number",
        text: "What do you think a gallon of regular gasoline cost then?",
        metric_id: "fuel",
      },
      {
        id: "q-milk",
        answer_type: "number",
        text: "What did a litre of milk cost then?",
        metric_id: "milk",
      },
      {
        id: "q-note",
        answer_type: "text",
        text: "What do you remember most about that autumn?",
        metric_id: "fuel",
      },
    ],
  } as unknown as PayloadV1,
};

const NO_DRAFTS: Readonly<Record<string, Draft>> = {};

type Props = Partial<Parameters<typeof RecallStep>[0]> & {
  initialIndex?: number;
  writtenAsOf?: string;
};

/** Render the recall step. `initialIndex` picks the shown question. */
function render(props: Props = {}): string {
  const { initialIndex, ...stepProps } = props;
  const base = {
    opened: OPENED,
    drafts: NO_DRAFTS,
    invalid: [] as string[],
    submitting: false,
    onEdit: () => {},
    onToggleNoAnswer: () => {},
    onSubmit: () => {},
    ...stepProps,
  };
  if (initialIndex === undefined) {
    return renderToStaticMarkup(createElement(RecallStep, base));
  }
  // The pager is rendered directly to choose a question; the step adds only its surface.
  return renderToStaticMarkup(
    createElement(RecallPager, {
      payload: OPENED.payload,
      drafts: base.drafts,
      invalid: base.invalid,
      submitting: base.submitting,
      failed: stepProps.failed,
      writtenAsOf: stepProps.writtenAsOf,
      onEdit: base.onEdit,
      onToggleNoAnswer: base.onToggleNoAnswer,
      onSubmit: base.onSubmit,
      initialIndex,
    }),
  );
}

/** Count occurrences of `needle` in `html`. */
function count(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

describe("RecallStep shows one question at a time (R11.1)", () => {
  it("is a form with noValidate so the browser's own validation never fires", () => {
    expect(render()).toContain("noValidate");
  });

  it("shows the first question only, with its text as the heading", () => {
    const html = render();
    expect(html).toContain(OPENED.payload.recall_questions[0].text);
    expect(html).not.toContain(OPENED.payload.recall_questions[1].text);
    expect(html).not.toContain(OPENED.payload.recall_questions[2].text);
    expect(count(html, "<fieldset")).toBe(1);
  });

  it("shows the second question on index 1, not the first", () => {
    const html = render({ initialIndex: 1 });
    expect(html).toContain(OPENED.payload.recall_questions[1].text);
    expect(html).not.toContain(OPENED.payload.recall_questions[0].text);
  });

  it("shows the figure's unit for a number question (R8.2)", () => {
    const html = render();
    expect(html).toContain(REVEAL_COPY.unitLabel.replace("{unit}", "USD per gallon"));
  });

  it("shows no unit for a text question", () => {
    const html = render({ initialIndex: 2 });
    expect(html).not.toContain("in USD");
    expect(html).not.toContain("in USD per litre");
  });

  it("renders one decimal input for the shown question", () => {
    expect(count(render(), 'inputMode="decimal"')).toBe(1);
  });

  it("renders a No answer checkbox for the shown question (R11.7)", () => {
    const html = render();
    expect(count(html, 'type="checkbox"')).toBe(1);
    expect(html).toContain(REVEAL_COPY.noAnswer);
  });

  it("disables the number input when its draft is marked No answer", () => {
    const html = render({
      drafts: { "q-fuel": { text: "3.50", noAnswer: true } },
    });
    const input = html.match(/<input[^>]*id="recall-q-fuel"[^>]*>/)?.[0] ?? "";
    expect(input).toContain("disabled");
    expect(html).toContain('checked=""');
  });

  it("shows the typed text in the input as entered", () => {
    const html = render({ drafts: { "q-fuel": { text: "3.50", noAnswer: false } } });
    expect(html).toContain('value="3.50"');
  });

  it("shows the inline error only when the shown question is invalid (R11.10)", () => {
    const shownInvalid = render({ invalid: ["q-fuel"] });
    expect(shownInvalid).toContain(REVEAL_COPY.answerInvalid);
    expect(shownInvalid).toContain('aria-invalid="true"');

    const otherInvalid = render({ invalid: ["q-milk"] });
    expect(otherInvalid).not.toContain(REVEAL_COPY.answerInvalid);
  });

  it("disables the Next control when the shown field is empty (R32.13)", () => {
    const html = render({ drafts: { "q-fuel": { text: "", noAnswer: false } } });
    expect(html).toMatch(/<button[^>]*data-fit="advance"[^>]*disabled[^>]*>/);
  });

  it("disables the Next control when the shown field is unreadable (R32.13)", () => {
    const html = render({ drafts: { "q-fuel": { text: "abc", noAnswer: false } } });
    expect(html).toMatch(/<button[^>]*data-fit="advance"[^>]*disabled[^>]*>/);
  });

  it("enables the Next control when the shown field holds a readable number (R32.13)", () => {
    const html = render({ drafts: { "q-fuel": { text: "3.50", noAnswer: false } } });
    expect(html).not.toMatch(/<button[^>]*data-fit="advance"[^>]*disabled[^>]*>/);
  });

  it("disables the submit control while submitting on the last question (R11.11)", () => {
    const html = render({ initialIndex: 2, submitting: true });
    expect(html).toContain(REVEAL_COPY.submitting);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>/);
  });

  it("enables the submit control when not submitting on the last question", () => {
    const html = render({ initialIndex: 2 });
    expect(html).toContain(REVEAL_COPY.submit);
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>/);
  });

  it("shows the submit-failed message with the answers kept on a failed post (R11.12)", () => {
    const html = render({ initialIndex: 2, failed: true });
    // The apostrophe in the copy is HTML-escaped in the markup, so check the first sentence.
    expect(html).toContain("Your answers could not be recorded. Nothing has been revealed yet.");
    expect(html).toContain('role="alert"');
  });

  it("renders no sealed figure value, period, source or comparison (R16.4, neutrality.md)", () => {
    const html = render();
    for (const needle of [
      "3.412",
      "2024-10",
      "EMM_EPMR_PTE_NUS_DPG",
      "APU0000709112",
      "U.S. EIA",
      "U.S. BLS",
      "eia.gov",
      "LETTER_BODY_SECRET",
      "retrieved",
      "rose",
      "fell",
    ]) {
      expect(html, `recall must not leak "${needle}"`).not.toContain(needle);
    }
  });
});

describe("RecallStep counter and controls (R11.5)", () => {
  it("shows the persona counter with the as-of date in a nowrap span", () => {
    const html = render({ writtenAsOf: WRITTEN_AS_OF });
    const asOf = formatCalendarDate(WRITTEN_AS_OF);
    expect(html).toContain(
      `Question 1 of 3${REVEAL_COPY.questionCounterSeparator}<span class="`,
    );
    expect(html).toContain(`>as of ${asOf}</span>`);
    expect(html).toContain("nowrap");
  });

  it("shows the Live_Letter counter with no as-of part", () => {
    const html = render();
    expect(html).toContain("Question 1 of 3");
    expect(html).not.toContain("as of");
  });

  it("shows Next question on every question but the last, and no Previous on the first", () => {
    const first = render();
    expect(first).toContain(REVEAL_COPY.nextQuestion);
    expect(first).not.toContain(REVEAL_COPY.previousQuestion);
    expect(first).not.toContain(REVEAL_COPY.submit);
  });

  it("shows Previous question and the submit control on the last question", () => {
    const last = render({ initialIndex: 2 });
    expect(last).toContain(REVEAL_COPY.previousQuestion);
    expect(last).toContain(REVEAL_COPY.submit);
    expect(last).not.toContain(REVEAL_COPY.nextQuestion);
  });

  it("shows only the submit control when there is one question", () => {
    const single: Opened = {
      ...OPENED,
      payload: {
        ...OPENED.payload,
        recall_questions: [OPENED.payload.recall_questions[0]],
      } as PayloadV1,
    };
    const html = renderToStaticMarkup(
      createElement(RecallPager, {
        payload: single.payload,
        drafts: NO_DRAFTS,
        invalid: [],
        submitting: false,
        onEdit: () => {},
        onToggleNoAnswer: () => {},
        onSubmit: () => {},
      }),
    );
    expect(html).toContain(REVEAL_COPY.submit);
    expect(html).not.toContain(REVEAL_COPY.nextQuestion);
    expect(html).not.toContain(REVEAL_COPY.previousQuestion);
  });
});

describe("RecallStep recall scale (spec 05 R4)", () => {
  it("puts a slider under the shown number question", () => {
    expect(render()).toContain(CEREMONY_COPY.recallNoMarkYet);
  });

  it("puts no slider on a text question", () => {
    const html = render({ initialIndex: 2 });
    expect(html).not.toContain(CEREMONY_COPY.recallNoMarkYet);
  });
});

describe("RecallStep hint and intro", () => {
  it("shows the persona intro with its written-as-of date on the first question", () => {
    const html = render({ writtenAsOf: WRITTEN_AS_OF });
    expect(html).toContain(
      REVEAL_COPY.recallIntro.replace("{date}", formatCalendarDate(WRITTEN_AS_OF)),
    );
  });

  it("shows the recall hint on a Live_Letter's first question", () => {
    expect(render()).toContain(REVEAL_COPY.recallHint);
  });
});
