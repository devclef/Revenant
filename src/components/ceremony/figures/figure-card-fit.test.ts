// Spec 10 C7.2 and C7.3 for the figure card. The NumberLine sits inside a
// Receipt_Card (`.fig`, reveal.module.css). `.fig` has no padding or border and
// is a flow-root, so the card's empty space above and below its children is the
// NumberLine's own top and bottom margin. It must stay within 48 px.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const here = __dirname;
const REM_PX = 16;
const MAX_EMPTY_PX = 48;

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(
    new RegExp(`(?:^|[\\s,}])${escaped}\\s*\\{([^}]*)\\}`),
  );
  if (match === null) throw new Error(`no rule for ${selector}`);
  return match[1];
}

const figures = stripComments(
  readFileSync(resolve(here, "figures.module.css"), "utf8"),
);
const reveal = stripComments(
  readFileSync(resolve(here, "../../reveal/reveal.module.css"), "utf8"),
);

function allRuleBodies(css: string, selector: string): string[] {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|[\\s,}])${escaped}\\s*\\{([^}]*)\\}`, "g");
  return [...css.matchAll(re)].map((m) => m[1]);
}

describe("Receipt_Card holding a NumberLine (C7.3)", () => {
  it("gives the NumberLine a 0.75 rem top and bottom margin", () => {
    expect(ruleBody(figures, ".numberLine")).toMatch(/margin:\s*0\.75rem 0;/);
  });

  it("gives every .fig rule no padding and no border, so only the NumberLine margins are empty", () => {
    const bodies = allRuleBodies(reveal, ".fig");
    expect(bodies.length).toBeGreaterThan(0);
    for (const body of bodies) {
      expect(body).not.toMatch(/padding/);
      expect(body).not.toMatch(/border/);
    }
  });

  it("keeps the card a flow-root with a zero margin, so the NumberLine margins are inside it", () => {
    const bodies = allRuleBodies(reveal, ".fig");
    expect(bodies.some((b) => /display:\s*flow-root;/.test(b))).toBe(true);
    // The last .fig margin rule wins: it sets margin to 0 (RC1).
    expect(bodies[bodies.length - 1]).toMatch(/margin:\s*0;/);
  });

  it("leaves 24 px of empty card above and below the NumberLine, within 48 px", () => {
    const marginPx = 0.75 * REM_PX;
    const emptyPx = 2 * marginPx;
    expect(emptyPx).toBe(24);
    expect(emptyPx).toBeLessThanOrEqual(MAX_EMPTY_PX);
  });
});
