import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { reduce, type FlowState, type Opened } from "./opening-machine";
import { RememberedAnswers } from "./RememberedAnswers";
import { REVEAL_COPY } from "./copy";
import { buildRecallRecord } from "@/lib/recall";

/**
 * The marks stage (stage 1 of the reveal) shows each recall answer exactly as
 * the judge typed it. This drives the real path: the typed text goes through
 * the Opening_Flow reducer (EDIT_DRAFT), is assembled by buildRecallRecord, and
 * is rendered by RememberedAnswers. The diesel and gasoline answers are checked
 * separately and in both typing orders, so a value cannot land on the wrong
 * question or be changed on the way.
 */

const OPENED = {
  letterId: "letter-echo",
  header: {
    sealedAt: "2024-05-12T00:00:00.000Z",
    opensAt: "2024-11-05T00:00:00.000Z",
  },
  openingKey: {},
  payload: {
    format_version: 1,
    letter_text: "A letter body.",
    written_as_of: "2024-05-12",
    metrics: [
      {
        id: "us-gasoline-regular",
        display_name: "Regular gasoline",
        unit: "USD per gallon",
        region: "U.S.",
        source: "U.S. EIA",
        series_id: "EMM_EPMR_PTE_NUS_DPG",
      },
      {
        id: "us-diesel",
        display_name: "Diesel",
        unit: "USD per gallon",
        region: "U.S.",
        source: "U.S. EIA",
        series_id: "EMD_EPD2D_PTE_NUS_DPG",
      },
    ],
    figures: [],
    recall_questions: [
      {
        id: "q1",
        answer_type: "number",
        metric_id: "us-gasoline-regular",
        text: "What do you think a gallon of regular gasoline cost then?",
      },
      {
        id: "q2",
        answer_type: "number",
        metric_id: "us-diesel",
        text: "What do you think a gallon of diesel cost then?",
      },
    ],
  },
} as unknown as Opened;

/** Type `text` into the question `id` through the reducer, then build the record. */
function typeAnswers(entries: ReadonlyArray<readonly [string, string]>) {
  let state: FlowState = { tag: "verified", opened: OPENED };
  state = reduce(state, { type: "BEGIN" });
  for (const [id, text] of entries) {
    state = reduce(state, { type: "EDIT_DRAFT", id, text });
  }
  // Any question not typed in this case is marked "no answer", so the record is
  // complete and only the typed answers are under test.
  for (const question of OPENED.payload.recall_questions) {
    if (!entries.some(([id]) => id === question.id)) {
      state = reduce(state, {
        type: "TOGGLE_NO_ANSWER",
        id: question.id,
        noAnswer: true,
      });
    }
  }
  if (state.tag !== "recall") throw new Error("expected the recall state");
  const built = buildRecallRecord(OPENED.payload.recall_questions, state.drafts);
  if (!built.ok) throw new Error(`record invalid: ${built.invalid.join(",")}`);
  return built.record;
}

/** Render the marks stage for a record. */
function renderMarks(record: ReturnType<typeof typeAnswers>): string {
  return renderToStaticMarkup(
    createElement(RememberedAnswers, { opened: OPENED, record }),
  );
}

/** The exact text a judge should see for a typed value. */
function answerLine(value: string): string {
  return `${REVEAL_COPY.yourAnswer}: ${value}`;
}

describe("marks stage echoes the typed recall answer", () => {
  it("shows a typed diesel answer of 4.00 as 4.00, not 3.90", () => {
    const html = renderMarks(typeAnswers([["q2", "4.00"]]));
    expect(html).toContain(answerLine("4.00"));
    expect(html).not.toContain("3.90");
  });

  it("shows a typed gasoline answer of 3.50 as 3.50", () => {
    const html = renderMarks(typeAnswers([["q1", "3.50"]]));
    expect(html).toContain(answerLine("3.50"));
  });

  it("keeps both answers on their own questions when both are typed", () => {
    const html = renderMarks(
      typeAnswers([
        ["q1", "3.50"],
        ["q2", "4.00"],
      ]),
    );
    expect(html).toContain(answerLine("3.50"));
    expect(html).toContain(answerLine("4.00"));
  });

  it("keeps both answers when the diesel answer is typed first", () => {
    const html = renderMarks(
      typeAnswers([
        ["q2", "4.00"],
        ["q1", "3.50"],
      ]),
    );
    expect(html).toContain(answerLine("4.00"));
    expect(html).toContain(answerLine("3.50"));
  });

  it("keeps the typed text exactly, including trailing zeros", () => {
    const record = typeAnswers([
      ["q1", "3.50"],
      ["q2", "4.00"],
    ]);
    const byId = new Map(record.answers.map((a) => [a.question_id, a]));
    expect(byId.get("q2")).toEqual({
      question_id: "q2",
      kind: "number",
      value: "4.00",
    });
    expect(byId.get("q1")).toEqual({
      question_id: "q1",
      kind: "number",
      value: "3.50",
    });
  });
});
