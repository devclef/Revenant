// The Ceremony region is a -1 tab stop that takes focus when a Stage changes
// (CeremonyRoot.tsx). It must not draw an outline itself (issue #119). Focus
// rings stay on the controls and headings inside it.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "ceremony.module.css"), "utf8");

// The declaration bodies of every rule whose selector list matches `selector`
// exactly (one rule per line, as written in this stylesheet).
function bodiesOf(selector: string): string[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`, "g");
  return [...css.matchAll(pattern)].map((m) => m[1] ?? "");
}

describe("the reveal region draws no outline", () => {
  it("has a .ceremony:focus rule that removes the outline", () => {
    const bodies = bodiesOf(".ceremony:focus,\n.ceremony:focus-visible");
    expect(bodies.length).toBe(1);
    expect(bodies[0]).toMatch(/outline:\s*none/);
  });

  it("declares no visible outline on the region element itself", () => {
    for (const body of bodiesOf(".ceremony")) {
      expect(body).not.toMatch(/outline:\s*(?!none)/);
    }
  });

  it("keeps the focus ring on controls and headings", () => {
    const control = bodiesOf(".deskControl:focus-visible");
    expect(control.length).toBe(1);
    expect(control[0]).toMatch(/outline:\s*2px solid var\(--desk-ink\)/);
    expect(bodiesOf(".desk :focus").some((b) => /outline:\s*2px/.test(b))).toBe(true);
  });

  it("places the region reset after the ring rules so it wins on the same specificity", () => {
    const resetAt = css.indexOf(".ceremony:focus,");
    expect(resetAt).toBeGreaterThan(css.indexOf(".desk :focus {"));
    expect(resetAt).toBeGreaterThan(css.indexOf(".onPaper :focus {"));
  });
});
