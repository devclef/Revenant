// Spec 07 check C1: the figures column on the desk must not be dimmed by its
// own styles. The fade-up animates opacity only while it runs, so the settled
// stylesheet must not set opacity on the figures column or its text.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "reveal.module.css"), "utf8");

function ruleBodies(selector: string): string[] {
  const bodies: string[] = [];
  const pattern = new RegExp(`(^|\\n)\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`, "g");
  for (const match of css.matchAll(pattern)) bodies.push(match[2]);
  return bodies;
}

describe("figures column contrast (spec 07 C1)", () => {
  it("never sets opacity on the figures column or its text", () => {
    for (const selector of [".figuresCol", ".figuresThenNow", ".figuresThenNow h2", ".figuresThenNow .period", ".figuresThenNow .region"]) {
      for (const body of ruleBodies(selector)) {
        expect(body, `${selector} must not set opacity`).not.toMatch(/opacity\s*:/);
      }
    }
  });

  it("gives the figures column a desk background and desk text", () => {
    const bodies = ruleBodies(".figuresCol");
    const last = bodies[bodies.length - 1] ?? "";
    expect(last).toMatch(/color:\s*var\(--text\)/);
    expect(last).toMatch(/background-color:\s*var\(--bg\)/);
  });
});
