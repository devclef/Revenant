import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RememberedAnswers } from "./RememberedAnswers";
import { REVEAL_COPY } from "./copy";
import type { Opened } from "./opening-machine";
import type { RecallRecordV1 } from "@/lib/recall";
import type { PayloadV1 } from "@/lib/seal-format";

/**
 * Markup tests for stage 1 of the reveal (R9.2, R9.3, R3.8). Rendered with
 * `renderToStaticMarkup` and `createElement` — no DOM library and no JSX.
 *
 * Stage 1 is the ONLY stage shown before the letter. It shows, per question:
 * the question text, the figure's unit, and the judge's own answer — either the
 * decimal they recorded ("Your answer: 3.50") or "No answer". It must show
 * nothing from inside the letter: no sealed figure value, period, source or
 * comparison (R3.8).
 */

/** The same payload the recall step used, with figure provenance present so the
 * test can prove stage 1 renders none of it. */
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
        id: "q-note",
        answer_type: "text",
        text: "What were you spending most on then?",
      },
    ],
  } satisfies PayloadV1,
};

const RECORD: RecallRecordV1 = {
  version: 1,
  answers: [
    { question_id: "q-fuel", kind: "number", value: "2.50" },
    { question_id: "q-note", kind: "no_answer" },
  ],
};

function render(record: RecallRecordV1): string {
  return renderToStaticMarkup(
    createElement(RememberedAnswers, { opened: OPENED, record }),
  );
}

describe("RememberedAnswers markup", () => {
  it("shows the stage 1 heading", () => {
    const html = render(RECORD);
    expect(html).toContain(REVEAL_COPY.stage1Title);
  });

  it("shows each question's text in payload order", () => {
    const html = render(RECORD);
    for (const question of OPENED.payload.recall_questions) {
      expect(html).toContain(question.text);
    }
    expect(
      html.indexOf(OPENED.payload.recall_questions[0].text),
    ).toBeLessThan(html.indexOf(OPENED.payload.recall_questions[1].text));
  });

  it("shows a number answer exactly as recorded, with the Your answer prefix", () => {
    const html = render(RECORD);
    expect(html).toContain(`${REVEAL_COPY.yourAnswer}: 2.50`);
  });

  it('shows "No answer" for a no-answer entry', () => {
    const html = render(RECORD);
    expect(html).toContain(REVEAL_COPY.noAnswer);
  });

  it("shows the figure's unit for a number question (R8.2)", () => {
    const html = render(RECORD);
    expect(html).toContain(
      REVEAL_COPY.unitLabel.replace("{unit}", "USD per gallon"),
    );
  });

  it('falls back to "No answer" when the record has no entry for a question', () => {
    const html = render({
      version: 1,
      answers: [{ question_id: "q-fuel", kind: "number", value: "2.50" }],
    });
    // q-note has no entry; it still renders as No answer, never blank.
    expect(html).toContain(REVEAL_COPY.noAnswer);
  });

  it("renders no sealed figure value, period, source or comparison (R3.8)", () => {
    const html = render(RECORD);
    const forbidden = [
      "3.412", // the sealed figure value (not the remembered 2.50)
      "2024-10", // the figure's period
      "U.S. EIA", // the figure's source
      "EMM_EPMR_PTE_NUS_DPG", // the series id
      "LETTER_BODY_SECRET", // the letter text
      "https://www.eia.gov/fixture", // the source url
      "%", // a change / comparison
    ];
    for (const needle of forbidden) {
      expect(
        html,
        `stage 1 must not leak "${needle}"`,
      ).not.toContain(needle);
    }
  });
});
