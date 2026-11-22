import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

// Spec 16, requirement 1.8: each Field_Group is wrapped in KeepGroup, so the
// Keep_Hook measures the field the reader is typing in. RecallPager keeps its
// own hook call (Field_Group: the field and its Next or submit control).
// Source-level checks, like LiveStepper.keep-hook.test.ts.

const SRC = new URL("../", import.meta.url);

function read(path: string): string {
  return readFileSync(new URL(path, SRC), "utf8");
}

const CALL_SITES = [
  "live/desk/QuestionRow.tsx",
  "live/desk/LetterSheet.tsx",
  "live/WriteForm.tsx",
  "live/AuthorQuestions.tsx",
  "live/desk/OwnNumberView.tsx",
  "live/SelfReportedRows.tsx",
  "live/UnlockView.tsx",
] as const;

describe("KeepGroup call sites", () => {
  for (const path of CALL_SITES) {
    it(`${path} imports KeepGroup and renders it as a Field_Group`, () => {
      const source = read(path);
      expect(source).toMatch(
        /import \{ KeepGroup \} from "@\/components\/ui\/KeepGroup";/,
      );
      expect(source).toMatch(/<KeepGroup\s/);
      expect(source).toMatch(/<\/KeepGroup>/);
    });

    it(`${path} does not call the Keep_Hook directly`, () => {
      expect(read(path)).not.toMatch(/\buseKeepInVisualViewport\b/);
    });
  }

  it("RecallPager still calls the Keep_Hook on its own Field_Group", () => {
    const source = read("ceremony/recall/RecallPager.tsx");
    expect(source).toMatch(/useKeepInVisualViewport\(/);
  });
});

describe("focus after a press does not scroll the page (spec 16, requirement 1.1)", () => {
  it("AuthorQuestions focuses its new or edited row with preventScroll", () => {
    const source = read("live/AuthorQuestions.tsx");
    expect(source).toMatch(
      /addRef\.current\?\.focus\(\{ preventScroll: true \}\)/,
    );
    expect(source).toMatch(/\.focus\(\{ preventScroll: true \}\)/);
  });

  it("QuestionRow focuses the field on Edit with preventScroll", () => {
    const source = read("live/desk/QuestionRow.tsx");
    expect(source).toMatch(/el\.focus\(\{ preventScroll: true \}\);/);
  });
});
