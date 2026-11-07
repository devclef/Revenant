// Markup tests for NumberLine (05-reveal-ceremony, design.md "Number_Line
// geometry", R10.3, R10.4, R11.9, R12.1-R12.4, Properties 11 and 12).
// Rendered with `renderToStaticMarkup` and `createElement`, no JSX.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { CEREMONY_COPY } from "../copy";
import { answerText } from "../recall/answer-text";
import { maskLineLabels } from "../../reveal/line-label-mask";
import { POSITION_PROPERTIES } from "../constants";
import { NumberLine, type NumberLineProps } from "./NumberLine";
import styles from "./figures.module.css";

const render = (props: NumberLineProps): string =>
  renderToStaticMarkup(createElement(NumberLine, props));

const base = {
  thenValue: "10",
  nowValue: "20",
  thenShown: "10",
  nowShown: "20",
  thenPeriod: "Sep 2024",
  nowPeriod: "Sep 2026",
  unit: "USD per gallon",
};

// Pull every `--name:value` pair out of the rendered style attribute.
const customProperties = (html: string): Array<[string, string]> => {
  const style = html.match(/style="([^"]*)"/)?.[1] ?? "";
  return [...style.matchAll(/(--[a-z-]+):([^;]+)/g)].map(
    (m) => [m[1], m[2]] as [string, string],
  );
};

describe("NumberLine places the Mark from the answer (R12.1, R10.3)", () => {
  it("draws no Mark element when there is no answer", () => {
    const html = render(base);
    expect(html).not.toContain(styles.markWrap);
    expect(html).not.toContain(styles.markStroke);
    expect(html).not.toContain("--pos-mark");
  });

  it("draws the Mark at --pos-mark from the answer", () => {
    // Range for 10 and 20: span 10, pad 2.5, width 15. pos(15) = 0.5.
    const html = render({ ...base, markValue: "15" });
    expect(html).toContain(styles.markWrap);
    expect(html).toContain("--pos-mark:0.5");
  });

  it("gives the pins their own positions from then and now", () => {
    const html = render({ ...base, markValue: "15" });
    expect(html).toContain("--pos-then:0.16666666666666666");
    expect(html).toContain("--pos-now:0.8333333333333334");
  });
});

describe("only the three position variables carry positions (R10.3)", () => {
  it("sets nothing but --pos-then, --pos-now and --pos-mark", () => {
    const names = customProperties(render({ ...base, markValue: "15" })).map(
      ([name]) => name,
    );
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(POSITION_PROPERTIES).toContain(name);
    }
  });

  it("sets no position variable without a Mark", () => {
    const names = customProperties(render(base)).map(([name]) => name);
    expect(names).not.toContain("--pos-mark");
  });
});

describe("the Mark's hidden text and the axis (R11.9, R12.4)", () => {
  it("speaks the typed answer with its unit, unchanged", () => {
    const html = render({ ...base, markValue: "15.50" });
    expect(html).toContain("Your answer: 15.50 USD per gallon");
  });

  it("keeps the axis, pins and stroke hidden from screen readers", () => {
    const html = render({ ...base, markValue: "15" });
    const hidden = html.match(/aria-hidden="true"/g) ?? [];
    // The axis, two pins, the Mark stroke and the three visible labels.
    expect(hidden.length).toBe(7);
  });

  it("shows no numbers of its own apart from the answer text", () => {
    const html = render(base);
    expect(html).not.toMatch(/>\s*\d/);
  });
});

describe("an out-of-range Mark looks the same at both edges (R12.3, Property 12)", () => {
  it("sits at 0 beyond the low end and at 1 beyond the high end", () => {
    expect(render({ ...base, markValue: "-1000" })).toContain("--pos-mark:0");
    expect(render({ ...base, markValue: "1000" })).toContain("--pos-mark:1");
  });

  it("differs between the two edges only in the position and the value text", () => {
    const low = render({ ...base, markValue: "-1000" });
    const high = render({ ...base, markValue: "1000" });
    const normalise = (html: string): string =>
      html
        .replace(/--pos-mark:[^;"]+/, "--pos-mark:X")
        .replace(/Your answer: [^<]*</, "Your answer: V<");
    expect(normalise(maskLineLabels(low))).toBe(normalise(maskLineLabels(high)));
  });
});

// --- Contrast of the axis, pins and Mark ring on the dark desk ---
const here = dirname(fileURLToPath(import.meta.url));
const figuresCss = readFileSync(join(here, "figures.module.css"), "utf8");
// Spec 07 R14.4: the axis is --line, the pins are --text and the Mark ring is
// --accent, all drawn on the scene --bg (scene/tokens.css). This reads the real
// hex values and checks the WCAG 2.2 relative-luminance ratio. Graphical objects
// need 3:1 (AA, non-text).

const sceneTokensCss = readFileSync(
  join(here, "..", "scene", "tokens.css"),
  "utf8",
);

const GRAPHIC_MIN = 3;

// Every declaration body for a class, including rules that share a selector list
// (for example `.pinThen, .pinNow { ... }`).
const declarationsFor = (css: string, className: string): string =>
  [...css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .filter(([, selectors]) =>
      selectors.split(",").some((sel) => sel.trim() === `.${className}`),
    )
    .map(([, , body]) => body)
    .join("\n");

const readToken = (css: string, token: string): string => {
  const match = css.match(new RegExp(`${token}\\s*:\\s*(#[0-9a-fA-F]{6})\\b`));
  if (!match) throw new Error(`token ${token} is not a 6-digit hex value`);
  return match[1].toLowerCase();
};

const luminance = (hex: string): number => {
  const channels = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("the Number_Line graphics clear 3:1 on the dark desk (WCAG 2.2 AA)", () => {
  it("names the line, pin, mark and surface tokens on the Number_Line", () => {
    expect(figuresCss).toMatch(/--figure-line:\s*var\(--line\)/);
    expect(figuresCss).toMatch(/--figure-pin:\s*var\(--text\)/);
    expect(figuresCss).toMatch(/--figure-mark:\s*var\(--accent\)/);
    expect(figuresCss).toMatch(/--figure-surface:\s*var\(--bg\)/);
  });

  it("draws the axis in --line, the pins in --text and the Mark ring in --accent", () => {
    expect(declarationsFor(figuresCss, "axis")).toMatch(/var\(--figure-line\)/);
    for (const name of ["pinThen", "pinNow"]) {
      expect(declarationsFor(figuresCss, name), name).toMatch(/var\(--figure-pin\)/);
    }
    expect(declarationsFor(figuresCss, "markStroke"), "markStroke").toMatch(
      /var\(--figure-mark\)/,
    );
  });

  it("uses no hard-coded colour for the graphics", () => {
    for (const name of ["axis", "pinThen", "pinNow", "markStroke"]) {
      expect(declarationsFor(figuresCss, name)).not.toMatch(/#[0-9a-fA-F]{3,6}\b|rgba?\(/);
    }
  });

  it("sits on the dark desk, never a paper surface", () => {
    expect(figuresCss).not.toMatch(/--figure-surface:[^;]*--paper/);
    expect(figuresCss).not.toMatch(/--paper/);
  });

  it("the --line axis, --text pin and --accent Mark clear 3:1 on --bg", () => {
    const bg = readToken(sceneTokensCss, "--bg");
    for (const token of ["--line", "--text", "--accent"]) {
      expect(contrast(readToken(sceneTokensCss, token), bg), token).toBeGreaterThanOrEqual(
        GRAPHIC_MIN,
      );
    }
  });

  it("the Stamp drop stop under prefers-reduced-motion is kept", () => {
    expect(figuresCss).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.drop\s*\{\s*animation:\s*none;?\s*\}\s*\}/,
    );
  });
});

// --- Number_Line labels and text alternative (spec 08 R5, Property 12) ---

describe("NumberLine labels (spec 08 R5.1, R5.2, R5.9)", () => {
  it("draws visible Then and Now labels with data-line-label, hidden from screen readers", () => {
    const html = render({ ...base, markValue: "15" });
    expect(html).toContain(`data-line-label="then"`);
    expect(html).toContain(`data-line-label="now"`);
    expect(html).toContain(`>${CEREMONY_COPY.lineThen}</span>`);
    expect(html).toContain(`>${CEREMONY_COPY.lineNow}</span>`);
    expect(html).toContain(styles.lineLabelMuted);
  });

  it("draws the answer label with only its value and unit, in the accent class (C3.3)", () => {
    const html = render({ ...base, markValue: "15.50" });
    expect(html).toContain(`data-line-label="answer"`);
    expect(html).toContain(`>15.50 USD per gallon</span>`);
    // The "Your answer" words sit in the Receipt_Card row, once, not here.
    expect(html).not.toContain(`>${CEREMONY_COPY.lineAnswer}</span>`);
    expect(html).toContain(styles.lineLabelAccent);
  });

  it("reads No answer in the answer label when there is no Mark (C3.3)", () => {
    const html = render(base);
    expect(html).toContain(`data-line-label="answer"`);
    expect(html).toContain(`>${CEREMONY_COPY.lineNoAnswer}</span>`);
    expect(html).not.toContain(`>${CEREMONY_COPY.lineAnswer}</span>`);
  });

  it("gives every visible label an inline position in px", () => {
    const html = render({ ...base, markValue: "15" });
    const labels = html.match(/<span[^>]*data-line-label="[^"]*"[^>]*>/g) ?? [];
    expect(labels).toHaveLength(3);
    for (const label of labels) {
      expect(label).toMatch(/left:[0-9.]+px/);
    }
  });
});

describe("NumberLine text alternative (spec 08 R5.8)", () => {
  it("names all three points on the root image with an answer", () => {
    const html = render({
      ...base,
      thenShown: "3.41",
      nowShown: "3.90",
      thenPeriod: "Sep 2024",
      nowPeriod: "Sep 2026",
      markValue: "3.50",
    });
    expect(html).toContain('role="img"');
    expect(html).toContain(
      'aria-label="Then 3.41 USD per gallon, Sep 2024. Now 3.90 USD per gallon, Sep 2026. Your answer 3.50 USD per gallon."',
    );
  });

  it("names the no-answer case in the text alternative", () => {
    const html = render({
      ...base,
      thenShown: "3.41",
      nowShown: "3.90",
      thenPeriod: "Sep 2024",
      nowPeriod: "Sep 2026",
    });
    expect(html).toContain(
      'aria-label="Then 3.41 USD per gallon, Sep 2024. Now 3.90 USD per gallon, Sep 2026. No answer."',
    );
  });
});

describe("Property 12: the text alternative and labels name the same points (R5.8, R12.3)", () => {
  it("for any answer or no answer, the labels and the text alternative match", () => {
    fc.assert(
      fc.property(
        fc.option(fc.integer({ min: -100000, max: 100000 }), { nil: null }),
        (answer) => {
          if (answer === null) {
            const html = render(base);
            // The third visible label reads "No answer" and the text alternative uses
            // numberLineAltNoAnswer with the same then and now points.
            expect(html).toContain(`data-line-label="answer"`);
            expect(html).toContain(`>${CEREMONY_COPY.lineNoAnswer}</span>`);
            expect(html).toContain(
              "Then 10 USD per gallon, Sep 2024. Now 20 USD per gallon, Sep 2026. No answer.",
            );
            return;
          }
          const value = (answer / 100).toFixed(2);
          const html = render({
            ...base,
            markValue: value,
          });
          expect(html).toContain(`>${answerText(value)} USD per gallon</span>`);
          expect(html).toContain(`Your answer ${answerText(value)} USD per gallon.`);
        },
      ),
      { numRuns: 100 },
    );
  });
});
