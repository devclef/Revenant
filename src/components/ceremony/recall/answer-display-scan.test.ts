// Feature: 09-judge-polish, A9.2: one answer format.
//
// Every file that shows a judge's recorded answer must format it through
// answerText (recall/answer-text.ts). This is a source scan: each file must
// import answerText, and none may interpolate a raw answer value or call the
// old parsed-value formatter. The scan has a self-test on known-bad snippets,
// so it cannot pass by reading nothing.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const components = join(here, "..", "..");

/** The answer display files, relative to src/components. */
const ANSWER_DISPLAY_FILES = [
  "ceremony/recall/RecallPager.tsx",
  "ceremony/recall/RecordedScale.tsx",
  "ceremony/figures/NumberLine.tsx",
  "reveal/FigureEntry.tsx",
  "reveal/RememberedAnswers.tsx",
  "reveal/Reveal.tsx",
] as const;

/** Raw interpolations of an answer value. Each one is a display that skipped answerText. */
const RAW_ANSWER_FORMS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "${answer.value} in a template", pattern: /\$\{answer\.value\}/ },
  { name: "${markValue} in a template", pattern: /\$\{markValue\}/ },
  // A JSX child, not a prop: `value={markValue}` on a component is not a display.
  { name: "{answer.value} as JSX text", pattern: />\s*\{answer\.value\}/ },
  { name: "{markValue} as JSX text", pattern: />\s*\{markValue\}/ },
  { name: "answer: markValue in a copy fill", pattern: /answer:\s*markValue\b/ },
  { name: "formatParsedValue", pattern: /\bformatParsedValue\b/ },
];

/** Forms that show an answer through answerText, the only accepted route. */
const ANSWER_TEXT_CALL = /\banswerText\s*\(/;
const ANSWER_TEXT_IMPORT = /import\s*\{[^}]*\banswerText\b[^}]*\}\s*from\s*["'][^"']*answer-text["']/;

/** The first raw answer form found in source, or null. */
export function rawAnswerFormIn(source: string): string | null {
  for (const rule of RAW_ANSWER_FORMS) {
    if (rule.pattern.test(source)) return rule.name;
  }
  return null;
}

describe("the scanner flags what it should (self-test)", () => {
  it("flags a raw answer interpolation in JSX and in a template", () => {
    expect(rawAnswerFormIn("<span>{answer.value}</span>")).toBe("{answer.value} as JSX text");
    expect(rawAnswerFormIn("const s = `${answer.value} ${unit}`;")).toBe(
      "${answer.value} in a template",
    );
    expect(rawAnswerFormIn("<i>{markValue}</i>")).toBe("{markValue} as JSX text");
    expect(rawAnswerFormIn("<RecallScale value={markValue} />")).toBeNull();
  });

  it("flags the old parsed-value formatter", () => {
    expect(rawAnswerFormIn("value: formatParsedValue(resolved)")).toBe("formatParsedValue");
  });

  it("passes a display that goes through answerText", () => {
    expect(rawAnswerFormIn("<span>{answerText(answer.value)}</span>")).toBeNull();
    expect(ANSWER_TEXT_CALL.test("answerText(markValue)")).toBe(true);
  });
});

describe("answer display files format answers only through answerText (A9.2)", () => {
  for (const file of ANSWER_DISPLAY_FILES) {
    it(`${file} imports answerText and shows no raw answer`, () => {
      const source = readFileSync(join(components, file), "utf8");
      expect(source).toMatch(ANSWER_TEXT_IMPORT);
      expect(source).toMatch(ANSWER_TEXT_CALL);
      expect(rawAnswerFormIn(source)).toBeNull();
    });
  }
});
