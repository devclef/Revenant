// Feature: 09-demo-polish, C2 (field group), L2.1 and L3.1 (recall title font and
// Retired_Tokens), P8.4 (44 x 44 targets at the Phone_Sizes), P9 (keyboard).
// The pager renders to static markup. The keyboard hook is covered in
// src/components/ui/use-keep-in-visual-viewport.test.ts.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RecallPager, type RecallPagerProps } from "./RecallPager";
import type { PayloadV1 } from "@/lib/seal-format";

type Payload = Pick<PayloadV1, "metrics" | "recall_questions">;

function payload(questionCount: number): Payload {
  const questions = Array.from({ length: questionCount }, (_, index) => ({
    id: `q${index + 1}`,
    text: `Question ${index + 1}`,
    answer_type: "number",
    metric_id: "m1",
  }));
  return {
    metrics: [{ id: "m1", unit: "USD per gallon" } as unknown as PayloadV1["metrics"][number]],
    recall_questions: questions as unknown as PayloadV1["recall_questions"],
  };
}

function render(questionCount = 1, overrides: Partial<RecallPagerProps> = {}): string {
  const props: RecallPagerProps = {
    payload: payload(questionCount),
    drafts: {},
    invalid: [],
    submitting: false,
    onEdit: () => undefined,
    onToggleNoAnswer: () => undefined,
    onSubmit: () => undefined,
    ...overrides,
  };
  return renderToStaticMarkup(createElement(RecallPager, props));
}

/** The body of the first rule for a selector in the pager's stylesheet. */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(css);
  return match?.[1] ?? "";
}

const css = readFileSync(
  join(process.cwd(), "src/components/ceremony/recall/RecallPager.module.css"),
  "utf8",
);

describe("the field group carries data-primary-control (C2, P4.1)", () => {
  it("puts data-primary-control on the field and Next row of the shown question", () => {
    const markup = render(1);
    const row = /<div[^>]*data-fit="answer"[^>]*>/.exec(markup)?.[0] ?? "";
    expect(row).toContain('data-primary-control=""');
    expect(markup.match(/data-primary-control/g)).toHaveLength(1);
  });

  it("keeps the field and its submit control inside that group", () => {
    const markup = render(1);
    const start = markup.indexOf('data-primary-control=""');
    const group = markup.slice(start, start + 1200);
    expect(start).toBeGreaterThan(-1);
    expect(group).toContain('type="text"');
    expect(group).toMatch(/type="submit"/);
  });
});

describe("the recall question title and Retired_Tokens (L2.1, L3.1)", () => {
  it("sets the question title in the sans at weight 800, not the serif", () => {
    const title = ruleBody(css, ".qTitle");
    expect(title).toMatch(/font-family:\s*var\(--font-sans\)/);
    expect(title).toMatch(/font-weight:\s*800/);
    expect(title).not.toContain("--font-serif");
  });

  it("references no serif and no Retired_Token", () => {
    for (const token of [
      "--font-serif",
      "--gold-leaf",
      "--gold-text",
      "--seal",
      "--ink-faded",
      "--desk-",
    ]) {
      expect(css).not.toContain(token);
    }
  });
});

describe("the targets are at least 44 x 44 at the Phone_Sizes (P8.4)", () => {
  it.each([".input", ".cta", ".link", ".noAnswer", ".readingOption"])(
    "%s has a 44 px minimum height",
    (selector) => {
      expect(ruleBody(css, selector)).toMatch(/min-height:\s*44px/);
    },
  );

  it("gives the Next button a 44 px minimum width too", () => {
    expect(ruleBody(css, ".cta")).toMatch(/min-width:\s*44px/);
  });
});
