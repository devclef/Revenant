// Feature: 08-judge-polish (A13.1, A13.2, A13.3)
//
// The recall field is named by its question heading (aria-labelledby) and keeps
// its unit and helper text in aria-describedby. These tests render every
// question of both persona letters, built the same way the sealing script builds
// them: the real catalogue metrics and each persona's recall subjects, passed to
// generateRecallQuestions. Each question is rendered on its own.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CATALOGUE } from "@/lib/figures";
import { PERSONAS } from "@/lib/personas";
import { generateRecallQuestions } from "@/lib/recall";
import type { MetricDefinitionV1, PayloadV1 } from "@/lib/seal-format";

import { RecallPager } from "./RecallPager";

type Payload = Pick<PayloadV1, "metrics" | "recall_questions">;

/** The sealed-shape payload for one persona, from its real metrics and subjects. */
function personaPayload(key: string): {
  payload: Payload;
  writtenAsOf: string;
  metricCount: number;
} {
  const persona = PERSONAS.find((p) => p.key === key);
  if (persona === undefined) throw new Error(`no persona ${key}`);

  const metrics: MetricDefinitionV1[] = persona.metrics.map((m) => {
    const series = CATALOGUE.find((s) => s.metric.id === m.metric_id);
    if (series === undefined) throw new Error(`no series ${m.metric_id}`);
    return series.metric as MetricDefinitionV1;
  });

  const recall_questions = generateRecallQuestions(
    persona.metrics.map((m, i) => ({
      metric: metrics[i],
      recall_subject: m.recall_subject,
    })),
  );

  return {
    payload: {
      metrics,
      recall_questions,
    } as unknown as Payload,
    writtenAsOf: persona.written_as_of,
    metricCount: persona.metrics.length,
  };
}

/** The first paint of the pager, showing the question at `index`. */
function renderQuestion(
  payload: Payload,
  writtenAsOf: string,
  index: number,
): string {
  return renderToStaticMarkup(
    createElement(RecallPager, {
      payload,
      drafts: {},
      invalid: [],
      submitting: false,
      writtenAsOf,
      initialIndex: index,
      onEdit: () => undefined,
      onToggleNoAnswer: () => undefined,
      onSubmit: () => undefined,
    }),
  );
}

/** The opening tag of the recall input for one field ID, or "" when absent. */
function inputTag(markup: string, id: string): string {
  const match = new RegExp(`<input[^>]*id="${id}"[^>]*>`).exec(markup);
  return match?.[0] ?? "";
}

/** The value of one attribute in a tag, or null when the attribute is absent. */
function attr(tag: string, name: string): string | null {
  const match = new RegExp(` ${name}="([^"]*)"`).exec(tag);
  return match === null ? null : match[1];
}

describe.each(["us-maya", "eu-tomas"])(
  "recall field labelling for persona %s",
  (key) => {
    const { payload, writtenAsOf, metricCount } = personaPayload(key);

    it("has one question for every recall subject of the letter", () => {
      expect(payload.recall_questions).toHaveLength(metricCount);
    });

    payload.recall_questions.forEach((question, i) => {
      const n = i + 1;
      const fieldId = `recall-q${n}`;
      const headingId = `recall-q${n}-title`;
      const markup = renderQuestion(payload, writtenAsOf, i);
      const tag = inputTag(markup, fieldId);

      describe(`question ${n}`, () => {
        it("is named by its question heading (A13.1)", () => {
          expect(tag).not.toBe("");
          expect(attr(tag, "aria-labelledby")).toBe(headingId);
        });

        it("the heading it names shows the sealed question text", () => {
          const heading = new RegExp(
            `<h2[^>]*id="${headingId}"[^>]*>(.*?)</h2>`,
          ).exec(markup);
          expect(heading).not.toBeNull();
          // The sealed text sits in a data-user-content span, so it renders as sealed.
          const wrapped = /^<span data-user-content="">(.*)<\/span>$/.exec(
            heading![1],
          );
          expect(wrapped).not.toBeNull();
          const shown = wrapped![1].replace(/&#x27;/g, "'");
          expect(shown).toBe(question.text);
        });

        it("keeps its unit linked by aria-describedby (A13.2)", () => {
          expect(attr(tag, "aria-describedby") ?? "").toContain(
            `recall-q${n}-unit`,
          );
        });
      });
    });
  },
);
