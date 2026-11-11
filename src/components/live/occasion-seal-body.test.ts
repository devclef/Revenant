import { describe, expect, it } from "vitest";

import { questionsForSeal } from "./author-questions";
import { buildLivePayload } from "./build-payload";
import { LIVE_COPY } from "./copy";
import { applyOccasion, OCCASIONS, type OccasionDraft } from "./occasions";
import { makeFigures } from "./test-figures";
import {
  initialWriteDraft,
  reduceWriteDraft,
  type WriteDraft,
} from "./write-draft";

// Spec 11, L2.5: the Occasion choice is memory only. Seal request bodies and the
// payload carry the resulting text and rows and nothing that names an Occasion.

const SEALED_DATE = "2026-11-11";
const SEALED_AT = "2026-11-11T09:00:00.000Z";
const NO_FIGURES = makeFigures([]);

function seal(text: string, questions: readonly string[]) {
  return buildLivePayload({
    text,
    metricIds: [],
    authorQuestions: questionsForSeal(questions),
    sealedDate: SEALED_DATE,
    figures: NO_FIGURES,
    sealedAt: SEALED_AT,
  });
}

describe("seal request bodies carry no Occasion identifier (spec 11, L2.5)", () => {
  for (const occasion of OCCASIONS) {
    it(`builds the same body for ${occasion.label} as for its text and rows alone`, () => {
      const start: OccasionDraft = {
        text: "A letter I wrote myself.",
        questions: [LIVE_COPY.livePrefill],
        occasion: "blank",
        appliedStarter: "",
        appliedQuestions: [LIVE_COPY.livePrefill],
      };
      const next = applyOccasion(start, occasion.id);
      const body = seal(next.text, next.questions);
      const json = JSON.stringify(body);

      expect(json).not.toContain('"occasion"');
      expect(json).not.toContain('"occasion_id"');
      expect(json).toBe(JSON.stringify(seal(next.text, next.questions)));
    });
  }
});

describe("the Write draft holds no Occasion (spec 11, L2.5)", () => {
  it("starts with no Occasion key", () => {
    const draft: WriteDraft = initialWriteDraft("demo");
    expect(Object.keys(draft)).not.toContain("occasion");
    expect(Object.keys(draft)).not.toContain("appliedStarter");
    expect(Object.keys(draft)).not.toContain("appliedQuestions");
  });

  it("takes the text and rows from OCCASION_APPLIED and adds no Occasion key", () => {
    const before = initialWriteDraft("demo");
    const after = reduceWriteDraft(before, {
      type: "OCCASION_APPLIED",
      text: "A starter sentence.",
      questions: ["Before you read it, what do you remember writing?"],
    });
    expect(after.text).toBe("A starter sentence.");
    expect(after.questions).toEqual([
      "Before you read it, what do you remember writing?",
    ]);
    expect(Object.keys(after)).not.toContain("occasion");
    expect(after.metricIds).toBe(before.metricIds);
  });
});
