// Feature: spec 14 B1 (task 12.3)
//
// CSS source tests for the Top_Bar slot boxes. The box of each slot must not
// change with the Stage or with a running sequence (B1.2), the fixed slots are
// `flex: none`, and the disabled Skip keeps its box and is 40 % opacity (B1.3).
// The browser check (layout-check) measures the real geometry. These tests read
// scene.module.css and check the rules.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(resolve(here, "scene.module.css"), "utf8");
const css = raw.replace(/\/\*[\s\S]*?\*\//g, "");

type Rule = { selector: string; body: string };

/** Every rule in the file, at any nesting depth. Selectors are trimmed. */
function allRules(source: string): Rule[] {
  return [...source.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: m[1].trim(),
    body: m[2],
  }));
}

/** The declaration value of `prop` in `body`, or undefined. */
function declared(body: string, prop: string): string | undefined {
  const match = body.match(new RegExp(`(?:^|;|\\s)${prop}\\s*:\\s*([^;]+);`));
  return match?.[1].trim();
}

/** The Top_Bar slot selectors: the bar, its brand, chip, controls and the Top_Bar icon and label. */
const SLOT_SELECTOR =
  /\.(topbar|brand|wordmark|wordmarkLink|chip|controls|control|controlIcon|controlLabel|notice)\b|data-topbar-slot/;

const rules = allRules(css);
const slotRules = rules.filter((r) => SLOT_SELECTOR.test(r.selector));

/** The top-level rule with exactly `selector`, outside any @media block. */
function topLevel(selector: string): Rule {
  const found = rules.find((r) => r.selector === selector);
  if (!found) throw new Error(`no rule for ${selector}`);
  return found;
}

describe("Top_Bar fixed slots are flex: none (spec 14 B1.2)", () => {
  it("gives the chip flex: none", () => {
    expect(declared(topLevel(".chip").body, "flex")).toBe("none");
  });

  it("gives the Calm, sound and Skip controls flex: none", () => {
    // The sound toggle and the Skip button both use .control, so one rule
    // covers all three.
    expect(declared(topLevel(".control").body, "flex")).toBe("none");
  });

  it("keeps flex: none on the control in the sub-600 px phone block", () => {
    // The phone block sets its own size for .control. It must not override
    // flex, so the fixed box holds at every width.
    const phoneControl = slotRules.filter((r) => r.selector === ".control");
    for (const rule of phoneControl) {
      const flex = declared(rule.body, "flex");
      if (flex !== undefined) expect(flex).toBe("none");
    }
  });

  it("gives the brand flex: none", () => {
    expect(declared(topLevel(".brand").body, "flex")).toBe("none");
  });

  it("gives the Top_Bar icon flex: none", () => {
    expect(declared(topLevel(".controlIcon").body, "flex")).toBe("none");
  });

  it("sets no flex-grow or flex on any slot other than the notice", () => {
    for (const rule of slotRules) {
      if (rule.selector === ".notice") continue;
      const flex = declared(rule.body, "flex");
      if (flex !== undefined) expect(flex, rule.selector).toBe("none");
      expect(declared(rule.body, "flex-grow"), rule.selector).toBeUndefined();
    }
  });
});

describe("the disabled Skip keeps its box at 40 % opacity (spec 14 B1.3)", () => {
  const disabled = topLevel('[data-topbar-slot="skip"]:disabled');

  it("sets the disabled Skip to 40 % opacity", () => {
    expect(declared(disabled.body, "opacity")).toBe("0.4");
  });

  it("changes no size, padding, flex or display on the disabled Skip", () => {
    for (const prop of [
      "width",
      "height",
      "min-width",
      "min-height",
      "padding",
      "flex",
      "display",
      "margin",
    ]) {
      expect(declared(disabled.body, prop), prop).toBeUndefined();
    }
  });
});

describe("no Top_Bar slot rule changes its box by Stage or sequence (spec 14 B1.2)", () => {
  // A stage or a running sequence is named by a data attribute on the page or
  // the Ceremony region. A slot rule that selects on one of them would change
  // the box with the Stage or the sequence.
  const STAGE_OR_SEQUENCE =
    /data-ceremony|data-stage|data-sequence|data-persona-stage|data-skip|data-seal-state|hasActive/;

  it("finds the Top_Bar slot rules", () => {
    expect(slotRules.length).toBeGreaterThan(5);
  });

  it("has no slot rule that selects on a Stage or sequence attribute", () => {
    for (const rule of slotRules) {
      expect(rule.selector, rule.selector).not.toMatch(STAGE_OR_SEQUENCE);
    }
  });

  it("has no slot rule that sets a box property under a Stage-dependent selector", () => {
    // Any :has() on a slot must test the bar's own notice, not a Stage.
    const BOX =
      /(width|height|min-width|min-height|max-width|max-height|flex|flex-basis|padding|margin|display)\s*:/;
    for (const rule of slotRules) {
      if (!rule.selector.includes(":has(")) continue;
      expect(rule.selector, rule.selector).not.toMatch(STAGE_OR_SEQUENCE);
      // A notice-presence :has() may change the bar's height, which depends
      // on the page, not on the Stage.
      if (BOX.test(rule.body)) {
        expect(rule.selector).toContain('[data-topbar-slot="notice"]');
      }
    }
  });
});
