// Tests for pickSamples (spec 10 C5.4, C5.6; Property 16: the Sample_Pick
// always picks a stored candidate). The seed is injected, so every pick is
// fixed by the test.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { PayloadV1 } from "@/lib/seal-format";

import { pickSamples, type PickQuestion } from "./sample-pick";

const CANDIDATES = {
  "us-gasoline-regular": ["3.64", "3.59", "3.75", "2.99", "4.25"],
  "us-diesel": ["3.89", "3.79"],
  "no-questions-for-this": [],
};

const QUESTIONS: PickQuestion[] = [
  {
    id: "q-gas",
    answer_type: "number",
    text: "Gas then?",
    metric_id: "us-gasoline-regular",
  },
  { id: "q-text", answer_type: "text", text: "Anything else?" },
  {
    id: "q-diesel",
    answer_type: "number",
    text: "Diesel then?",
    metric_id: "us-diesel",
  },
  {
    id: "q-untracked",
    answer_type: "number",
    text: "Milk then?",
    metric_id: "eu-milk",
  },
  {
    id: "q-empty",
    answer_type: "number",
    text: "Empty?",
    metric_id: "no-questions-for-this",
  },
];

describe("pickSamples", () => {
  it("picks one candidate for each number question that has candidates", () => {
    const picked = pickSamples(CANDIDATES, QUESTIONS, 12345);
    expect(Object.keys(picked).sort()).toEqual(["q-diesel", "q-gas"]);
    expect(CANDIDATES["us-gasoline-regular"]).toContain(picked["q-gas"]);
    expect(CANDIDATES["us-diesel"]).toContain(picked["q-diesel"]);
  });

  it("gives the same pick for the same seed and inputs", () => {
    expect(pickSamples(CANDIDATES, QUESTIONS, 987)).toEqual(
      pickSamples(CANDIDATES, QUESTIONS, 987),
    );
  });

  it("gives nothing for a text question, an untracked metric or an empty list", () => {
    const picked = pickSamples(CANDIDATES, QUESTIONS, 42);
    expect(picked).not.toHaveProperty("q-text");
    expect(picked).not.toHaveProperty("q-untracked");
    expect(picked).not.toHaveProperty("q-empty");
  });

  it("returns an empty map when there are no candidates", () => {
    expect(pickSamples({}, QUESTIONS, 1)).toEqual({});
  });

  it("does not mutate the candidate lists", () => {
    const before = JSON.stringify(CANDIDATES);
    pickSamples(CANDIDATES, QUESTIONS, 7);
    expect(JSON.stringify(CANDIDATES)).toBe(before);
  });

  it("reaches every candidate in a list across seeds, so the pick is not fixed", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 500; seed += 1) {
      const picked = pickSamples(
        { "us-gasoline-regular": CANDIDATES["us-gasoline-regular"] },
        [QUESTIONS[0] as PayloadV1["recall_questions"][number]],
        seed,
      );
      seen.add(picked["q-gas"] ?? "");
    }
    expect(seen.size).toBe(CANDIDATES["us-gasoline-regular"].length);
  });

  // Property 16: for any 32-bit seed, every pick is a stored candidate, and
  // nothing is picked for a question that has no candidates.
  it("always picks a stored candidate (Property 16)", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 0xffffffff }), (seed) => {
        const picked = pickSamples(CANDIDATES, QUESTIONS, seed);
        for (const [questionId, value] of Object.entries(picked)) {
          const question = QUESTIONS.find((q) => q.id === questionId);
          expect(question?.answer_type).toBe("number");
          const metricId =
            question?.answer_type === "number" ? question.metric_id : "";
          expect(CANDIDATES[metricId as keyof typeof CANDIDATES]).toContain(
            value,
          );
        }
        expect(Object.keys(picked).sort()).toEqual(["q-diesel", "q-gas"]);
      }),
      { numRuns: 200 },
    );
  });
});
