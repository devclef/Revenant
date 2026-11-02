import { describe, expect, it } from "vitest";

import { CATALOGUE } from "@/lib/figures";
import { checkRecallSubject } from "@/lib/recall";

import { RECALL_SUBJECTS } from "./recall-subjects";

describe("RECALL_SUBJECTS", () => {
  // Every catalogue metric is listable on the Seal_Page, so each needs a
  // subject that checkRecallSubject accepts (R14.2, R14.3).
  for (const series of CATALOGUE) {
    const id = series.metric.id;

    it(`has a subject that passes checkRecallSubject for ${id}`, () => {
      const subject = RECALL_SUBJECTS[id];
      expect(subject, `missing subject for ${id}`).toBeTypeOf("string");
      expect(checkRecallSubject(subject ?? "", series.metric)).toBeNull();
    });
  }
});
