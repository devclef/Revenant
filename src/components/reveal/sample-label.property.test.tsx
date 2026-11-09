// Feature: 10-own-questions, Property 17: The Sample_Label marks only Kept_Samples
//
// For any payload and Recall_Record_V2, RememberedAnswers ("Your testimony")
// and ReceiptCard ("Your answer") carry the Sample_Label next to exactly the
// number answers that have `sample: true`, and nowhere else. A kept sample
// renders the same elements, classes and words as any other kept sample.
//
// Validates: Requirements C5.8, C5.9, C5.11.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { RecallRecordV2 } from "@/lib/recall";
import type { PayloadV1 } from "@/lib/seal-format";

import { REVEAL_COPY } from "./copy";
import { ReceiptCard } from "./ReceiptCard";
import { RememberedAnswers } from "./RememberedAnswers";
import type { Opened } from "./opening-machine";

const LABEL = REVEAL_COPY.sampleLabel;

/** How many times the Sample_Label appears in one rendered string. */
function labelCount(markup: string): number {
  return markup.split(LABEL).length - 1;
}

const ANSWER = fc.record({
  // The kind of each question, in payload order. Text questions get text or
  // no answer; number questions get a number, with or without the flag.
  questionKind: fc.constantFrom("text" as const, "number" as const),
  answered: fc.boolean(),
  sample: fc.boolean(),
  value: fc.constantFrom("3.59", "1.20", "0.00", "10.00"),
});

type Row = {
  questionKind: "text" | "number";
  answered: boolean;
  sample: boolean;
  value: string;
};

/** Build the payload and the record for a generated list of answers. */
function scenario(rows: readonly Row[]): {
  opened: Opened;
  record: RecallRecordV2;
  keptNumbers: number;
} {
  const metrics = [
    {
      id: "m1",
      display_name: "Regular gasoline",
      unit: "USD per gallon",
      region: "U.S. city average",
      source: "U.S. EIA",
      series_id: "EMM_EPMR_PTE_NUS_DPG",
    },
  ];
  const recall_questions = rows.map((row, i) =>
    row.questionKind === "text"
      ? { id: `t${i}`, answer_type: "text", text: `Question ${i}` }
      : {
          id: `n${i}`,
          answer_type: "number",
          text: `Question ${i}`,
          metric_id: "m1",
        },
  );
  const answers = rows.map((row, i) => {
    const id = row.questionKind === "text" ? `t${i}` : `n${i}`;
    if (!row.answered) return { question_id: id, kind: "no_answer" as const };
    if (row.questionKind === "text") {
      return { question_id: id, kind: "text" as const, value: "Some words" };
    }
    return row.sample
      ? {
          question_id: id,
          kind: "number" as const,
          value: row.value,
          sample: true as const,
        }
      : { question_id: id, kind: "number" as const, value: row.value };
  });
  const keptNumbers = answers.filter(
    (answer) => answer.kind === "number" && "sample" in answer,
  ).length;
  const opened: Opened = {
    letterId: "abc123",
    header: {
      sealedAt: "2024-05-01T00:00:00.000Z",
      opensAt: "2024-06-01T00:00:00.000Z",
    },
    payload: {
      format_version: 1,
      metrics,
      recall_questions,
    } as unknown as PayloadV1,
    openingKey: {} as unknown as CryptoKey,
    envelopeHash:
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  };
  return {
    opened,
    record: { version: 2, answers } as unknown as RecallRecordV2,
    keptNumbers,
  };
}

describe("Property 17: The Sample_Label marks only Kept_Samples", () => {
  it("RememberedAnswers shows the label next to exactly the kept numbers", () => {
    fc.assert(
      fc.property(fc.array(ANSWER, { maxLength: 6 }), (rows) => {
        const { opened, record, keptNumbers } = scenario(rows);
        const markup = renderToStaticMarkup(
          createElement(RememberedAnswers, { opened, record }),
        );
        expect(labelCount(markup)).toBe(keptNumbers);
      }),
    );
  });

  it("ReceiptCard shows the label only when its answer is a Kept_Sample", () => {
    const card = (sample: boolean) =>
      renderToStaticMarkup(
        createElement(ReceiptCard, {
          name: "Regular gasoline",
          region: "U.S. city average",
          markValue: "3.59",
          sample,
          unit: "USD per gallon",
          then: {
            value: "3.59",
            unit: "USD per gallon",
            period: "Sep 2024",
            region: "U.S. city average",
            label: "historical record",
          },
          now: { message: null },
          source: { source: "U.S. EIA", seriesId: "EMM_EPMR_PTE_NUS_DPG" },
        }),
      );
    fc.assert(
      fc.property(fc.boolean(), (sample) => {
        expect(labelCount(card(sample))).toBe(sample ? 1 : 0);
      }),
    );
  });

  it("a kept sample renders the same elements and words as any other kept sample", () => {
    const kept = scenario([
      { questionKind: "number", answered: true, sample: true, value: "3.59" },
    ]);
    const keptTwo = scenario([
      { questionKind: "number", answered: true, sample: true, value: "1.20" },
    ]);
    const shape = (markup: string) => markup.replace(/[0-9]+\.[0-9]{2}/g, "N");
    expect(
      shape(
        renderToStaticMarkup(
          createElement(RememberedAnswers, {
            opened: kept.opened,
            record: kept.record,
          }),
        ),
      ),
    ).toBe(
      shape(
        renderToStaticMarkup(
          createElement(RememberedAnswers, {
            opened: keptTwo.opened,
            record: keptTwo.record,
          }),
        ),
      ),
    );
  });

  it("an answer without the flag gets no label", () => {
    const plain = scenario([
      { questionKind: "number", answered: true, sample: false, value: "3.59" },
    ]);
    const markup = renderToStaticMarkup(
      createElement(RememberedAnswers, {
        opened: plain.opened,
        record: plain.record,
      }),
    );
    expect(labelCount(markup)).toBe(0);
  });
});
