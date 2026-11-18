// Feature: 14-write-desk (T1.3, T1.6): the Wax_Disc beside a question and the
// question text (.qText). The disc's own colours are pinned in
// src/components/live/desk/sheet-css.test.ts; this file pins how the Recall_Pager
// places the disc and lets the question text shrink beside it.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const here = __dirname;
const pagerCss = readFileSync(resolve(here, "RecallPager.module.css"), "utf8");
const pagerSource = readFileSync(resolve(here, "RecallPager.tsx"), "utf8");
const discCss = readFileSync(
  resolve(here, "../../live/desk/wax-disc.module.css"),
  "utf8",
);

/** The body of one top-level rule, or "" when the rule is absent. */
function ruleBody(css: string, selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  return m?.[1] ?? "";
}

describe("Wax_Disc placement in the question row (T1.3)", () => {
  it("is a 30 px disc in the wax-disc stylesheet", () => {
    expect(ruleBody(discCss, ".disc")).toMatch(/width:\s*30px/);
    expect(ruleBody(discCss, ".disc")).toMatch(/height:\s*30px/);
    expect(ruleBody(discCss, ".disc")).toMatch(/flex:\s*none/);
  });

  it("renders the disc before the question heading, inside the question row", () => {
    const row = pagerSource.indexOf("styles.qRow");
    const disc = pagerSource.indexOf("<WaxDisc n={index + 1} />");
    const heading = pagerSource.indexOf("styles.qText");
    expect(row).toBeGreaterThan(-1);
    expect(disc).toBeGreaterThan(row);
    expect(heading).toBeGreaterThan(disc);
  });

  it("sets the gap to 16 px, so the question starts 16 px right of the disc", () => {
    expect(ruleBody(pagerCss, ".qRow")).toMatch(/gap:\s*16px/);
    expect(ruleBody(pagerCss, ".qRow")).toMatch(/display:\s*flex/);
  });

  it("nudges the disc down 0.1rem so it lines up with the first line of the question", () => {
    expect(ruleBody(pagerCss, ".qRow > :global([data-wax-disc])")).toMatch(
      /margin-top:\s*0\.1rem/,
    );
  });
});

describe(".qText lets a 200-character question wrap beside the disc (T1.6)", () => {
  it("takes the free width and can shrink below its content", () => {
    expect(ruleBody(pagerCss, ".qText")).toMatch(/flex:\s*1 1 auto/);
    expect(ruleBody(pagerCss, ".qText")).toMatch(/min-width:\s*0/);
  });

  it("breaks long words in the heading, so a run of text with no spaces cannot push the disc or the row off the card", () => {
    // The heading carries both classes (`styles.qTitle styles.qText`), and the
    // overflow-wrap rule lives on .qTitle. The .qText rule only sets flex and min-width.
    expect(pagerSource).toContain("${styles.qTitle} ${styles.qText}");
    expect(ruleBody(pagerCss, ".qTitle")).toMatch(/overflow-wrap:\s*anywhere/);
  });

  it("is capped at the row width at every size", () => {
    expect(ruleBody(pagerCss, ".qRow")).toMatch(/max-width:\s*100%/);
    expect(ruleBody(pagerCss, ".qRow")).toMatch(/min-width:\s*0/);
  });
});
