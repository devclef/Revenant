// Feature: 09-demo-polish, C2.2 to C2.5 (Step_Indicator render tests)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StepIndicator } from "./StepIndicator";

const STEPS = ["Testify", "Break the seal", "Read", "See the receipts"];

function render(current: number | null): string {
  return renderToStaticMarkup(
    createElement(StepIndicator, { steps: STEPS, current, label: "Your progress" }),
  );
}

describe("StepIndicator", () => {
  it("renders the four step names in order inside an ordered list", () => {
    const html = render(0);
    expect(html.startsWith("<ol")).toBe(true);
    const names = [...html.matchAll(/<li[^>]*>([^<]*)<\/li>/g)].map((m) => m[1]);
    expect(names).toEqual(STEPS);
  });

  it("puts data-step-indicator on the root and the list label on it", () => {
    const html = render(1);
    expect(html).toMatch(/<ol[^>]*data-step-indicator/);
    expect(html).toContain('aria-label="Your progress"');
  });

  it("marks exactly one item with aria-current=\"step\" for the current index", () => {
    const html = render(2);
    const items = [...html.matchAll(/<li([^>]*)>([^<]*)<\/li>/g)];
    const current = items.filter((m) => m[1].includes('aria-current="step"'));
    expect(current).toHaveLength(1);
    expect(current[0][2]).toBe("Read");
  });

  it("marks no item current when current is null", () => {
    expect(render(null)).not.toContain("aria-current");
  });

  it("uses no Accent colour in its styles", () => {
    const css = readFileSync(
      join(__dirname, "StepIndicator.module.css"),
      "utf8",
    );
    expect(css).not.toMatch(/--accent/);
  });
});
