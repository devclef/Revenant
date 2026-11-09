import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RecallPager, type RecallPagerProps } from "./RecallPager";
import type { PayloadV1 } from "@/lib/seal-format";

/**
 * The Testify order for a Live_Letter (spec 10 C9.2): the Author_Questions come
 * first, then the Figure_Questions. The pager starts on index 0, so the first
 * question it shows must be the first sealed Author_Question.
 */

const OWN_QUESTION = "Who did you call first that week?";
const FIGURE_QUESTION = "What did a gallon of gas cost then?";

const payload = {
  metrics: [
    {
      id: "m1",
      unit: "USD per gallon",
    } as unknown as PayloadV1["metrics"][number],
  ],
  recall_questions: [
    { id: "a1", answer_type: "text", text: OWN_QUESTION },
    { id: "q1", answer_type: "number", metric_id: "m1", text: FIGURE_QUESTION },
  ] as unknown as PayloadV1["recall_questions"],
} satisfies Pick<PayloadV1, "metrics" | "recall_questions">;

function render(extra: Partial<RecallPagerProps> = {}): string {
  const props: RecallPagerProps = {
    payload,
    drafts: {},
    invalid: [],
    submitting: false,
    onEdit: () => undefined,
    onToggleNoAnswer: () => undefined,
    onSubmit: () => undefined,
    ...extra,
  };
  return renderToStaticMarkup(createElement(RecallPager, props));
}

describe("Live_Letter Testify order (spec 10 C9.2)", () => {
  it("asks the Author_Question first, not the figure question", () => {
    const markup = render();
    expect(markup).toContain(OWN_QUESTION);
    expect(markup).not.toContain(FIGURE_QUESTION);
  });
});
