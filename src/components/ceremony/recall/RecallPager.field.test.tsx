// Feature: 08-judge-polish, task 2 (issue #190): the recall number field and the
// unit helper line in the Recall_Pager (R32.4, R32.7, R32.8, R32.13, R7.8).
//
// The pager is rendered to static markup, so these tests read the first paint:
// the parsed value, the two readings, the unreadable message and the disabled
// Next control. The state changes (typing, picking) are covered by the field
// tests in recall-field.test.ts.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { CEREMONY_COPY } from "../copy";
import { RecallPager, type RecallPagerProps } from "./RecallPager";
import type { PayloadV1 } from "@/lib/seal-format";

type Payload = Pick<PayloadV1, "metrics" | "recall_questions">;

function payloadFor(unit: string): Payload {
  return {
    metrics: [{ id: "m1", unit } as unknown as PayloadV1["metrics"][number]],
    recall_questions: [
      {
        id: "q1",
        text: "What do you think it cost then?",
        answer_type: "number",
        metric_id: "m1",
      } as unknown as PayloadV1["recall_questions"][number],
    ],
  };
}

function render(
  text: string,
  unit = "USD per gallon",
  overrides: Partial<RecallPagerProps> = {},
): string {
  const props: RecallPagerProps = {
    payload: payloadFor(unit),
    drafts: { q1: { text, noAnswer: false } },
    invalid: [],
    submitting: false,
    onEdit: () => undefined,
    onToggleNoAnswer: () => undefined,
    onSubmit: () => undefined,
    ...overrides,
  };
  return renderToStaticMarkup(<RecallPager {...props} />);
}

/** The opening tag of the Next or submit control. */
function nextButton(markup: string): string {
  const match = /<button[^>]*type="submit"[^>]*>/.exec(markup);
  return match?.[0] ?? "";
}

describe("the parsed value (R32.8)", () => {
  it("shows Read as with the number, grouped in threes", () => {
    const markup = render("1585.76");
    expect(markup).toContain(CEREMONY_COPY.parsedValue.replace("{value}", "1,585.76"));
    expect(markup).toContain('aria-describedby="');
  });

  it("is linked from the field by aria-describedby", () => {
    const markup = render("1585.76");
    expect(markup).toMatch(/aria-describedby="[^"]*recall-q1-parsed/);
  });

  it("shows no parsed value for an empty field (R32.13)", () => {
    const markup = render("");
    expect(markup).not.toContain("Read as");
    expect(markup).not.toContain(CEREMONY_COPY.numberUnreadable);
  });
});

describe("the next control waits for a reading (R32.5, R32.13)", () => {
  it("is enabled once the field resolves to a value", () => {
    expect(nextButton(render("1585.76"))).not.toContain("disabled");
  });

  it("is disabled for an empty field", () => {
    expect(nextButton(render(""))).toContain("disabled");
  });

  it("is disabled for an ambiguous field until a reading is picked", () => {
    expect(nextButton(render("1.585"))).toContain("disabled");
  });

  it("is enabled for an empty field when no answer is ticked", () => {
    const markup = render("", "USD per gallon", {
      drafts: { q1: { text: "", noAnswer: true } },
    });
    expect(nextButton(markup)).not.toContain("disabled");
  });
});

describe("the two readings of an Ambiguous_Input (R32.4)", () => {
  it("offers the decimal reading first, neither checked, in words", () => {
    const markup = render("1.585");
    expect(markup).toContain(CEREMONY_COPY.readingLegend);
    const decimal = markup.indexOf("1 point 585");
    const grouping = markup.indexOf("1 thousand 585");
    expect(decimal).toBeGreaterThan(-1);
    expect(grouping).toBeGreaterThan(decimal);
    expect(markup).not.toMatch(/type="radio"[^>]*checked/);
  });

  it("writes the grouping reading of a 000 tail as just the thousands (R32.4)", () => {
    const markup = render("3,000");
    expect(markup).toContain("3 point 000");
    expect(markup).toContain(">3 thousand<");
  });

  it("links the group from the field by aria-describedby", () => {
    expect(render("1.585")).toMatch(/aria-describedby="[^"]*recall-q1-readings/);
  });
});

describe("the unreadable message (R32.7)", () => {
  it("shows the fixed example and keeps the field invalid", () => {
    const markup = render("12a");
    expect(markup).toContain(CEREMONY_COPY.numberUnreadable);
    expect(markup).toContain('aria-invalid="true"');
  });

  it("keeps the next control disabled for an unreadable field", () => {
    expect(nextButton(render("12a"))).toContain("disabled");
  });
});

describe("the Unit_Helper_Line on a euro-per-litre block (R7.8)", () => {
  it("shows the helper under the unit label, linked by aria-describedby", () => {
    const markup = render("1200", "EUR per 1,000 litres");
    expect(markup).toContain(CEREMONY_COPY.unitHelperEurPer1000L);
    expect(markup).toMatch(/aria-describedby="[^"]*recall-q1-unit-help/);
  });

  it("shows no helper line for a USD block", () => {
    const markup = render("3.47", "USD per gallon");
    expect(markup).not.toContain(CEREMONY_COPY.unitHelperEurPer1000L);
  });
});
