// Feature: 07-judge-journey (spec 07 task 4, issue #166)
//
// Fit checks for the Recall_Pager card. The data-fit hooks name the elements the
// browser check measures at 1280 x 800 and 360 x 640: the counter, the question,
// the answer row (typed number plus Next control) and the advance control. These
// tests pin the source hooks and the CSS rules that keep the answer row above
// the fold on desktop and inside the card's padding at 360 px.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const here = __dirname;
const css = readFileSync(resolve(here, "RecallPager.module.css"), "utf8");
const source = readFileSync(resolve(here, "RecallPager.tsx"), "utf8");

/** The body of one top-level rule, or "" when the rule is absent. */
function ruleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  return m?.[1] ?? "";
}

/** The body of the narrow (max-width: 899px) media block, or "" when absent. */
function narrowBlock(): string {
  const m = css.match(/@media \(max-width: 899px\) \{([\s\S]*)\}\s*$/);
  return m?.[1] ?? "";
}

/** The body of one rule nested inside the narrow media block. */
function narrowRuleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = narrowBlock().match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  return m?.[1] ?? "";
}

/** The body of the stacked (max-width: 639.98px) media block, or "" when absent. */
function stackBlock(): string {
  const m = css.match(/@media \(max-width: 639\.98px\) \{([\s\S]*?)\n\}/);
  return m?.[1] ?? "";
}

/** The body of one rule nested inside the stacked media block. */
function stackRuleBody(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = stackBlock().match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  return m?.[1] ?? "";
}

describe("Recall_Pager fit hooks", () => {
  it("names the counter, question, answer row and advance control", () => {
    expect(source).toContain('data-fit="counter"');
    expect(source).toContain('data-fit="question"');
    expect(source).toContain('data-fit="answer"');
    expect(source).toContain('data-fit="advance"');
  });

  it("keeps the counter date in one nowrap span", () => {
    expect(source).toContain('<span className={styles.nowrap}>{asOfText}</span>');
    expect(ruleBody(".nowrap")).toMatch(/white-space:\s*nowrap/);
  });
});

describe("Recall_Pager reading group keeps the field and Next in view", () => {
  it("names the reading group after the answer row, so it cannot push them down", () => {
    const answer = source.indexOf('data-fit="answer"');
    const readings = source.indexOf('data-fit="readings"');
    const advance = source.indexOf('data-fit="advance"');
    expect(answer).toBeGreaterThan(-1);
    expect(readings).toBeGreaterThan(-1);
    expect(advance).toBeGreaterThan(-1);
    // The answer row (field and Next) comes first in the markup; the readings follow it.
    expect(readings).toBeGreaterThan(advance);
  });

  it("caps the reading group at the card width at every size", () => {
    expect(ruleBody(".readings")).toMatch(/max-width:\s*100%/);
  });
});

describe("Recall_Pager card fits above the fold at 1280 x 800", () => {
  it("caps the typed number at 3.6rem so the answer row sits higher", () => {
    const font = ruleBody(".input").match(/font-size:\s*clamp\(([^)]*)\)/);
    expect(font).not.toBeNull();
    const parts = font![1].split(",").map((part) => part.trim());
    expect(parts[2]).toBe("3.6rem");
  });

  it("tightens the fieldset padding and the vertical gaps", () => {
    expect(ruleBody(".fieldset")).toMatch(/padding:\s*0\.75rem 1\.25rem/);
    expect(ruleBody(".fieldset")).toMatch(/margin:\s*0 0 0\.75rem/);
    expect(ruleBody(".body")).toMatch(/gap:\s*0\.5rem/);
    expect(ruleBody(".qTitle")).toMatch(/margin:\s*0 0 0\.5rem/);
    expect(ruleBody(".counter")).toMatch(/margin:\s*0 0 0\.5rem/);
  });
});

describe("Recall_Pager card fits inside its padding at 360 x 640", () => {
  it("shares one wrapping row at 640 px and up, and stacks below it (spec 09 A8.3)", () => {
    // Below RECALL_STACK_BELOW_PX (640 px) the typed number and Next stack at the
    // full card width. At and above 640 px they share a row that may wrap. The
    // old rule kept them on one nowrap row below 900 px; that rule is gone.
    expect(ruleBody(".answerRow")).toMatch(/flex-wrap:\s*wrap/);
    expect(narrowRuleBody(".answerRow")).not.toMatch(/flex-wrap:\s*nowrap/);
    expect(stackRuleBody(".answerRow")).toMatch(/flex-direction:\s*column/);
    expect(stackRuleBody(".input")).toMatch(/width:\s*100%/);
    expect(stackRuleBody(".cta")).toMatch(/width:\s*100%/);
  });

  it("lets the typed number shrink inside the nowrap row", () => {
    // The input is the flex item that absorbs the width, so it needs min-width 0.
    expect(ruleBody(".input")).toMatch(/min-width:\s*0/);
    expect(ruleBody(".input")).toMatch(/width:\s*6\.5ch/);
    expect(ruleBody(".cta")).toMatch(/white-space:\s*normal/);
    expect(ruleBody(".cta")).not.toMatch(/white-space:\s*nowrap/);
  });

  it("shrinks the question, fieldset and typed number below 900 px", () => {
    expect(narrowRuleBody(".qTitle")).toMatch(/font-size:\s*1rem/);
    expect(narrowRuleBody(".qTitle")).toMatch(/margin-bottom:\s*0\.25rem/);
    expect(narrowRuleBody(".fieldset")).toMatch(/padding:\s*0\.2rem 0\.75rem/);
    expect(narrowRuleBody(".input")).toMatch(/font-size:\s*1\.5rem/);
  });

  it("keeps the narrow question heading smaller than the intact desktop size", () => {
    // The desktop question clamps to at least 1.3rem, so the narrow 1rem stays below it.
    const desktop = ruleBody(".qTitle").match(/font-size:\s*clamp\(([\d.]+)rem/);
    expect(desktop).not.toBeNull();
    const narrow = Number(narrowRuleBody(".qTitle").match(/font-size:\s*([\d.]+)rem/)?.[1]);
    expect(narrow).toBeLessThan(Number(desktop![1]));
  });

  it("keeps the 'No answer yet' label inside the card width", () => {
    expect(ruleBody(".noAnswer")).toMatch(/display:\s*inline-flex/);
    expect(narrowRuleBody(".noAnswer")).toMatch(/max-width:\s*100%/);
  });

  it("keeps the card and its controls within the width", () => {
    expect(ruleBody(".fieldset")).toMatch(/max-width:\s*100%/);
    expect(ruleBody(".answerRow")).toMatch(/max-width:\s*100%/);
  });

  it("stretches the body column so the scale takes the card width", () => {
    // A flex-start column shrinks the absolutely positioned scale to 0 px, and the
    // centred "No answer yet" readout then sits about 33 px in, past the card's
    // left edge at 36 px. Stretching keeps the readout inside the card.
    expect(ruleBody(".body")).toMatch(/align-items:\s*stretch/);
    expect(ruleBody(".body")).not.toMatch(/align-items:\s*flex-start/);
  });
});

describe("Recall_Pager number field shows a typed value such as 1.585 at 360 x 640", () => {
  it("gives the field at least the width of a five-character value", () => {
    // "1.585" is five characters. The field width is in ch (the width of "0" at its
    // font size), so the width must be at least 5ch plus the 0.4rem padding on each side.
    const width = ruleBody(".input").match(/width:\s*([\d.]+)ch/);
    expect(width).not.toBeNull();
    expect(Number(width![1])).toBeGreaterThanOrEqual(5);
  });

  it("does not shrink the field below its base width at narrow sizes", () => {
    expect(narrowRuleBody(".input")).not.toMatch(/\bwidth:/);
  });

  it("keeps the read-as line and the parser source untouched by this rule", () => {
    expect(source).toContain('className={styles.parsed}');
  });
});
