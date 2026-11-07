// Feature: 05-reveal-ceremony, R11 accessibility review (issue #103, task 2)
//
// Tests for the accessibility rules applied across every Ceremony view:
//
//   - focus moves to the newest Stage heading on each Stage change
//     (`stageHeadingIndex`, used by CeremonyRoot);
//   - Calm_Mode starts no stage fade (reveal.module.css);
//   - every control's target is at least 24 by 24 px (the stylesheets);
//   - the recall scale has a plain control for the hold-still zoom;
//   - the Mark is announced as the judge's answer, not as a position.
//
// The repo has no DOM test environment, so the focus rule is a pure function
// and the rest are read from the stylesheet source or rendered as static markup
// (the house style, see CeremonyRoot.test.tsx and RecallScale.test.tsx).

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { stageHeadingIndex } from "./CeremonyRoot";
import { CEREMONY_COPY } from "./copy";
import { RecallScale } from "./recall/RecallScale";
import { scaleRangeFor } from "./recall/unit-ranges";

const here = dirname(fileURLToPath(import.meta.url));
const revealCss = readFileSync(
  join(here, "..", "reveal", "reveal.module.css"),
  "utf8",
);
const deskCss = readFileSync(join(here, "ceremony.module.css"), "utf8");
const recallCss = readFileSync(
  join(here, "recall", "RecallScale.module.css"),
  "utf8",
);

/** The declaration block of the first rule whose selector is exactly `.name`. */
function blockOf(css: string, name: string): string {
  const match = new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`).exec(css);
  if (match === null) {
    throw new Error(`no rule for .${name}`);
  }
  return match[1] ?? "";
}

/** A pixel length declared as `property: <n>px` in a block, or undefined. */
function pxOf(block: string, property: string): number | undefined {
  const match = new RegExp(`${property}:\\s*(\\d+(?:\\.\\d+)?)px`).exec(block);
  return match === null ? undefined : Number(match[1]);
}

describe("focus moves to the newest Stage heading (R9.6, R11)", () => {
  it("picks the last h1 or h2 in document order", () => {
    expect(stageHeadingIndex(["h2", "p", "h2"])).toBe(2);
    expect(stageHeadingIndex(["div", "h1", "p"])).toBe(1);
  });

  it("returns -1 when the region has no heading, so the region takes focus", () => {
    expect(stageHeadingIndex([])).toBe(-1);
    expect(stageHeadingIndex(["div", "p", "h3"])).toBe(-1);
  });

  it("ignores h3 figure names, which are not Stage headings", () => {
    expect(stageHeadingIndex(["h2", "h3", "h3"])).toBe(0);
  });
});

describe("Calm_Mode starts no animation (R11.2)", () => {
  it("stops the stage fade under data-ceremony-motion=calm", () => {
    expect(revealCss).toMatch(
      /:global\(\[data-ceremony-motion="calm"\]\) \.fade\s*\{\s*animation:\s*none;/,
    );
  });

  it("keeps the fade itself for full motion", () => {
    expect(blockOf(revealCss, "fade")).toMatch(/animation:\s*reveal-fade-in/);
  });
});

describe("every control's target is at least 24 by 24 px (WCAG 2.5.8)", () => {
  const controls: Array<[string, string, string]> = [
    ["reveal.module.css", revealCss, "button"],
    ["ceremony.module.css", deskCss, "deskControl"],
    ["RecallScale.module.css", recallCss, "wholeScale"],
  ];

  for (const [file, css, name] of controls) {
    it(`.${name} in ${file} is at least 24 px tall and wide`, () => {
      const block = blockOf(css, name);
      const height = pxOf(block, "min-height");
      const width = pxOf(block, "min-width");
      expect(height).toBeGreaterThanOrEqual(24);
      // `.deskControl` sets only a min-height; its width follows its label.
      if (width !== undefined) {
        expect(width).toBeGreaterThanOrEqual(24);
      }
    });
  }
});

describe("the recall scale has a plain control for the hold-still zoom", () => {
  const baseProps = {
    id: "q1",
    label: "What did a gallon of gas cost?",
    unitLabel: "USD per gallon",
    range: scaleRangeFor("USD per gallon"),
    onEdit: () => undefined,
  };

  it("offers Look closer while the Mark can be edited", () => {
    const markup = renderToStaticMarkup(
      createElement(RecallScale, { ...baseProps, value: 3.4, noAnswer: false }),
    );
    expect(markup).toContain(CEREMONY_COPY.recallLookCloser);
  });

  it("does not offer Look closer when there is no answer to zoom on", () => {
    const markup = renderToStaticMarkup(
      createElement(RecallScale, { ...baseProps, value: null, noAnswer: true }),
    );
    expect(markup).not.toContain(CEREMONY_COPY.recallLookCloser);
  });
});

describe("the Mark is announced as the judge's answer, not a position", () => {
  it("speaks the answer prefix in edit mode too", () => {
    const markup = renderToStaticMarkup(
      createElement(RecallScale, {
        id: "q1",
        label: "Gas",
        unitLabel: "USD per gallon",
        range: scaleRangeFor("USD per gallon"),
        value: 3.4,
        noAnswer: false,
        onEdit: () => undefined,
        spokenPrefix: "Your answer",
      }),
    );
    expect(markup).toContain('aria-valuetext="Your answer: 3.4 USD per gallon"');
  });

  it("the Number_Line's hidden Mark text reads as an answer, never a position", () => {
    expect(CEREMONY_COPY.markAnswer.startsWith("Your answer")).toBe(true);
    expect(CEREMONY_COPY.markAnswer.toLowerCase()).not.toContain("position");
  });
});

describe("decorative layers are hidden from assistive technology", () => {
  // Every Ceremony module that draws an inline svg must mark it aria-hidden, or
  // give it role="img" with a label of its own. A source scan keeps a
  // later decorative svg from being read out as an unlabelled graphic.
  const files = [
    "envelope/Envelope.tsx",
    "../ui/WaxSeal.tsx",
    "seal/SealBreak.tsx",
  ];
  for (const file of files) {
    it(`${file} marks its decorative svg aria-hidden`, () => {
      const source = readFileSync(join(here, file), "utf8");
      expect(source).toContain("<svg");
      // Each <svg ...> opening tag must be followed (within its attributes)
      // by aria-hidden="true".
      // A real opening tag has attributes after the name, so `<svg>` in a
      // comment does not count.
      const openings = source.match(/<svg\s[^>]*>/g) ?? [];
      expect(openings.length).toBeGreaterThan(0);
      for (const opening of openings) {
        expect(opening).toMatch(/aria-hidden="true"|role="img"/);
      }
    });
  }
});
