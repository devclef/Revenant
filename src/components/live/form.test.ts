import { describe, expect, it } from "vitest";

import { MAX_LETTER_CODE_POINTS } from "./constants";
import {
  countCodePoints,
  figureLimit,
  minFiguresFor,
  selfReportedPeriodOk,
  selfReportedRowProblems,
  selfReportedTextOk,
  selfReportedValueOk,
  validateWrite,
  visibleSelfReportedProblems,
} from "./form";
import { LIVE_COPY } from "./copy";
import { INITIAL_TOUCHED, markAttempted, markTouched } from "./touched";

const SEALING_DAY = "2026-11-09";
const GOOD_ROW = {
  name: "Rent",
  value: "1200",
  unit: "EUR per month",
  region: "Stockholm",
  period: "2026-10",
};

describe("self-reported text bounds (1 to 60 characters after trimming)", () => {
  it("rejects an empty or spaces-only name", () => {
    expect(selfReportedTextOk("")).toBe(false);
    expect(selfReportedTextOk("   ")).toBe(false);
  });
  it("accepts 1 and 60 characters and rejects 61", () => {
    expect(selfReportedTextOk("a")).toBe(true);
    expect(selfReportedTextOk("a".repeat(60))).toBe(true);
    expect(selfReportedTextOk("a".repeat(61))).toBe(false);
  });
  it("counts trimmed length, so padding does not push a name over 60", () => {
    expect(selfReportedTextOk(`  ${"a".repeat(60)}  `)).toBe(true);
  });
  it("counts astral characters once", () => {
    expect(selfReportedTextOk("\u{1F600}".repeat(60))).toBe(true);
    expect(selfReportedTextOk("\u{1F600}".repeat(61))).toBe(false);
  });
});

describe("self-reported value bounds (0 to 999,999,999, at most 4 decimals)", () => {
  it("accepts 0 and the top of the range", () => {
    expect(selfReportedValueOk("0")).toBe(true);
    expect(selfReportedValueOk("999999999")).toBe(true);
  });
  it("rejects a value above 999,999,999", () => {
    expect(selfReportedValueOk("1000000000")).toBe(false);
    expect(selfReportedValueOk("999999999.0001")).toBe(false);
  });
  it("accepts up to 4 decimal places and rejects 5", () => {
    expect(selfReportedValueOk("3.4125")).toBe(true);
    expect(selfReportedValueOk("3.41250")).toBe(false);
  });
  it("rejects a sign, a comma, a letter and an empty value", () => {
    for (const bad of ["", "-1", "+1", "1,000", "12a", "."]) {
      expect(selfReportedValueOk(bad), bad).toBe(false);
    }
  });
  it("ignores surrounding spaces without rescaling the value", () => {
    expect(selfReportedValueOk(" 3.4125 ")).toBe(true);
  });
});

describe("self-reported period (a month or a date, not after the sealing day)", () => {
  it("accepts the sealing month and earlier months", () => {
    expect(selfReportedPeriodOk("2026-11", SEALING_DAY)).toBe(true);
    expect(selfReportedPeriodOk("2026-03", SEALING_DAY)).toBe(true);
  });
  it("rejects a month after the sealing month", () => {
    expect(selfReportedPeriodOk("2026-12", SEALING_DAY)).toBe(false);
  });
  it("accepts a date up to and including the sealing day", () => {
    expect(selfReportedPeriodOk("2026-11-09", SEALING_DAY)).toBe(true);
    expect(selfReportedPeriodOk("2026-11-08", SEALING_DAY)).toBe(true);
  });
  it("rejects a date after the sealing day", () => {
    expect(selfReportedPeriodOk("2026-11-10", SEALING_DAY)).toBe(false);
  });
  it("rejects dates that are not real calendar days", () => {
    expect(selfReportedPeriodOk("2026-02-30", SEALING_DAY)).toBe(false);
    expect(selfReportedPeriodOk("2026-13", SEALING_DAY)).toBe(false);
    expect(selfReportedPeriodOk("2026-00", SEALING_DAY)).toBe(false);
  });
  it("rejects any other shape", () => {
    for (const bad of ["", "2026", "09-2026", "2026/10", "October 2026", "2026-1"]) {
      expect(selfReportedPeriodOk(bad, SEALING_DAY), bad).toBe(false);
    }
  });
});

describe("selfReportedRowProblems", () => {
  it("returns no problems for a valid row", () => {
    expect(selfReportedRowProblems(GOOD_ROW, SEALING_DAY)).toEqual({});
  });

  it("names each broken field with the message key that says what is allowed", () => {
    const problems = selfReportedRowProblems(
      { name: "", value: "1.00001", unit: "", region: "x".repeat(61), period: "2026-12" },
      SEALING_DAY,
    );
    expect(problems).toEqual({
      name: "selfReportedTextLength",
      value: "selfReportedValue",
      unit: "selfReportedTextLength",
      region: "selfReportedTextLength",
      period: "selfReportedPeriod",
    });
  });

  it("maps every problem to a LIVE_COPY message that exists", () => {
    const problems = selfReportedRowProblems(
      { name: "", value: "", unit: "", region: "", period: "" },
      SEALING_DAY,
    );
    for (const key of Object.values(problems)) {
      expect(LIVE_COPY[key!]).toBeTruthy();
    }
  });
});

describe("validation messages show only after a touch or a seal attempt", () => {
  const problems = selfReportedRowProblems(
    { ...GOOD_ROW, value: "-1" },
    SEALING_DAY,
  );

  it("shows nothing on first load", () => {
    expect(visibleSelfReportedProblems(problems, INITIAL_TOUCHED, 0)).toEqual({});
  });

  it("shows the message for a field the visitor has touched, and only that field", () => {
    const touched = markTouched(INITIAL_TOUCHED, "self-reported:0:value");
    expect(visibleSelfReportedProblems(problems, touched, 0)).toEqual({
      value: "selfReportedValue",
    });
  });

  it("does not show a touched field of a different row", () => {
    const touched = markTouched(INITIAL_TOUCHED, "self-reported:1:value");
    expect(visibleSelfReportedProblems(problems, touched, 0)).toEqual({});
  });

  it("shows every problem after a seal attempt", () => {
    const attempted = markAttempted(INITIAL_TOUCHED);
    expect(visibleSelfReportedProblems(problems, attempted, 0)).toEqual({
      value: "selfReportedValue",
    });
  });
});

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

describe("figures unavailable: one non-empty question is enough (spec 11, X2.4)", () => {
  it("needs no figure in demo mode when the figures are loading or failed and a question is written", () => {
    expect(minFiguresFor("demo", ["What do you expect?"], true)).toBe(0);
  });

  it("still needs one figure in demo mode when the figures are ready", () => {
    expect(minFiguresFor("demo", ["What do you expect?"], false)).toBe(1);
  });

  it("still needs one figure when no question is written, even with figures unavailable", () => {
    expect(minFiguresFor("demo", [""], true)).toBe(1);
    expect(minFiguresFor("demo", [], true)).toBe(1);
  });

  it("does not let a figures outage pass a letter with a blank question", () => {
    const problems = validateWrite({
      text: "A letter",
      metricIds: [],
      warningTicked: true,
      questions: ["   "],
      mode: "demo",
      figuresUnavailable: true,
    });
    expect(problems).toContain("figures_none");
  });

  it("lets a letter with a question seal with no figure when figures are unavailable", () => {
    const problems = validateWrite({
      text: "A letter",
      metricIds: [],
      warningTicked: true,
      questions: ["What do you expect?"],
      mode: "demo",
      figuresUnavailable: true,
    });
    expect(problems).not.toContain("figures_none");
  });
});
