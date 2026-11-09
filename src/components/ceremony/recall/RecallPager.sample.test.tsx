// Feature: 10-own-questions, C5.5 (Sample_Note on the Testify field).
//
// The Sample_Note shows under a number field only while the field's draft still
// equals its Sample_Answer. Any other text, "No answer", or no sample at all
// hides it. Rendered with renderToStaticMarkup, no DOM library.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { REVEAL_COPY } from "@/components/reveal/copy";
import type { Draft } from "@/lib/recall";
import type { PayloadV1 } from "@/lib/seal-format";

import { RecallPager } from "./RecallPager";

type Payload = Pick<PayloadV1, "metrics" | "recall_questions">;

const PAYLOAD = {
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
  recall_questions: [
    {
      id: "q1",
      answer_type: "number",
      text: "What did a gallon of gas cost?",
      metric_id: "fuel",
    },
  ],
} as unknown as Payload;

function render(
  drafts: Record<string, Draft>,
  samples?: Readonly<Record<string, string>>,
): string {
  return renderToStaticMarkup(
    createElement(RecallPager, {
      payload: PAYLOAD,
      drafts,
      invalid: [],
      submitting: false,
      onEdit: () => {},
      onToggleNoAnswer: () => {},
      onSubmit: () => {},
      samples,
    }),
  );
}

describe("RecallPager Sample_Note (C5.5)", () => {
  it("shows the exact Sample_Note while the field holds its Sample_Answer", () => {
    const markup = render(
      { q1: { text: "3.59", noAnswer: false } },
      { q1: "3.59" },
    );
    expect(markup).toContain(REVEAL_COPY.sampleNote);
    expect(REVEAL_COPY.sampleNote).toBe(
      "A sample answer is filled in. Change it if you remember differently.",
    );
  });

  it("hides the Sample_Note once the judge changes the text", () => {
    const markup = render(
      { q1: { text: "3.6", noAnswer: false } },
      { q1: "3.59" },
    );
    expect(markup).not.toContain(REVEAL_COPY.sampleNote);
  });

  it("hides the Sample_Note when the judge ticks No answer", () => {
    const markup = render(
      { q1: { text: "3.59", noAnswer: true } },
      { q1: "3.59" },
    );
    expect(markup).not.toContain(REVEAL_COPY.sampleNote);
  });

  it("shows nothing when the question has no sample (live letters)", () => {
    const markup = render({ q1: { text: "3.59", noAnswer: false } });
    expect(markup).not.toContain(REVEAL_COPY.sampleNote);
  });

  it("never shows the Sample_Label on the Testify field", () => {
    const markup = render(
      { q1: { text: "3.59", noAnswer: false } },
      { q1: "3.59" },
    );
    expect(markup).not.toContain(REVEAL_COPY.sampleLabel);
  });
});
