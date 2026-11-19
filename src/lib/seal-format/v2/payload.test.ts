import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parsePayload, parseEnvelope } from "../registry";
import { payloadV2Schema, sealedAnswerOf } from "./payload";
import { sealedAnswerOf as sealedAnswerOfFromBarrel } from "../index";
import { headerV2Schema } from "./header";

const here = dirname(fileURLToPath(import.meta.url));

// A minimal valid v2 payload: one number question (no answer) and one text
// question carrying its sealed answer.
const validPayloadV2 = {
  format_version: 2,
  letter_text: "A letter to my future self.",
  metrics: [
    {
      id: "fuel-us",
      display_name: "Regular gasoline",
      unit: "USD per gallon",
      region: "U.S. city average",
      source: "U.S. EIA",
      series_id: "EMM_EPMR_PTE_NUS_DPG",
    },
  ],
  figures: [],
  recall_questions: [
    {
      id: "q1",
      answer_type: "number",
      text: "What do you think a gallon of gas cost then?",
      metric_id: "fuel-us",
    },
    {
      id: "q2",
      answer_type: "text",
      text: "How did that autumn feel?",
      sealed_answer: "Quiet, and busy with the harvest.",
    },
  ],
};

function withSealedAnswer(answer: unknown) {
  return {
    ...validPayloadV2,
    recall_questions: [
      validPayloadV2.recall_questions[0],
      { ...validPayloadV2.recall_questions[1], sealed_answer: answer },
    ],
  };
}

describe("payloadV2Schema", () => {
  it("accepts a valid v2 payload with a sealed answer on each text question", () => {
    expect(payloadV2Schema.safeParse(validPayloadV2).success).toBe(true);
  });

  it("rejects a text question without sealed_answer, and names its path", () => {
    const question: Record<string, unknown> = {
      ...validPayloadV2.recall_questions[1],
    };
    delete question.sealed_answer;
    const bad = {
      ...validPayloadV2,
      recall_questions: [validPayloadV2.recall_questions[0], question],
    };
    const result = payloadV2Schema.safeParse(bad);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toEqual([
        "recall_questions",
        1,
        "sealed_answer",
      ]);
    }
  });

  it("rejects a blank or whitespace-only sealed_answer", () => {
    expect(payloadV2Schema.safeParse(withSealedAnswer("")).success).toBe(false);
    expect(payloadV2Schema.safeParse(withSealedAnswer("   ")).success).toBe(
      false,
    );
  });

  it("accepts a sealed_answer of exactly 1,000 code points and rejects 1,001", () => {
    expect(
      payloadV2Schema.safeParse(withSealedAnswer("a".repeat(1000))).success,
    ).toBe(true);
    expect(
      payloadV2Schema.safeParse(withSealedAnswer("a".repeat(1001))).success,
    ).toBe(false);
  });

  it("counts astral characters once in sealed_answer", () => {
    // 1,000 emoji are 2,000 UTF-16 units but 1,000 code points: still valid.
    expect(
      payloadV2Schema.safeParse(withSealedAnswer("\u{1F56F}".repeat(1000)))
        .success,
    ).toBe(true);
  });

  it("rejects an extra field on a text question (strict object)", () => {
    const bad = withSealedAnswer("ok") as Record<string, unknown>;
    const questions = bad.recall_questions as Record<string, unknown>[];
    questions[1] = { ...questions[1], extra: true };
    expect(payloadV2Schema.safeParse(bad).success).toBe(false);
  });

  it("rejects format_version 1", () => {
    expect(
      payloadV2Schema.safeParse({ ...validPayloadV2, format_version: 1 })
        .success,
    ).toBe(false);
  });
});

describe("headerV2Schema", () => {
  it("accepts the version 1 golden header with formatVersion set to 2", () => {
    const golden = JSON.parse(
      readFileSync(
        join(here, "..", "__fixtures__", "golden-v1-envelope.json"),
        "utf8",
      ),
    ) as Record<string, unknown>;
    expect(
      headerV2Schema.safeParse({ ...golden, formatVersion: 2 }).success,
    ).toBe(true);
  });

  it("rejects formatVersion 1", () => {
    const golden = JSON.parse(
      readFileSync(
        join(here, "..", "__fixtures__", "golden-v1-envelope.json"),
        "utf8",
      ),
    ) as Record<string, unknown>;
    expect(headerV2Schema.safeParse(golden).success).toBe(false);
  });
});

describe("registry routes version 2", () => {
  it("parsePayload selects the v2 schema by format_version", () => {
    const result = parsePayload(validPayloadV2);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.format_version).toBe(2);
  });

  it("parsePayload reports the path of a v2 text question without sealed_answer", () => {
    const question: Record<string, unknown> = {
      ...validPayloadV2.recall_questions[1],
    };
    delete question.sealed_answer;
    const result = parsePayload({
      ...validPayloadV2,
      recall_questions: [validPayloadV2.recall_questions[0], question],
    });
    expect(result).toEqual({
      ok: false,
      error: "invalid",
      field: "recall_questions.1.sealed_answer",
    });
  });

  it("parseEnvelope selects the v2 header by formatVersion", () => {
    const golden = JSON.parse(
      readFileSync(
        join(here, "..", "__fixtures__", "golden-v1-envelope.json"),
        "utf8",
      ),
    ) as Record<string, unknown>;
    const result = parseEnvelope({ ...golden, formatVersion: 2 });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.formatVersion).toBe(2);
  });
});

describe("sealedAnswerOf", () => {
  it("returns the sealed_answer of a text question", () => {
    const text = validPayloadV2.recall_questions[1];
    expect(sealedAnswerOf(text as Parameters<typeof sealedAnswerOf>[0])).toBe(
      "Quiet, and busy with the harvest.",
    );
  });

  it("returns undefined for a number question, which carries no answer", () => {
    const number = validPayloadV2.recall_questions[0];
    expect(sealedAnswerOf(number as Parameters<typeof sealedAnswerOf>[0])).toBe(
      undefined,
    );
  });

  it("is exported from the seal-format barrel", () => {
    expect(sealedAnswerOfFromBarrel).toBe(sealedAnswerOf);
  });
});

describe("Property 3: a text question without sealed_answer is rejected", () => {
  it("rejects a parsed v2 payload whose text question has no sealed_answer, for any answer-less text question", () => {
    const base = validPayloadV2.recall_questions[1];
    for (const text of [
      base.text,
      "What did you do that week?",
      "Who was there?",
    ]) {
      const question: Record<string, unknown> = { ...base, text };
      delete question.sealed_answer;
      const result = parsePayload({
        ...validPayloadV2,
        recall_questions: [validPayloadV2.recall_questions[0], question],
      });
      expect(result).toEqual({
        ok: false,
        error: "invalid",
        field: "recall_questions.1.sealed_answer",
      });
    }
  });

  it("accepts the same text question once it carries a sealed_answer", () => {
    const result = parsePayload(validPayloadV2);
    expect(result.ok).toBe(true);
  });
});
