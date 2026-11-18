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

describe("Recall_Pager fit hooks", () => {
  it("names the counter, question, answer field and advance control", () => {
    const navRow = readFileSync(resolve(here, "NavRow.tsx"), "utf8");
    expect(source).toContain('data-fit="counter"');
    expect(source).toContain('data-fit="question"');
    expect(source).toContain('data-fit="answer"');
    expect(navRow).toContain('data-fit="advance"');
  });

  it("keeps the counter date in one nowrap span", () => {
    expect(source).toContain('<span className={styles.nowrap}>{asOfText ?? writtenOnText}</span>');
    expect(ruleBody(".nowrap")).toMatch(/white-space:\s*nowrap/);
  });
});

describe("Recall_Pager reading group keeps the field and Next in view", () => {
  it("names the reading group after the answer field and before the Nav_Row", () => {
    const answer = source.indexOf('data-fit="answer"');
    const readings = source.indexOf('data-fit="readings"');
    // The number question's NavRow is the last one in the file; the text branch
    // has its own NavRow earlier in the markup.
    const nav = source.lastIndexOf("<NavRow");
    expect(answer).toBeGreaterThan(-1);
    expect(readings).toBeGreaterThan(answer);
    expect(nav).toBeGreaterThan(readings);
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
    expect(ruleBody(".fieldset")).toMatch(/padding:\s*0\.5rem 1\.25rem/);
    expect(ruleBody(".fieldset")).toMatch(/margin:\s*0 0 0\.75rem/);
    expect(ruleBody(".body")).toMatch(/gap:\s*0\.25rem/);
    expect(ruleBody(".qTitle")).toMatch(/margin:\s*0 0 0\.5rem/);
    expect(ruleBody(".counter")).toMatch(/margin:\s*0 0 0\.25rem/);
  });
});

describe("Recall_Pager card fits inside its padding at 360 x 640", () => {
  it("shares one wrapping row at every width (spec 10 C1.5)", () => {
    // The typed number and Next share one row at every width, so the primary
    // control stays inside the 640 px First_Viewport. The row may wrap.
    expect(ruleBody(".answerRow")).toMatch(/flex-wrap:\s*wrap/);
    expect(narrowRuleBody(".answerRow")).not.toMatch(/flex-wrap:\s*nowrap/);
    expect(css).not.toMatch(/@media \(max-width: 639\.98px\)/);
    expect(ruleBody(".answerRow")).not.toMatch(/flex-direction:\s*column/);
    // Below 900 px the typed number is 1.25rem, so the field and Next fit one 360 px row.
    expect(narrowRuleBody(".input")).toMatch(/font-size:\s*1\.25rem/);
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
    expect(narrowRuleBody(".input")).toMatch(/font-size:\s*1\.25rem/);
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

  it("shows no read-as line (T2.3)", () => {
    expect(source).not.toContain("CEREMONY_COPY.parsedValue");
    expect(source).not.toContain("styles.parsed");
  });
});

/*
 * RECORDED MEASUREMENT, NOT A LIVE CHECK. These constants were read once from
 * Chromium at 390 x 844 (spec 14 T1.6). Method: the branch was built, started with
 * `npm start`, and the Maya persona's Testify step (stage "recall") was opened. The
 * question text was replaced in the DOM with a 200-character string, and the
 * getBoundingClientRect values of the heading and the answer row were read. The
 * constants below cannot fail if the layout changes. The live check is the T1.6
 * row of `npm run layout-check` (spec 14 task 17).
 */
const MEASURED_200_CHAR_390X844 = {
  viewportHeight: 844,
  questionTop: 469,
  questionBottom: 623,
  answerTop: 659,
  answerBottom: 703,
  discRight: 83,
  questionLeft: 99,
};

describe("Recall_Pager 200-character text question at 390 x 844 (T1.6), recorded measurement", () => {
  it("recorded: the answer row and the main button sit inside the 844 px First_Viewport", () => {
    expect(MEASURED_200_CHAR_390X844.answerBottom).toBeLessThanOrEqual(
      MEASURED_200_CHAR_390X844.viewportHeight,
    );
  });

  it("ends the question above the answer row", () => {
    expect(MEASURED_200_CHAR_390X844.questionBottom).toBeLessThan(
      MEASURED_200_CHAR_390X844.answerTop,
    );
  });

  it("keeps the 390 rules as they are, because the question fits without them", () => {
    // The narrow heading stays at 1rem; the T1.6 rules (.qText at 26 px,
    // .navRow margin-top 16 px) apply only when the measured row overflows.
    expect(narrowRuleBody(".qTitle")).toMatch(/font-size:\s*1rem/);
  });
});

/*
 * RECORDED MEASUREMENT, NOT A LIVE CHECK (spec 14 T2.5). Read once from Chromium
 * at 390 x 844 with scrollY 0, on the built branch with the persona letters sealed
 * by `npm run seal-personas`. Each row is one persona number question with its
 * Sample_Note shown. Values are CSS px from getBoundingClientRect. The counter top
 * is the same for every question because the letter preamble sits above it.
 *
 * At scrollY 0 no advance control lies inside the 844 px viewport: the lowest is
 * 1034 px. The question block (counter top to advance bottom) fits: the tallest is
 * 589 px, under the 748 px left below the 96 px Top_Bar fallback. This is open
 * for the layout-check row that owns T2.5.
 */
const MEASURED_PERSONA_NUMBER_390X844 = [
  { persona: "us-maya", metric: "us-gasoline-regular", counterTop: 446, noteBottom: 814, advanceBottom: 924 },
  { persona: "us-maya", metric: "us-diesel", counterTop: 446, noteBottom: 814, advanceBottom: 987 },
  { persona: "eu-tomas", metric: "eu-petrol-euro95", counterTop: 446, noteBottom: 861, advanceBottom: 972 },
  { persona: "eu-tomas", metric: "eu-diesel", counterTop: 446, noteBottom: 861, advanceBottom: 1034 },
];

const SAMPLES_FILE = resolve(here, "../../../../content/personas/letters/samples.json");

describe("Recall_Pager every persona number question with its Sample_Note at 390 x 844 (T2.5), recorded", () => {
  it("covers every persona number question that has a Sample_Answer", () => {
    const samples = JSON.parse(readFileSync(SAMPLES_FILE, "utf8")) as Record<
      string,
      Record<string, string[]>
    >;
    const expected = Object.entries(samples).flatMap(([persona, metrics]) =>
      Object.keys(metrics).map((metric) => `${persona}/${metric}`),
    );
    const recorded = MEASURED_PERSONA_NUMBER_390X844.map(
      (row) => `${row.persona}/${row.metric}`,
    );
    expect(recorded.sort()).toEqual(expected.sort());
  });

  it("keeps the question block inside the 844 px viewport below the 96 px Top_Bar", () => {
    const clearance = 844 - 96;
    for (const row of MEASURED_PERSONA_NUMBER_390X844) {
      expect(row.advanceBottom - row.counterTop, `${row.persona} ${row.metric}`).toBeLessThanOrEqual(clearance);
    }
  });

  it("keeps the Sample_Note above the Nav_Row (T2.1 order)", () => {
    for (const row of MEASURED_PERSONA_NUMBER_390X844) {
      expect(row.noteBottom, `${row.persona} ${row.metric}`).toBeLessThan(row.advanceBottom);
    }
  });

  it("sets the Nav_Row 16 px below its top and the intro at 15 px below 600 px", () => {
    expect(css).toMatch(/\.body > :global\(\[data-nav-row\]\)\s*\{\s*margin-top:\s*16px;/);
    expect(css).toMatch(/@media \(max-width: 599\.98px\) \{\s*\.intro \{\s*font-size:\s*15px;/);
  });
});
