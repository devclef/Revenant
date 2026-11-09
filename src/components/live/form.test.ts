import { describe, expect, it } from "vitest";

import { MAX_LETTER_CODE_POINTS } from "./constants";
import { countCodePoints, figureLimit, minFiguresFor, validateWrite } from "./form";

const VALID = {
  text: "Dear future me, the rent was high.",
  metricIds: ["us-gasoline-regular"],
  warningTicked: true,
};

describe("countCodePoints", () => {
  it("counts an empty string as zero", () => {
    expect(countCodePoints("")).toBe(0);
  });

  it("counts plain ASCII as one per character", () => {
    expect(countCodePoints("abc def")).toBe(7);
  });

  it("counts an accented letter once, even when written as two code points", () => {
    // "e" followed by a combining acute accent is two code points.
    expect(countCodePoints("e\u0301")).toBe(2);
    // A precomposed "é" is one code point.
    expect(countCodePoints("\u00e9")).toBe(1);
  });

  it("counts an astral emoji as one code point, although it is two UTF-16 units", () => {
    expect("\u{1F600}".length).toBe(2);
    expect(countCodePoints("\u{1F600}")).toBe(1);
  });
});

describe("validateWrite", () => {
  it("returns no problems for a valid write", () => {
    expect(validateWrite(VALID)).toEqual([]);
  });

  it("reports letter_empty for an empty letter", () => {
    expect(validateWrite({ ...VALID, text: "" })).toEqual(["letter_empty"]);
  });

  it("reports letter_empty for a letter of spaces, tabs and new lines only", () => {
    expect(validateWrite({ ...VALID, text: " \t\n  " })).toEqual(["letter_empty"]);
  });

  it("accepts a letter of exactly 5,000 code points", () => {
    const text = "a".repeat(MAX_LETTER_CODE_POINTS);
    expect(validateWrite({ ...VALID, text })).toEqual([]);
  });

  it("reports letter_too_long for 5,001 code points", () => {
    const text = "a".repeat(MAX_LETTER_CODE_POINTS + 1);
    expect(validateWrite({ ...VALID, text })).toEqual(["letter_too_long"]);
  });

  it("counts code points, not UTF-16 units, when checking the length", () => {
    // 5,000 emoji are 10,000 UTF-16 units but only 5,000 code points.
    const text = "\u{1F600}".repeat(MAX_LETTER_CODE_POINTS);
    expect(validateWrite({ ...VALID, text })).toEqual([]);
  });

  it("reports figures_none when no figure is chosen", () => {
    expect(validateWrite({ ...VALID, metricIds: [] })).toEqual(["figures_none"]);
  });

  it("accepts one and six figures", () => {
    expect(validateWrite({ ...VALID, metricIds: ["a"] })).toEqual([]);
    expect(
      validateWrite({ ...VALID, metricIds: ["a", "b", "c", "d", "e", "f"] }),
    ).toEqual([]);
  });

  it("reports figures_too_many for seven figures", () => {
    expect(
      validateWrite({ ...VALID, metricIds: ["a", "b", "c", "d", "e", "f", "g"] }),
    ).toEqual(["figures_too_many"]);
  });

  it("reports figures_too_many past the offered maximum of 4, not 6", () => {
    const four = ["a", "b", "c", "d"];
    expect(validateWrite({ ...VALID, metricIds: four, maxFigures: figureLimit(4) })).toEqual([]);
    expect(
      validateWrite({ ...VALID, metricIds: [...four, "e"], maxFigures: figureLimit(4) }),
    ).toEqual(["figures_too_many"]);
  });

  it("reports warning_unticked when the passkey warning is not ticked", () => {
    expect(validateWrite({ ...VALID, warningTicked: false })).toEqual([
      "warning_unticked",
    ]);
  });

  it("does not require the warning when the backup key card is ticked (R21.2)", () => {
    expect(validateWrite({ ...VALID, warningTicked: false, backupCardTicked: true })).toEqual([]);
  });

  it("still requires the warning when the backup key card is unticked", () => {
    expect(validateWrite({ ...VALID, warningTicked: false, backupCardTicked: false })).toEqual([
      "warning_unticked",
    ]);
  });

  it("reports every problem in the fixed order when everything fails", () => {
    expect(
      validateWrite({ text: "", metricIds: [], warningTicked: false }),
    ).toEqual(["letter_empty", "figures_none", "warning_unticked"]);
  });
});

describe("a real letter with a question needs no figure (C2.13)", () => {
  it("accepts 0 figures on /seal when one question has text", () => {
    expect(
      validateWrite({
        ...VALID,
        metricIds: [],
        mode: "real",
        questions: ["What did the kitchen smell of?"],
      }),
    ).toEqual([]);
  });

  it("still needs a figure on /seal when every question is blank", () => {
    expect(
      validateWrite({
        ...VALID,
        metricIds: [],
        mode: "real",
        questions: ["", "   "],
      }),
    ).toEqual(["figures_none"]);
  });

  it("still needs a figure on /demo/live even with a question", () => {
    expect(
      validateWrite({
        ...VALID,
        metricIds: [],
        mode: "demo",
        questions: ["What did the kitchen smell of?"],
      }),
    ).toEqual(["figures_none"]);
  });

  it("keeps the minimum at 1 for /demo/live and 0 for /seal with a question", () => {
    expect(minFiguresFor("demo", ["A question"])).toBe(1);
    expect(minFiguresFor("real", ["A question"])).toBe(0);
    expect(minFiguresFor("real", [])).toBe(1);
  });
});

describe("an Author_Question over 200 code points blocks sealing (C2.2)", () => {
  it("accepts a question of exactly 200 code points", () => {
    expect(validateWrite({ ...VALID, questions: ["a".repeat(200)] })).toEqual(
      [],
    );
  });

  it("reports question_too_long for 201 code points, counting an emoji once", () => {
    expect(validateWrite({ ...VALID, questions: ["a".repeat(201)] })).toEqual([
      "question_too_long",
    ]);
    // 199 letters and one emoji is 200 code points, so it is still valid.
    expect(
      validateWrite({ ...VALID, questions: [`${"a".repeat(199)}\u{1F600}`] }),
    ).toEqual([]);
  });

  it("ignores surrounding spaces when counting", () => {
    expect(
      validateWrite({ ...VALID, questions: [`  ${"a".repeat(200)}  `] }),
    ).toEqual([]);
  });
});
