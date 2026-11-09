// Kept_Sample chain, from the offered sample to the reveal (spec 10 C5.8, G1.8).
//
// A judge who submits the Sample_Answer exactly keeps it: the record stores
// `sample: true`, and the Sample_Label appears in "Your testimony" and on the
// Receipt_Card, and nowhere else. These tests build the record with the real
// buildRecallRecordV2 and render the reveal components from it.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { REVEAL_COPY } from "./copy";
import { FiguresThenNow } from "./FiguresThenNow";
import { RememberedAnswers } from "./RememberedAnswers";
import type { Opened } from "./opening-machine";
import { buildRecallRecordV2 } from "@/lib/recall/record-v2";
import type { Draft } from "@/lib/recall/record";
import type { PayloadV1 } from "@/lib/seal-format";

const LABEL = REVEAL_COPY.sampleLabel;

function labelCount(markup: string): number {
  return markup.split(LABEL).length - 1;
}

const QUESTION_ID = "q-diesel";

// Maya's diesel question, as the sealed payload holds it.
const OPENED: Opened = {
  letterId: "maya-letter",
  header: {
    sealedAt: "2024-05-01T00:00:00.000Z",
    opensAt: "2024-06-01T00:00:00.000Z",
  },
  openingKey: {} as unknown as CryptoKey,
  envelopeHash:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  payload: {
    format_version: 1,
    letter_text: "Letter text that is not compared here.",
    metrics: [
      {
        id: "us-diesel",
        display_name: "Diesel",
        unit: "USD per gallon",
        region: "U.S. city average",
        source: "U.S. EIA",
        series_id: "FIXTURE-us-diesel",
      },
    ],
    figures: [
      {
        metric_id: "us-diesel",
        value: "3.89",
        unit: "USD per gallon",
        region: "U.S. city average",
        period: "2024-05",
        source: "U.S. EIA",
        series_id: "FIXTURE-us-diesel",
        source_url: "https://www.eia.gov/",
        retrieved_at: "2024-05-02T00:00:00.000Z",
      },
    ],
    recall_questions: [
      {
        id: QUESTION_ID,
        answer_type: "number",
        text: "What do you think a gallon of diesel cost then?",
        metric_id: "us-diesel",
      },
    ],
  } as unknown as PayloadV1,
};

const SAMPLES = { [QUESTION_ID]: "4.59" };
const QUESTIONS = [{ id: QUESTION_ID, answer_type: "number" as const }];

/** The record the reveal reads, built from the judge's draft. */
function recordFor(draft: Draft) {
  const built = buildRecallRecordV2(
    QUESTIONS,
    { [QUESTION_ID]: draft },
    SAMPLES,
  );
  if (!built.ok)
    throw new Error(`test setup: build failed for ${built.invalid}`);
  return built.record;
}

function renderRemembered(record: ReturnType<typeof recordFor>): string {
  return renderToStaticMarkup(
    createElement(RememberedAnswers, { opened: OPENED, record }),
  );
}

function renderFigures(record: ReturnType<typeof recordFor>): string {
  // A failed figures request leaves every Receipt_Card on the no-now branch.
  return renderToStaticMarkup(
    createElement(FiguresThenNow, {
      opened: OPENED,
      record,
      figures: { status: "failed" },
    }),
  );
}

describe("Kept_Sample reaches the reveal (C5.8, G1.8)", () => {
  it("an exact sample submission shows the label in Your testimony", () => {
    const record = recordFor({ text: "4.59", noAnswer: false });
    expect(labelCount(renderRemembered(record))).toBe(1);
  });

  it("an exact sample submission shows the label on its Receipt_Card", () => {
    const record = recordFor({ text: "4.59", noAnswer: false });
    const markup = renderFigures(record);
    expect(labelCount(markup)).toBe(1);
    expect(markup).toContain('data-your-answer=""');
    expect(markup.indexOf(LABEL)).toBeGreaterThan(
      markup.indexOf("data-your-answer"),
    );
  });

  it("a padded draft that equals the sample after trimming gets no label", () => {
    const record = recordFor({ text: " 4.59 ", noAnswer: false });
    expect(labelCount(renderRemembered(record))).toBe(0);
    expect(labelCount(renderFigures(record))).toBe(0);
  });

  it("a typed answer that differs from the sample gets no label", () => {
    const record = recordFor({ text: "4.50", noAnswer: false });
    expect(labelCount(renderRemembered(record))).toBe(0);
    expect(labelCount(renderFigures(record))).toBe(0);
  });
});
