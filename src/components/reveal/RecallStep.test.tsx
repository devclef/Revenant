import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RecallStep } from "./RecallStep";
import { REVEAL_COPY } from "./copy";
import type { Opened } from "./opening-machine";
import type { Draft } from "@/lib/recall";
import type { PayloadV1 } from "@/lib/seal-format";

/**
 * Markup tests for the recall step (R8.1-R8.4, R16.4, neutrality.md). Rendered
 * with `renderToStaticMarkup` and `createElement` — no DOM library and no JSX,
 * so the step's full output is a string we can scan. The component is pure: it
 * renders from the props it is given and nothing else, so a fixed `Opened` and
 * drafts drive every assertion.
 *
 * The step shows BEFORE anything inside the letter is revealed. It must show
 * the sealed question text, a decimal input with the figure's unit and a
 * "No answer" control — and must leak no sealed figure value, period, source
 * or comparison (neutrality.md: no hint of which way a figure moved).
 */

/**
 * A fixed opened letter with two number questions and one text question. The
 * figure values, periods and sources below are deliberately present in the
 * payload so the tests can prove the recall step renders NONE of them.
 */
const OPENED: Opened = {
  letterId: "letter-1",
  header: {
    sealedAt: "2024-10-01T00:00:00.000Z",
    opensAt: "2024-11-05T00:00:00.000Z",
  },
  openingKey: {} as unknown as CryptoKey,
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
        unit: "USD per gallon",
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
        text: "What do you think a gallon of milk cost then?",
        metric_id: "milk",
      },
      {
        id: "q-note",
        answer_type: "text",
        text: "What were you spending most on then?",
      },
    ],
  } satisfies PayloadV1,
};

const NOOP = () => {};

function render(
  drafts: Record<string, Draft>,
  invalid: string[],
  submitting: boolean,
): string {
  return renderToStaticMarkup(
    createElement(RecallStep, {
      opened: OPENED,
      drafts,
      invalid,
      submitting,
      onEdit: NOOP,
      onToggleNoAnswer: NOOP,
      onSubmit: NOOP,
    }),
  );
}

const EMPTY_DRAFTS: Record<string, Draft> = {
  "q-fuel": { text: "", noAnswer: false },
  "q-milk": { text: "", noAnswer: false },
  "q-note": { text: "", noAnswer: false },
};

describe("RecallStep markup", () => {
  it("is a form with noValidate so the browser's own validation never fires", () => {
    const html = render(EMPTY_DRAFTS, [], false);
    expect(html).toContain("<form");
    // renderToStaticMarkup keeps React's prop name `noValidate` (camelCase) and
    // serialises the boolean as `noValidate=""`.
    expect(html).toContain('noValidate=""');
  });

  it("renders one fieldset per sealed question, legend = question text verbatim", () => {
    const html = render(EMPTY_DRAFTS, [], false);
    const fieldsets = html.match(/<fieldset/g) ?? [];
    expect(fieldsets).toHaveLength(OPENED.payload.recall_questions.length);
    for (const question of OPENED.payload.recall_questions) {
      expect(html).toContain(`<legend`);
      expect(html).toContain(question.text);
    }
  });

  it("renders a decimal input (inputMode=decimal) for every question", () => {
    const html = render(EMPTY_DRAFTS, [], false);
    const decimalInputs = html.match(/inputMode="decimal"/g) ?? [];
    expect(decimalInputs).toHaveLength(OPENED.payload.recall_questions.length);
  });

  it("shows each number question's unit from the sealed metric (R8.2)", () => {
    const html = render(EMPTY_DRAFTS, [], false);
    // Both number questions ask about a USD-per-gallon metric, so the unit
    // label appears for each. The text question has no unit.
    const unitLabel = REVEAL_COPY.unitLabel.replace("{unit}", "USD per gallon");
    const labels = html.split(unitLabel).length - 1;
    expect(labels).toBe(2);
  });

  it('renders a "No answer" checkbox for every question (R8.3)', () => {
    const html = render(EMPTY_DRAFTS, [], false);
    const checkboxes = html.match(/type="checkbox"/g) ?? [];
    expect(checkboxes).toHaveLength(OPENED.payload.recall_questions.length);
    expect(html).toContain(REVEAL_COPY.noAnswer);
  });

  it("disables the number input when its draft is marked No answer", () => {
    const drafts: Record<string, Draft> = {
      ...EMPTY_DRAFTS,
      "q-fuel": { text: "", noAnswer: true },
    };
    const html = render(drafts, [], false);
    // Exactly one of the text inputs is disabled (the No-answer one).
    const disabled = html.match(/<input[^>]*disabled/g) ?? [];
    expect(disabled).toHaveLength(1);
  });

  it("shows the inline error only for an invalid question (R8.4)", () => {
    const withError = render(EMPTY_DRAFTS, ["q-fuel"], false);
    expect(withError).toContain(REVEAL_COPY.answerInvalid);
    expect(withError).toContain('role="alert"');

    const noError = render(EMPTY_DRAFTS, [], false);
    expect(noError).not.toContain(REVEAL_COPY.answerInvalid);
  });

  it("disables the submit control while submitting and shows the posting copy (R8.9)", () => {
    const html = render(EMPTY_DRAFTS, [], true);
    expect(html).toContain(REVEAL_COPY.submitting);
    expect(html).toContain("disabled");
  });

  it("enables the submit control when not submitting and shows the submit copy", () => {
    const html = render(EMPTY_DRAFTS, [], false);
    expect(html).toContain(REVEAL_COPY.submit);
    // The submit button is not disabled: the only disabled control possible
    // here would be a No-answer input, and none is toggled.
    expect(html).not.toContain("disabled");
  });

  it("renders no sealed figure value, period, source or comparison (R16.4, neutrality.md)", () => {
    const html = render(EMPTY_DRAFTS, [], false);
    const forbidden = [
      "3.412", // the sealed figure value
      "2024-10", // the figure's period
      "U.S. EIA", // the figure's source
      "EMM_EPMR_PTE_NUS_DPG", // the series id
      "LETTER_BODY_SECRET", // the letter text
      "https://www.eia.gov/fixture", // the source url
      "%", // a change / comparison
      "then and now",
    ];
    for (const needle of forbidden) {
      expect(
        html,
        `recall step must not leak "${needle}"`,
      ).not.toContain(needle);
    }
  });
});
