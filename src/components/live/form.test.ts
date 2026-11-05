import { describe, expect, it } from "vitest";

import { MAX_LETTER_CODE_POINTS } from "./constants";
import { countCodePoints, figureLimit, validateWrite } from "./form";

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
