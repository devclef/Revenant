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

// Spec 10 X2.2 and X2.3: the phone step row. The gaps and size change only
// below 600 px, each step name stays on one line, and nothing else in the
// stylesheet changes the row's layout.
describe("StepIndicator phone rule (StepIndicator.module.css, spec 10 X2.2, X2.3)", () => {
  const css = readFileSync(join(__dirname, "StepIndicator.module.css"), "utf8");
  const phoneAt = css.indexOf("@media (max-width: 599.98px)");
  const base = phoneAt >= 0 ? css.slice(0, phoneAt) : css;
  const phone = phoneAt >= 0 ? css.slice(phoneAt) : "";

  it("has one phone block, below 600 px only, and no min-width query", () => {
    expect(phoneAt).toBeGreaterThan(-1);
    expect(css.match(/@media/g)).toHaveLength(1);
    expect(css).not.toMatch(/min-width/);
  });

  it("sets the phone gap and size inside the phone block only", () => {
    expect(phone).toMatch(/\.steps \{\s*gap: 0\.25rem 0\.75rem;\s*font-size: 0\.8rem;\s*\}/);
    expect(base).toMatch(/\.steps \{[^}]*gap: 0\.5rem 1\.25rem;/);
    expect(base).toMatch(/\.steps \{[^}]*font-size: 0\.875rem;/);
  });

  it("keeps each step name on one line, so the row wraps only between whole names", () => {
    expect(base).toMatch(/\.steps \{[^}]*flex-wrap: wrap;/);
    expect(base).toMatch(/\.step \{[^}]*white-space: nowrap;/);
    expect(base).toMatch(/\.current \{[^}]*white-space: nowrap;/);
    expect(phone).not.toMatch(/white-space/);
  });
});
