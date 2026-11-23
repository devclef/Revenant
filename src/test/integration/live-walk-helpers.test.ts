import { describe, expect, it } from "vitest";

import {
  EXPECTED_STEPS,
  MAX_PASSKEY_PROMPTS,
  MOTION_CONTROL_SELECTOR,
  PASSKEY_INIT_SCRIPT,
  NO_SEAL,
  breakSealMinWidth,
  checkBreakSealSize,
  checkDemoSeals,
  checkNoJsSeal,
  checkSealMarks,
  checkAccentButtonCount,
  checkFigureRowsNoAccent,
  checkPressEnvelopeClearOfText,
  checkPressStatusLine,
  checkStepTrackClearOfTopBar,
  checkTestifyCounter,
  checkTrackNames,
  LIVE_TRACK_NAMES,
  PERSONA_TRACK_NAMES,
  checkTopbarSlotStable,
  checkTamperRunNoPasskey,
  reliefPathOf,
  SKIP_LINK_STAGE,
  STEP_INDICATOR_EXPECTATIONS,
  STEP_SUSPECTED_FILES,
  WALK_STEP_NAMES,
  advanceSettle,
  checkClippedText,
  checkConsoleErrors,
  checkContrast,
  checkEarlyRelease,
  checkForbiddenFinalText,
  checkGhostClearOfKeep,
  checkHorizontalScroll,
  checkMotionControlCount,
  checkOwnNumberRowsBlank,
  checkPasskeyCount,
  checkPasskeyTotal,
  checkQuickPressAddsNone,
  checkRunShots,
  checkSealOrangeButtons,
  checkStepHeadingClearOfTopBar,
  checkStepIndicator,
  checkStepSnapshot,
  countPasskeyCalls,
  rectsIntersect,
  contrastFloor,
  contrastRatio,
  defectsFromChecks,
  expectedShotNames,
  findPlaceholderFigures,
  missingShotDefect,
  shotsMissingFromRecord,
  parseCssColor,
  recordStepResult,
  reportMissingShots,
  sealPressInput,
  shotsWrittenSince,
  skipLinkBlocksSettle,
  stepShotName,
  walkShotName,
  type BoxRect,
  type FigureRowPaint,
  buildReceiptsReport,
  checkPersonaDateStrings,
  checkSealedForDemoLine,
  checkWalkLetterText,
  expectedPersonaDates,
  expectedSealedForDemoLine,
  findSealedForDemoLine,
  findStaleWalkText,
  WALK_PERSONA_KEYS,
  type PersonaDateRow,
  type ReceiptFigureRead,
  type PageSnapshot,
} from "./live-walk-helpers";
import personaList from "../../../content/personas/personas.json";

describe("stepShotName", () => {
  it("names the first and last steps with a two-digit order", () => {
    expect(stepShotName({ step: "write", width: 1440, height: 900 })).toBe(
      "live-01-write-1440x900.png",
    );
    expect(stepShotName({ step: "tamper", width: 390, height: 844 })).toBe(
      "live-19-tamper-390x844.png",
    );
    expect(stepShotName({ step: "close", width: 390, height: 844 })).toBe(
      "live-17-close-390x844.png",
    );
  });

  it("follows the pattern at both widths", () => {
    expect(stepShotName({ step: "seal", width: 1440, height: 900 })).toBe(
      "live-06-seal-1440x900.png",
    );
    expect(stepShotName({ step: "seal", width: 390, height: 844 })).toBe(
      "live-06-seal-390x844.png",
    );
  });

  it("uses the two-digit order for every step in the walk", () => {
    const names = WALK_STEP_NAMES.map((step) =>
      stepShotName({ step, width: 390, height: 844 }).slice(0, 7),
    );
    expect(names).toEqual([
      "live-01",
      "live-02",
      "live-03",
      "live-04",
      "live-05",
      "live-06",
      "live-07",
      "live-08",
      "live-09",
      "live-10",
      "live-11",
      "live-12",
      "live-13",
      "live-14",
      "live-15",
      "live-16",
      "live-17",
      "live-18",
      "live-19",
    ]);
  });

  it("pins the walk's step names in order, with press-held and setting after seal and tamper last", () => {
    expect([...WALK_STEP_NAMES]).toEqual([
      "write",
      "write-occasion",
      "write-receipt",
      "write-failed",
      "write-receipts",
      "seal",
      "seal-before-choice",
      "seal-after-choice",
      "press-held",
      "setting",
      "wait",
      "open-letter",
      "remember",
      "marks",
      "letter",
      "figures",
      "close",
      "persona-read",
      "tamper",
    ]);
  });

  it("adds the -reduced suffix before .png when reduced motion is on", () => {
    expect(
      stepShotName({
        step: "figures",
        width: 1440,
        height: 900,
        reduced: true,
      }),
    ).toBe("live-16-figures-1440x900-reduced.png");
    expect(
      stepShotName({
        step: "figures",
        width: 390,
        height: 844,
        reduced: false,
      }),
    ).toBe("live-16-figures-390x844.png");
  });

  it("names the press and setting steps after seal, in walk order", () => {
    expect(stepShotName({ step: "press-held", width: 1440, height: 900 })).toBe(
      "live-09-press-held-1440x900.png",
    );
    expect(stepShotName({ step: "setting", width: 390, height: 844 })).toBe(
      "live-10-setting-390x844.png",
    );
  });

  it("names the step, not the Stage, for write-receipts", () => {
    expect(
      stepShotName({ step: "write-receipts", width: 390, height: 844 }),
    ).toBe("live-05-write-receipts-390x844.png");
  });

  it("throws on a step that is not in the walk", () => {
    expect(() =>
      stepShotName({ step: "press-seal", width: 390, height: 844 }),
    ).toThrow("Unknown walk step: press-seal");
  });
});

describe("expectedShotNames", () => {
  it("lists every step at both widths, with and without the reduced suffix", () => {
    const names = expectedShotNames("one-figure");
    expect(names).toHaveLength(19 * 2 * 2);
    expect(names).toContain("live-01-write-1440x900.png");
    expect(names).toContain("live-17-close-390x844-reduced.png");
    expect(names).toContain("live-19-tamper-1440x900-reduced.png");
    expect(new Set(names).size).toBe(names.length);
  });

  it("gives the no-figure variant the same names as the one-figure variant", () => {
    expect(EXPECTED_STEPS["no-figure"]).toEqual(EXPECTED_STEPS["one-figure"]);
    expect(expectedShotNames("no-figure")).toEqual(
      expectedShotNames("one-figure"),
    );
  });
});

describe("reportMissingShots", () => {
  it("passes when every expected shot is present", () => {
    const expected = expectedShotNames("one-figure");
    const report = reportMissingShots(expected, [...expected].reverse());
    expect(report.missing).toEqual([]);
    expect(report.lines).toEqual([
      `PASS all ${expected.length} Step_Shots present`,
    ]);
  });

  it("prints one FAIL line per missing shot", () => {
    const expected = [
      "live-01-write-1440x900.png",
      "live-02-write-receipts-1440x900.png",
      "live-03-seal-1440x900.png",
    ];
    const report = reportMissingShots(expected, [
      "live-01-write-1440x900.png",
      "live-03-seal-1440x900.png",
    ]);
    expect(report.missing).toEqual(["live-02-write-receipts-1440x900.png"]);
    expect(report.lines).toEqual([
      "FAIL missing Step_Shot live-02-write-receipts-1440x900.png",
    ]);
  });

  it("reports every missing shot when nothing is present", () => {
    const report = reportMissingShots(["a.png", "b.png"], []);
    expect(report.missing).toEqual(["a.png", "b.png"]);
    expect(report.lines).toHaveLength(2);
  });
});

describe("checkMotionControlCount", () => {
  it("passes for exactly one Motion_Control", () => {
    expect(checkMotionControlCount(1)).toEqual({
      ok: true,
      message: "PASS Motion_Control count 1",
    });
  });

  it("fails for zero or two or more", () => {
    for (const count of [0, 2, 3]) {
      const result = checkMotionControlCount(count);
      expect(result.ok).toBe(false);
      expect(result.message).toContain(`count ${count}, expected 1`);
    }
  });

  it("uses a case-insensitive aria-label match", () => {
    expect(MOTION_CONTROL_SELECTOR).toBe('button[aria-label*="motion" i]');
  });
});

describe("findPlaceholderFigures", () => {
  it("finds each placeholder string", () => {
    expect(findPlaceholderFigures("Petrol: 0.000 change")).toEqual(["0.000"]);
    expect(findPlaceholderFigures("Rent: 0.0% change")).toEqual(["0.0%"]);
    expect(findPlaceholderFigures("Groceries: unchanged")).toEqual([
      "unchanged",
    ]);
  });

  it("finds several placeholders in one text", () => {
    expect(findPlaceholderFigures("0.000 then, 0.0% now, unchanged")).toEqual([
      "0.000",
      "0.0%",
      "unchanged",
    ]);
  });

  it("returns nothing for a clean reveal", () => {
    expect(
      findPlaceholderFigures("$3.41 per gallon · Sep 2026 · U.S. city average"),
    ).toEqual([]);
  });

  it("does not match real values that contain a placeholder as a substring", () => {
    expect(findPlaceholderFigures("up 10.0% since last year")).toEqual([]);
    expect(findPlaceholderFigures("price 0.0001 per litre")).toEqual([]);
    expect(findPlaceholderFigures("total 100.000 units")).toEqual([]);
  });

  it("matches unchanged as a whole word in any case", () => {
    expect(findPlaceholderFigures("Unchanged since March")).toEqual([
      "unchanged",
    ]);
    expect(findPlaceholderFigures("unchangeable terms")).toEqual([]);
  });
});

describe("recordStepResult", () => {
  it("passes a step with no defects", () => {
    const result = recordStepResult({
      step: "seal",
      observation: "Seal screen shows the passkey prompt.",
      shots: ["live-03-seal-1440x900.png"],
      defects: [],
    });
    expect(result).toEqual({
      step: "seal",
      pass: true,
      observation: "Seal screen shows the passkey prompt.",
      shots: ["live-03-seal-1440x900.png"],
      defects: [],
    });
  });

  it("fails a step that has a defect and keeps the defect fields", () => {
    const result = recordStepResult({
      step: "figures",
      observation: "Figure row is clipped.",
      shots: ["live-11-figures-390x844.png"],
      defects: [
        {
          step: "figures",
          expected: "The figure text fits its card.",
          observed: "The figure text is cut off at the right edge.",
          suspectedFile: "src/components/reveal/FigureRow.tsx",
        },
      ],
    });
    expect(result.pass).toBe(false);
    expect(result.defects[0]).toMatchObject({
      step: "figures",
      suspectedFile: "src/components/reveal/FigureRow.tsx",
    });
  });

  it("copies the shots and defects so later edits do not change the record", () => {
    const shots = ["live-01-write-1440x900.png"];
    const defects = [
      {
        step: "write" as const,
        expected: "e",
        observed: "o",
        suspectedFile: "f",
      },
    ];
    const result = recordStepResult({
      step: "write",
      observation: "ok",
      shots,
      defects,
    });
    shots.push("other.png");
    defects[0].observed = "changed";
    expect(result.shots).toEqual(["live-01-write-1440x900.png"]);
    expect(result.defects[0].observed).toBe("o");
  });

  it("throws on a step that is not in the walk", () => {
    expect(() =>
      recordStepResult({
        step: "unknown",
        observation: "",
        shots: [],
        defects: [],
      }),
    ).toThrow("Unknown walk step: unknown");
  });
});

const CLEAN_SNAPSHOT: PageSnapshot = {
  scrollWidth: 390,
  clientWidth: 390,
  clipCandidates: [],
  contrastSamples: [],
  currentStep: "Break the seal",
  bodyText: "Your letter.",
  motionControls: 1,
  consoleErrors: [],
};

describe("parseCssColor", () => {
  it("reads rgb and rgba values, with alpha 1 when none is given", () => {
    expect(parseCssColor("rgb(255, 255, 255)")).toEqual({
      r: 255,
      g: 255,
      b: 255,
      a: 1,
    });
    expect(parseCssColor("rgba(0, 0, 0, 0.5)")).toEqual({
      r: 0,
      g: 0,
      b: 0,
      a: 0.5,
    });
    expect(parseCssColor("rgba(10, 20, 30, 50%)")?.a).toBeCloseTo(0.5);
  });

  it("returns null for colours it cannot read", () => {
    expect(parseCssColor("oklch(0.5 0.2 300)")).toBeNull();
    expect(parseCssColor("transparent-ish")).toBeNull();
  });
});

describe("contrastRatio and contrastFloor", () => {
  it("gives 21:1 for black on white and 1:1 for a colour on itself", () => {
    const white = { r: 255, g: 255, b: 255, a: 1 };
    const black = { r: 0, g: 0, b: 0, a: 1 };
    expect(contrastRatio(black, white)).toBeCloseTo(21, 5);
    expect(contrastRatio(white, white)).toBeCloseTo(1, 5);
  });

  it("uses 4.5:1 for body text and 3:1 for large text", () => {
    expect(contrastFloor({ fontSizePx: 16, fontWeight: 400 })).toBe(4.5);
    expect(contrastFloor({ fontSizePx: 24, fontWeight: 400 })).toBe(3);
    expect(contrastFloor({ fontSizePx: 18.66, fontWeight: 700 })).toBe(3);
    expect(contrastFloor({ fontSizePx: 18.66, fontWeight: 400 })).toBe(4.5);
  });
});

describe("checkContrast", () => {
  it("passes dark text on a white surface", () => {
    const result = checkContrast({
      text: "Break the seal",
      fg: "rgb(0, 0, 0)",
      bg: "rgb(255, 255, 255)",
      fontSizePx: 16,
      fontWeight: 400,
    });
    expect(result).toMatchObject({ measured: true, ok: true });
    expect(result.ratio).toBeCloseTo(21, 5);
  });

  it("fails grey text that is too close to its background", () => {
    const result = checkContrast({
      text: "Skip to the letter",
      fg: "rgb(150, 150, 150)",
      bg: "rgb(255, 255, 255)",
      fontSizePx: 16,
      fontWeight: 400,
    });
    expect(result.ok).toBe(false);
    expect(result.message.startsWith("FAIL")).toBe(true);
  });

  it("blends a translucent foreground before measuring", () => {
    // Opaque black at 0 alpha over white is white: contrast 1:1, a fail.
    const result = checkContrast({
      text: "ghost",
      fg: "rgba(0, 0, 0, 0)",
      bg: "rgb(255, 255, 255)",
      fontSizePx: 16,
      fontWeight: 400,
    });
    expect(result.ratio).toBeCloseTo(1, 5);
    expect(result.ok).toBe(false);
  });

  it("reports unmeasured runs without failing them", () => {
    const result = checkContrast({
      text: "over a gradient",
      fg: "rgb(255, 255, 255)",
      bg: null,
      fontSizePx: 16,
      fontWeight: 400,
    });
    expect(result).toMatchObject({ measured: false, ok: true, ratio: null });
    expect(result.message.startsWith("UNMEASURED")).toBe(true);
  });
});

describe("checkHorizontalScroll and checkClippedText", () => {
  it("fails when the document is wider than its viewport, allowing one pixel", () => {
    expect(checkHorizontalScroll(390, 390).ok).toBe(true);
    expect(checkHorizontalScroll(391, 390).ok).toBe(true);
    const wide = checkHorizontalScroll(420, 390);
    expect(wide.ok).toBe(false);
    expect(wide.message).toContain("scrollWidth 420");
  });

  it("flags only overflow-hidden containers whose content is wider than the box", () => {
    expect(
      checkClippedText([
        {
          tag: "p",
          text: "fits",
          scrollWidth: 100,
          clientWidth: 100,
          overflowX: "hidden",
          className: "",
        },
        {
          tag: "p",
          text: "wide",
          scrollWidth: 300,
          clientWidth: 100,
          overflowX: "visible",
          className: "",
        },
      ]).ok,
    ).toBe(true);
    const clipped = checkClippedText([
      {
        tag: "div",
        text: "Cut off",
        scrollWidth: 300,
        clientWidth: 100,
        overflowX: "hidden",
        className: "",
      },
    ]);
    expect(clipped.ok).toBe(false);
    expect(clipped.message).toContain('"Cut off"');
  });

  it("does not flag a visually hidden 1px container (the stepper and the announcer)", () => {
    const hidden = checkClippedText([
      {
        tag: "span",
        text: "Press the seal",
        scrollWidth: 86,
        clientWidth: 1,
        overflowX: "hidden",
        className: "stepper_name__3xKa",
      },
      {
        tag: "p",
        text: "Step 1 of 6: Write",
        scrollWidth: 135,
        clientWidth: 1,
        overflowX: "hidden",
        className: "stepper_announce__9fQ2 live_visuallyHidden__Lw1",
      },
    ]);
    expect(hidden.ok).toBe(true);
  });

  it("reports clipped text in a stepper-class container that is wider than 1px", () => {
    const clipped = checkClippedText([
      {
        tag: "span",
        text: "Press the seal",
        scrollWidth: 300,
        clientWidth: 100,
        overflowX: "hidden",
        className: "stepper_name__3xKa",
      },
    ]);
    expect(clipped.ok).toBe(false);
    expect(clipped.message).toContain('"Press the seal"');
    expect(clipped.message).toContain("(300 > 100)");
  });

  it("still reports clipped text in a 1px-wide container without a hidden-by-design class", () => {
    const clipped = checkClippedText([
      {
        tag: "span",
        text: "Clipped label",
        scrollWidth: 120,
        clientWidth: 1,
        overflowX: "hidden",
        className: "live_label__Qz8",
      },
    ]);
    expect(clipped.ok).toBe(false);
    expect(clipped.message).toContain('"Clipped label"');
    expect(clipped.message).toContain("(120 > 1)");
  });
});

describe("checkStepIndicator", () => {
  it("passes when the current item matches the step", () => {
    expect(checkStepIndicator("Break the seal", /^break the seal$/i).ok).toBe(
      true,
    );
  });

  it("fails when the current item disagrees or is missing", () => {
    expect(checkStepIndicator("Remember", /^break the seal$/i).ok).toBe(false);
    expect(checkStepIndicator(null, /^break the seal$/i).message).toContain(
      "missing",
    );
  });
});

describe("checkForbiddenFinalText and checkConsoleErrors", () => {
  it("fails on each forbidden string in the final reveal", () => {
    expect(checkForbiddenFinalText("Rent: 10.0% change").ok).toBe(true);
    expect(checkForbiddenFinalText("unchanged").ok).toBe(false);
    expect(checkForbiddenFinalText("Change 0.0%").ok).toBe(false);
  });

  it("fails on any console error", () => {
    expect(checkConsoleErrors([]).ok).toBe(true);
    const failed = checkConsoleErrors(["Failed to load resource"]);
    expect(failed.ok).toBe(false);
    expect(failed.message).toContain("1 console error");
  });
});

describe("checkStepSnapshot and defectsFromChecks", () => {
  it("passes a clean snapshot at a step with no extra expectation", () => {
    const checks = checkStepSnapshot("write", CLEAN_SNAPSHOT);
    expect(checks.every((c) => c.ok)).toBe(true);
  });

  it("fails a Motion_Control count of two at any step", () => {
    const checks = checkStepSnapshot("write", {
      ...CLEAN_SNAPSHOT,
      motionControls: 2,
    });
    expect(defectsFromChecks("write", checks)).toHaveLength(1);
  });

  it("checks the Step_Indicator only at steps that have an expectation", () => {
    const wrongItem = { ...CLEAN_SNAPSHOT, currentStep: "Remember" };
    expect(
      defectsFromChecks("marks", checkStepSnapshot("marks", wrongItem)).map(
        (d) => d.observed,
      ),
    ).toHaveLength(1);
    expect(
      checkStepSnapshot("write", wrongItem).some((c) =>
        c.expected.includes("Step_Indicator"),
      ),
    ).toBe(false);
  });

  it("checks forbidden strings only at figures and close", () => {
    const withPlaceholder = {
      ...CLEAN_SNAPSHOT,
      currentStep: "Receipts",
      bodyText: "unchanged 0.000 0.0%",
    };
    expect(
      defectsFromChecks("close", checkStepSnapshot("close", withPlaceholder)),
    ).toHaveLength(1);
    expect(
      defectsFromChecks("letter", checkStepSnapshot("letter", withPlaceholder)),
    ).toHaveLength(0);
  });

  it("checks the typed letter text on the letter stage only when given", () => {
    const onLetter = { ...CLEAN_SNAPSHOT, currentStep: "Receipts" };
    const missing = checkStepSnapshot("letter", onLetter, {
      letterText: "Walk letter",
    });
    expect(defectsFromChecks("letter", missing)).toHaveLength(1);
    expect(
      defectsFromChecks("letter", checkStepSnapshot("letter", onLetter)),
    ).toHaveLength(0);
  });

  it("records each failing check as a defect with the step's suspected file", () => {
    const defects = defectsFromChecks("figures", [
      { ok: false, expected: "x", message: "FAIL y" },
      { ok: true, expected: "z", message: "PASS z" },
    ]);
    expect(defects).toEqual([
      {
        step: "figures",
        expected: "x",
        observed: "FAIL y",
        suspectedFile: STEP_SUSPECTED_FILES.figures,
      },
    ]);
  });

  it("names a suspected file for every step", () => {
    for (const step of WALK_STEP_NAMES) {
      expect(STEP_SUSPECTED_FILES[step].length).toBeGreaterThan(0);
    }
  });
});

describe("checkStepSnapshot contrast run states", () => {
  const sample = (fg: string, bg: string | null) => ({
    text: "Break the seal",
    fg,
    bg,
    fontSizePx: 16,
    fontWeight: 400,
  });
  const contrastCheck = (contrastSamples: PageSnapshot["contrastSamples"]) =>
    checkStepSnapshot("write", { ...CLEAN_SNAPSHOT, contrastSamples }).find(
      (c) => c.expected.includes("contrast floor"),
    );

  it("passes a measured run that is above its floor", () => {
    const check = contrastCheck([sample("rgb(0, 0, 0)", "rgb(255, 255, 255)")]);
    expect(check?.ok).toBe(true);
    expect(check?.message).toBe(
      "PASS contrast on 1 measured text run(s), 0 unmeasured",
    );
  });

  it("fails a measured run that is below its floor", () => {
    const check = contrastCheck([
      sample("rgb(150, 150, 150)", "rgb(255, 255, 255)"),
    ]);
    expect(check?.ok).toBe(false);
    expect(check?.message.startsWith("FAIL 1 text run(s)")).toBe(true);
    expect(check?.message).toContain("(0 unmeasured)");
  });

  it("fails an unmeasured run as a visible defect, not a PASS with a count", () => {
    const check = contrastCheck([sample("rgb(255, 255, 255)", null)]);
    expect(check?.ok).toBe(false);
    expect(check?.message.startsWith("FAIL 1 text run(s)")).toBe(true);
    expect(check?.message).toContain("(1 unmeasured)");
    expect(check?.message).toContain("UNMEASURED");
    expect(check?.message.startsWith("PASS")).toBe(false);
  });

  it("reports a mixed snapshot as a defect and counts the unmeasured run", () => {
    const check = contrastCheck([
      sample("rgb(0, 0, 0)", "rgb(255, 255, 255)"),
      sample("rgb(255, 255, 255)", null),
    ]);
    expect(check?.ok).toBe(false);
    expect(check?.message).toContain("(1 unmeasured)");
  });
});

describe("walkShotName", () => {
  it("keeps the spec name for the default hold method", () => {
    expect(
      walkShotName({ step: "marks", width: 1440, height: 900, method: "hold" }),
    ).toBe("live-14-marks-1440x900.png");
  });

  it("adds the method and the reduced suffix for the other runs", () => {
    expect(
      walkShotName({
        step: "close",
        width: 390,
        height: 844,
        reduced: true,
        method: "skip",
      }),
    ).toBe("live-17-close-390x844-reduced-via-skip.png");
  });
});

describe("checkRunShots (per-run missing Step_Shot check)", () => {
  it("passes for one run whose shots are all present", () => {
    const expected = expectedShotNames("no-figure");
    const result = checkRunShots(expected, expected);
    expect(result.ok).toBe(true);
    expect(result.missing).toEqual([]);
    expect(result.lines).toEqual([
      `PASS all ${expected.length} Step_Shots present`,
    ]);
  });

  it("fails and names the missing file when a run wrote fewer shots", () => {
    const expected = [
      stepShotName({ step: "write", width: 390, height: 844 }),
      stepShotName({ step: "seal", width: 390, height: 844 }),
    ];
    const result = checkRunShots(expected, [expected[0]]);
    expect(result.ok).toBe(false);
    expect(result.lines).toEqual([
      "FAIL missing Step_Shot live-06-seal-390x844.png",
    ]);
  });

  it("checks each variant against its own run, so the other run's files do not count", () => {
    // The no-figure run wrote every shot. The one-figure run then wrote none.
    // Checked straight after each run, the one-figure check must fail even
    // though the same file names exist from the earlier run.
    const names = expectedShotNames("one-figure");
    const afterNoFigure = checkRunShots(names, names);
    expect(afterNoFigure.ok).toBe(true);
    const afterOneFigure = checkRunShots(names, []);
    expect(afterOneFigure.ok).toBe(false);
    expect(afterOneFigure.missing).toHaveLength(names.length);
  });
});

describe("shotsWrittenSince (run-scoped Step_Shot files)", () => {
  const runStart = 1_700_000_000_000;

  it("counts a file written at or after the run start", () => {
    expect(
      shotsWrittenSince(
        [
          { name: "a.png", mtimeMs: runStart },
          { name: "b.png", mtimeMs: runStart + 4_000 },
        ],
        runStart,
      ),
    ).toEqual(["a.png", "b.png"]);
  });

  it("does not count a file written before the run start", () => {
    expect(
      shotsWrittenSince([{ name: "a.png", mtimeMs: runStart - 1 }], runStart),
    ).toEqual([]);
  });

  it("fails the run when every file on disk is stale", () => {
    const expected = expectedShotNames("one-figure");
    const stale = expected.map((name) => ({
      name,
      mtimeMs: runStart - 60_000,
    }));
    const result = checkRunShots(expected, shotsWrittenSince(stale, runStart));
    expect(result.ok).toBe(false);
    expect(result.missing).toHaveLength(expected.length);
  });

  it("passes the run when every file is fresh, even if an old copy also exists", () => {
    const expected = expectedShotNames("no-figure");
    const stale = expected.map((name) => ({
      name,
      mtimeMs: runStart - 60_000,
    }));
    const fresh = expected.map((name) => ({ name, mtimeMs: runStart + 1 }));
    const result = checkRunShots(
      expected,
      shotsWrittenSince([...stale, ...fresh], runStart),
    );
    expect(result.ok).toBe(true);
  });
});

describe("skipLinkBlocksSettle (Skip_Link rule for the settle wait)", () => {
  it("waits for a visible Skip_Link on every stage except marks", () => {
    expect(SKIP_LINK_STAGE).toBe("marks");
    expect(skipLinkBlocksSettle("letter", true)).toBe(true);
    expect(skipLinkBlocksSettle("recall", true)).toBe(true);
    expect(skipLinkBlocksSettle("close", true)).toBe(true);
  });

  it("ignores a visible Skip_Link on marks, where it stays up by design", () => {
    expect(skipLinkBlocksSettle("marks", true)).toBe(false);
  });

  it("does not block once the Skip_Link is gone", () => {
    expect(skipLinkBlocksSettle("letter", false)).toBe(false);
    expect(skipLinkBlocksSettle("marks", false)).toBe(false);
  });
});

describe("checkOwnNumberRowsBlank", () => {
  it("passes with no own-number inputs, and says so without claiming rows", () => {
    const result = checkOwnNumberRowsBlank([]);
    expect(result.ok).toBe(true);
    expect(result.count).toBe(0);
    expect(result.message).toBe("PASS no own-number rows added");
    expect(result.message).not.toContain("all empty");
  });

  it("passes with blank inputs and reports the count it saw", () => {
    const result = checkOwnNumberRowsBlank(["", "   "]);
    expect(result.ok).toBe(true);
    expect(result.count).toBe(2);
    expect(result.message).toBe(
      "PASS own-number rows blank (2 input(s), all empty)",
    );
  });

  it("fails when any own-number input holds text", () => {
    const result = checkOwnNumberRowsBlank(["", "1200", ""]);
    expect(result.ok).toBe(false);
    expect(result.count).toBe(3);
    expect(result.message).toBe(
      "FAIL 1 own-number row input(s) hold text, so the rows are not blank",
    );
  });
});

describe("advanceSettle (stable-wait condition)", () => {
  const start = { last: "", since: 0 };

  it("never settles on the poll where the state first appears", () => {
    const step = advanceSettle(start, "write|0", 1000, 300);
    expect(step.settled).toBe(false);
    expect(step.next).toEqual({ last: "write|0", since: 1000 });
  });

  it("settles once the same state has held for the full window", () => {
    const first = advanceSettle(start, "letter|0", 1000, 300);
    const early = advanceSettle(first.next, "letter|0", 1299, 300);
    expect(early.settled).toBe(false);
    const late = advanceSettle(early.next, "letter|0", 1300, 300);
    expect(late.settled).toBe(true);
  });

  it("restarts the clock when a running animation count changes", () => {
    const first = advanceSettle(start, "figures|0", 1000, 300);
    const moving = advanceSettle(first.next, "figures|2", 1400, 300);
    expect(moving.settled).toBe(false);
    expect(moving.next).toEqual({ last: "figures|2", since: 1400 });
    const still = advanceSettle(moving.next, "figures|2", 1600, 300);
    expect(still.settled).toBe(false);
  });

  it("does not settle on a stage change even if the window has passed", () => {
    const first = advanceSettle(start, "recall|0", 0, 300);
    const changed = advanceSettle(first.next, "marks|0", 5000, 300);
    expect(changed.settled).toBe(false);
  });
});

describe("missingShotDefect (a step with no Step_Shot fails)", () => {
  it("returns null when the Step_Shot was saved", () => {
    expect(
      missingShotDefect({
        step: "letter",
        shot: "live-10-letter-1440x900.png",
        expectedName: "live-10-letter-1440x900.png",
        suspectedFile: "src/components/ceremony/letter/",
      }),
    ).toBeNull();
  });

  it("returns a defect naming the expected shot when none was saved", () => {
    const defect = missingShotDefect({
      step: "close",
      shot: undefined,
      expectedName: "live-12-close-390x844.png",
      suspectedFile: "src/components/ceremony/close/",
    });
    expect(defect).toEqual({
      step: "close",
      expected: "A Step_Shot named live-12-close-390x844.png is saved for this step.",
      observed: "No Step_Shot was saved for this step.",
      suspectedFile: "src/components/ceremony/close/",
    });
  });
});

describe("shotsMissingFromRecord (each shot is named in the run record)", () => {
  it("returns nothing when every expected shot is named", () => {
    const record =
      "write: PASS. Shot: qa-shots/live-walk/live-01-write-1440x900.png\n" +
      "seal: PASS. Shot: qa-shots/live-walk/live-03-seal-1440x900.png";
    expect(
      shotsMissingFromRecord(record, [
        "live-01-write-1440x900.png",
        "live-03-seal-1440x900.png",
      ]),
    ).toEqual([]);
  });

  it("lists an expected shot that the record does not name", () => {
    const record = "write: PASS. Shot: qa-shots/live-walk/live-01-write-1440x900.png";
    expect(
      shotsMissingFromRecord(record, [
        "live-01-write-1440x900.png",
        "live-12-close-1440x900.png",
      ]),
    ).toEqual(["live-12-close-1440x900.png"]);
  });
});

/** Run the init script against a fake `window` with a `navigator.credentials` double. */
function runPasskeyScript(credentials: Record<string, unknown> | null) {
  const win: Record<string, unknown> = {
    navigator: credentials === null ? {} : { credentials },
  };
  win.window = win;
  // The script refers to `window` and `navigator` as free identifiers.
  new Function("window", "navigator", PASSKEY_INIT_SCRIPT)(win, win.navigator);
  return win;
}

describe("PASSKEY_INIT_SCRIPT (passkey prompt counter)", () => {
  it("records create and get calls and still returns the real result", async () => {
    const creds = {
      create: async (opts: unknown) => `created:${String(opts)}`,
      get: async () => "assertion",
    };
    const win = runPasskeyScript(creds);
    expect(win.__passkeyCalls).toEqual([]);
    await expect(creds.create("a")).resolves.toBe("created:a");
    await (creds as unknown as { get: () => Promise<string> }).get();
    expect(win.__passkeyCalls).toEqual(["create", "get"]);
  });

  it("counts a rejected prompt as well", async () => {
    const creds = {
      create: async () => {
        throw new Error("NotAllowedError");
      },
    };
    const win = runPasskeyScript(creds);
    await expect(creds.create()).rejects.toThrow("NotAllowedError");
    expect(win.__passkeyCalls).toEqual(["create"]);
  });

  it("sets an empty list and does not throw without navigator.credentials", () => {
    const win = runPasskeyScript(null);
    expect(win.__passkeyCalls).toEqual([]);
  });
});

describe("countPasskeyCalls and the passkey checks", () => {
  it("counts create, get and the total", () => {
    expect(countPasskeyCalls(["create", "get", "get"])).toEqual({
      create: 1,
      get: 2,
      total: 3,
    });
    expect(countPasskeyCalls(["bogus"])).toEqual({
      create: 0,
      get: 0,
      total: 0,
    });
  });

  it("an early release passes only with create 0 and no credential", () => {
    const none = countPasskeyCalls([]);
    expect(checkEarlyRelease(none, 0).ok).toBe(true);
    expect(checkEarlyRelease(countPasskeyCalls(["create"]), 0).ok).toBe(false);
    expect(checkEarlyRelease(none, 1).ok).toBe(false);
  });

  it("a release after the hold needs exactly one create", () => {
    const one = countPasskeyCalls(["create"]);
    expect(checkPasskeyCount(one, { create: 1 }, "release").ok).toBe(true);
    const two = countPasskeyCalls(["create", "create"]);
    const bad = checkPasskeyCount(two, { create: 1 }, "release");
    expect(bad.ok).toBe(false);
    expect(bad.message).toBe("FAIL release: create 2, expected 1");
  });

  it("the Setting_State press needs exactly one get", () => {
    expect(
      checkPasskeyCount(countPasskeyCalls(["get"]), { get: 1 }, "setting").ok,
    ).toBe(true);
    expect(
      checkPasskeyCount(countPasskeyCalls([]), { get: 1 }, "setting").ok,
    ).toBe(false);
  });

  it("checks only the kinds it is given", () => {
    const counts = countPasskeyCalls(["get"]);
    expect(checkPasskeyCount(counts, { create: 0 }, "x").ok).toBe(true);
  });

  it("fails above the two-prompt cap and passes at it", () => {
    expect(MAX_PASSKEY_PROMPTS).toBe(2);
    expect(checkPasskeyTotal(countPasskeyCalls(["create", "get"])).ok).toBe(
      true,
    );
    const over = checkPasskeyTotal(countPasskeyCalls(["create", "get", "get"]));
    expect(over.ok).toBe(false);
    expect(over.message).toBe("FAIL more than two passkey prompts: 3 seen");
  });

  it("a second quick press during a prompt must add none", () => {
    expect(checkQuickPressAddsNone(1, 1).ok).toBe(true);
    const bad = checkQuickPressAddsNone(1, 2);
    expect(bad.ok).toBe(false);
    expect(bad.message).toBe(
      "FAIL a second quick press added 1 passkey prompt(s)",
    );
  });
});

describe("rectsIntersect and the layout rules", () => {
  const box = (
    top: number,
    left: number,
    bottom: number,
    right: number,
  ): BoxRect => ({
    top,
    left,
    bottom,
    right,
  });

  it("detects overlap in both axes, and not edges that only touch", () => {
    expect(rectsIntersect(box(0, 0, 10, 10), box(5, 5, 15, 15))).toBe(true);
    expect(rectsIntersect(box(0, 0, 10, 10), box(10, 0, 20, 10))).toBe(false);
    expect(rectsIntersect(box(0, 0, 10, 10), box(0, 10, 10, 20))).toBe(false);
    expect(rectsIntersect(box(0, 0, 0, 10), box(0, 0, 10, 10))).toBe(false);
  });

  it("fails a Step_Heading box under the Top_Bar", () => {
    const topBar = box(0, 0, 60, 390);
    expect(checkStepHeadingClearOfTopBar(box(80, 0, 120, 390), topBar).ok).toBe(
      true,
    );
    const under = checkStepHeadingClearOfTopBar(box(40, 0, 90, 390), topBar);
    expect(under.ok).toBe(false);
    expect(under.message).toBe(
      "FAIL the Step_Heading box (top 40, bottom 90) overlaps the Top_Bar (bottom 60)",
    );
  });

  it("fails a risen ghost that intersects the Keep_Section", () => {
    const keep = box(500, 0, 600, 1440);
    expect(checkGhostClearOfKeep(box(100, 500, 300, 900), keep).ok).toBe(true);
    expect(checkGhostClearOfKeep(box(450, 500, 550, 900), keep).ok).toBe(false);
  });

  it("allows only the Press_Envelope as an orange button on the Seal step", () => {
    expect(
      checkSealOrangeButtons([
        { label: "Press the seal", isPressEnvelope: true },
      ]).ok,
    ).toBe(true);
    expect(checkSealOrangeButtons([]).ok).toBe(true);
    const bad = checkSealOrangeButtons([
      { label: "Press the seal", isPressEnvelope: true },
      { label: "Lock it", isPressEnvelope: false },
    ]);
    expect(bad.ok).toBe(false);
    expect(bad.message).toBe(
      'FAIL 1 other orange button(s) on the Seal step: "Lock it"',
    );
  });
});

describe("reliefPathOf", () => {
  it("reads the d attributes and ignores clip ids", () => {
    const a = `<svg data-seal-hash="x"><clipPath id="wax-seal-r1-left"></clipPath><path clip-path="url(#wax-seal-r1-left)" d="M 0 0  L 1 1"/></svg>`;
    const b = `<svg data-seal-hash="x"><clipPath id="wax-seal-r9-left"></clipPath><path clip-path="url(#wax-seal-r9-left)" d="M 0 0 L 1 1"/></svg>`;
    expect(reliefPathOf(a)).toBe("M 0 0 L 1 1");
    expect(reliefPathOf(a)).toBe(reliefPathOf(b));
  });

  it("returns an empty string when there is no path", () => {
    expect(reliefPathOf("<svg></svg>")).toBe("");
  });
});

describe("checkSealMarks (Q1.3)", () => {
  const mark = {
    hash: "a".repeat(64),
    coarse: "n4-r1",
    markup: '<svg><path d="M 0 0 L 2 2"/></svg>',
  };

  it("passes when the Wait step and Break the seal match", () => {
    const check = checkSealMarks(mark, { ...mark });
    expect(check.ok).toBe(true);
    expect(check.message.startsWith("PASS")).toBe(true);
  });

  it("fails and names data-seal-hash when the hashes differ", () => {
    const check = checkSealMarks(mark, { ...mark, hash: "b".repeat(64) });
    expect(check.ok).toBe(false);
    expect(check.message).toContain("data-seal-hash");
  });

  it("fails and names data-coarse when the coarse signatures differ", () => {
    const check = checkSealMarks(mark, { ...mark, coarse: "n5-r1" });
    expect(check.ok).toBe(false);
    expect(check.message).toContain("data-coarse");
  });

  it("fails and names the relief path when the drawn paths differ", () => {
    const check = checkSealMarks(mark, {
      ...mark,
      markup: '<svg><path d="M 0 0 L 3 3"/></svg>',
    });
    expect(check.ok).toBe(false);
    expect(check.message).toContain("relief path");
  });

  it("fails when the seal is missing on one stage", () => {
    const check = checkSealMarks(NO_SEAL, mark);
    expect(check.ok).toBe(false);
    expect(check.message).toContain("missing on one stage");
  });
});

describe("checkNoJsSeal (Q1.4)", () => {
  it("passes when the landing seal marker is in the server HTML", () => {
    const html = '<div class="sealBox" data-landing-seal="">';
    expect(checkNoJsSeal("/", html).ok).toBe(true);
  });

  it("passes when an svg with data-seal-hash is in the server HTML", () => {
    const html = `<svg width="96" data-seal-hash="${"c".repeat(64)}" data-coarse="n4"></svg>`;
    expect(checkNoJsSeal("/demo", html).ok).toBe(true);
  });

  it("fails when no seal marker is in the HTML", () => {
    const check = checkNoJsSeal("/demo", "<main>Nothing drawn here</main>");
    expect(check.ok).toBe(false);
    expect(check.message).toContain("/demo");
  });

  it("does not count a seal hash on a non-svg element", () => {
    const html = `<div data-seal-hash="${"c".repeat(64)}"></div>`;
    expect(checkNoJsSeal("/l/x", html).ok).toBe(false);
  });
});

describe("breakSealMinWidth and checkBreakSealSize (U8)", () => {
  it("uses 160 px at 1440 and 120 px at 390", () => {
    expect(breakSealMinWidth(1440)).toBe(160);
    expect(breakSealMinWidth(390)).toBe(120);
  });

  const viewport = { width: 1440, height: 900 };
  const box = (left: number, top: number, size: number) => ({
    left,
    top,
    right: left + size,
    bottom: top + size,
  });

  it("passes a seal at least the minimum and inside the viewport", () => {
    expect(checkBreakSealSize(box(600, 200, 170), viewport, 160).ok).toBe(true);
  });

  it("fails a seal narrower than the minimum", () => {
    const check = checkBreakSealSize(box(600, 200, 150), viewport, 160);
    expect(check.ok).toBe(false);
    expect(check.message).toContain("150 px");
  });

  it("fails a seal that sits outside the viewport", () => {
    const check = checkBreakSealSize(box(1400, 200, 170), viewport, 160);
    expect(check.ok).toBe(false);
    expect(check.message).toContain("outside the viewport");
  });

  it("fails when no seal was measured", () => {
    expect(checkBreakSealSize(null, viewport, 160).ok).toBe(false);
  });
});

describe("checkDemoSeals (U9)", () => {
  const seal = (coarse: string | null, width = 96) => ({ width, coarse });

  it("passes three 96 px seals with three different data-coarse values", () => {
    const check = checkDemoSeals([seal("a"), seal("b"), seal("c")]);
    expect(check.ok).toBe(true);
  });

  it("fails when /demo does not draw three seals", () => {
    expect(checkDemoSeals([seal("a"), seal("b")]).ok).toBe(false);
  });

  it("fails a seal that is not 96 px wide", () => {
    const check = checkDemoSeals([seal("a"), seal("b"), seal("c", 60)]);
    expect(check.ok).toBe(false);
    expect(check.message).toContain("60 px");
  });

  it("fails when two seals share a data-coarse value", () => {
    expect(checkDemoSeals([seal("a"), seal("a"), seal("c")]).ok).toBe(false);
  });

  it("fails when a seal has no data-coarse value", () => {
    expect(checkDemoSeals([seal("a"), seal("b"), seal(null)]).ok).toBe(false);
  });
});

describe("checkTamperRunNoPasskey", () => {
  it("passes when the persona tamper run made no passkey prompt", () => {
    expect(checkTamperRunNoPasskey({ create: 0, get: 0, total: 0 }).ok).toBe(
      true,
    );
  });

  it("fails when the run made a create or get call", () => {
    expect(checkTamperRunNoPasskey({ create: 1, get: 0, total: 1 }).ok).toBe(
      false,
    );
  });
});

describe("sealPressInput (how each walk run presses the seal, Q1.3)", () => {
  it("presses Space on the keyboard run at every width and motion setting", () => {
    expect(
      sealPressInput({ width: 1440, reduced: false, keyboard: true }),
    ).toBe("keyboard");
    expect(sealPressInput({ width: 390, reduced: false, keyboard: true })).toBe(
      "keyboard",
    );
    expect(sealPressInput({ width: 1440, reduced: true, keyboard: true })).toBe(
      "keyboard",
    );
  });

  it("holds with the mouse at desktop, touches at phone width, and clicks once when reduced", () => {
    expect(
      sealPressInput({ width: 1440, reduced: false, keyboard: false }),
    ).toBe("hold");
    expect(
      sealPressInput({ width: 390, reduced: false, keyboard: false }),
    ).toBe("touch");
    expect(
      sealPressInput({ width: 1440, reduced: true, keyboard: false }),
    ).toBe("click");
  });
});

describe("WALK_STEP_NAMES numbering and STEP_INDICATOR_EXPECTATIONS (Q1.3, Q1.4)", () => {
  it("has nineteen steps, each numbered by its place in WALK_STEP_NAMES", () => {
    expect(WALK_STEP_NAMES).toHaveLength(19);
    WALK_STEP_NAMES.forEach((step, index) => {
      const order = String(index + 1).padStart(2, "0");
      expect(stepShotName({ step, width: 390, height: 844 })).toBe(
        `live-${order}-${step}-390x844.png`,
      );
    });
  });

  it("uses Receipts, not See the receipts, as the Step_Indicator item on letter, figures and close", () => {
    for (const step of ["letter", "figures", "close"] as const) {
      const expectation = STEP_INDICATOR_EXPECTATIONS[step];
      expect(expectation?.test("Receipts")).toBe(true);
      expect(expectation?.test("See the receipts")).toBe(false);
    }
  });
});

describe("checkPressStatusLine (S6.7, Q1.4)", () => {
  const expected = "Press and hold the seal to lock it.";

  it("passes when the line reads the S6.7 text, ignoring the surrounding space", () => {
    const check = checkPressStatusLine(`  ${expected} \n`, expected);
    expect(check.ok).toBe(true);
    expect(check.message).toBe(
      `PASS the Press_Status_Line reads "${expected}" (S6.7)`,
    );
  });

  it("fails when the line reads other text and names both texts", () => {
    const check = checkPressStatusLine("Seal it now", expected);
    expect(check.ok).toBe(false);
    expect(check.message).toBe(
      `FAIL the Press_Status_Line reads "Seal it now", expected "${expected}"`,
    );
  });
});

describe("checkPressEnvelopeClearOfText (Q1.4)", () => {
  const rect = (top: number, left: number, bottom: number, right: number) => ({
    top,
    left,
    bottom,
    right,
  });
  const textColumn = rect(100, 400, 600, 1000);

  it("passes an envelope clear of the text column at 1440 px, and skips other widths", () => {
    const clear = checkPressEnvelopeClearOfText(
      rect(100, 0, 200, 300),
      textColumn,
      1440,
    );
    expect(clear.ok).toBe(true);
    expect(clear.message).toBe(
      "PASS the Press_Envelope does not intersect the text column at 1440 px",
    );
    expect(
      checkPressEnvelopeClearOfText(rect(100, 0, 200, 300), textColumn, 390)
        .message,
    ).toBe("PASS not checked at 390 px (the rule applies at 1440 px)");
  });

  it("fails an envelope that overlaps the text column at 1440 px", () => {
    const overlap = checkPressEnvelopeClearOfText(
      rect(100, 300, 200, 500),
      textColumn,
      1440,
    );
    expect(overlap.ok).toBe(false);
    expect(overlap.message).toBe(
      "FAIL the Press_Envelope (left 300, right 500) intersects the text column (left 400, right 1000) at 1440 px",
    );
  });
});

describe("checkStepTrackClearOfTopBar (Q1.4)", () => {
  const topBar = { top: 0, left: 0, bottom: 60, right: 390 };

  it("passes a Step_Track that sits below the Top_Bar", () => {
    const check = checkStepTrackClearOfTopBar(
      { top: 80, left: 0, bottom: 120, right: 390 },
      topBar,
    );
    expect(check.ok).toBe(true);
    expect(check.message).toBe(
      "PASS the Step_Track is not under the Top_Bar after a step change",
    );
  });

  it("fails a Step_Track that sits under the Top_Bar", () => {
    const check = checkStepTrackClearOfTopBar(
      { top: 40, left: 0, bottom: 90, right: 390 },
      topBar,
    );
    expect(check.ok).toBe(false);
    expect(check.message).toBe(
      "FAIL the Step_Track (top 40, bottom 90) sits under the Top_Bar (bottom 60)",
    );
  });
});

describe("checkTopbarSlotStable (Q1.4)", () => {
  const slot = { top: 0, left: 0, bottom: 60, right: 1440 };

  it("passes a [data-topbar-slot] box that stays put on every step", () => {
    const check = checkTopbarSlotStable([slot, { ...slot }, { ...slot }]);
    expect(check.ok).toBe(true);
    expect(check.message).toBe(
      "PASS [data-topbar-slot] keeps the same box on every step",
    );
  });

  it("fails a slot that moves on a later step and names that step", () => {
    const check = checkTopbarSlotStable([
      slot,
      { ...slot },
      { ...slot, top: 4, bottom: 64 },
    ]);
    expect(check.ok).toBe(false);
    expect(check.message).toBe(
      "FAIL [data-topbar-slot] moved between steps: step 1 at top 0, step 3 at top 4",
    );
  });
});

describe("checkFigureRowsNoAccent (Q1.4)", () => {
  const row = (overrides: Partial<FigureRowPaint> = {}): FigureRowPaint => ({
    focused: false,
    border: "rgb(40, 40, 40)",
    background: "rgb(255, 255, 255)",
    outline: "rgb(255, 123, 28)",
    ...overrides,
  });

  it("passes an unfocused row whose only Accent is an outline it does not paint", () => {
    const check = checkFigureRowsNoAccent([row()]);
    expect(check.ok).toBe(true);
    expect(check.message).toBe(
      "PASS no Figure_Row paints an Accent colour in its border or background, and in its outline only while focused (1 row(s))",
    );
  });

  it("fails a row whose border is the Accent colour", () => {
    const check = checkFigureRowsNoAccent([
      row({ border: "rgb(255, 123, 28)" }),
    ]);
    expect(check.ok).toBe(false);
    expect(check.message).toBe(
      "FAIL 1 Accent or unreadable colour(s), 0 unreadable: row 1 border is Accent (rgb(255, 123, 28))",
    );
  });
});

describe("checkAccentButtonCount (Q1.4)", () => {
  it("passes one Accent button on the Seal step, the Press_Envelope", () => {
    const check = checkAccentButtonCount("Seal", ["Press the seal"]);
    expect(check.ok).toBe(true);
    expect(check.message).toBe(
      "PASS at most one Accent button on the Seal step (1 found)",
    );
  });

  it("fails a second Accent button on the Write step and names both", () => {
    const check = checkAccentButtonCount("Write", ["Continue", "Add a figure"]);
    expect(check.ok).toBe(false);
    expect(check.message).toBe(
      'FAIL 2 Accent buttons on the Write step: "Continue", "Add a figure"',
    );
  });
});

describe("checkTestifyCounter (Q1.4)", () => {
  it("passes a live Remember counter that does not say you wrote this on", () => {
    const check = checkTestifyCounter("Question 1 of 3");
    expect(check.ok).toBe(true);
    expect(check.message).toBe(
      'PASS the live Remember counter does not say "you wrote this on" (counter reads "Question 1 of 3")',
    );
  });

  it("fails a counter that says you wrote this on", () => {
    const check = checkTestifyCounter("You wrote this on 12 March");
    expect(check.ok).toBe(false);
    expect(check.message).toBe(
      'FAIL the live Remember counter reads "You wrote this on 12 March"',
    );
  });
});

describe("checkTrackNames (spec 16, 17.1 and 2.1)", () => {
  it("passes the six live names with a matching phone line", () => {
    const check = checkTrackNames(
      [...LIVE_TRACK_NAMES],
      "Step 4 of 6 · Remember",
      LIVE_TRACK_NAMES,
    );
    expect(check.ok).toBe(true);
  });

  it("passes the four persona names with no phone line", () => {
    expect(
      checkTrackNames([...PERSONA_TRACK_NAMES], null, PERSONA_TRACK_NAMES).ok,
    ).toBe(true);
  });

  it("fails a track that still says Testify", () => {
    const names = ["Write", "Press the seal", "Wait", "Testify", "Break the seal", "Receipts"];
    const check = checkTrackNames(names, null, LIVE_TRACK_NAMES);
    expect(check.ok).toBe(false);
    expect(check.message).toBe(
      'FAIL the step track reads "Write · Press the seal · Wait · Testify · Break the seal · Receipts"',
    );
  });

  it("fails a phone line whose label is not the step it numbers", () => {
    const check = checkTrackNames(
      [...LIVE_TRACK_NAMES],
      "Step 4 of 6 · Wait",
      LIVE_TRACK_NAMES,
    );
    expect(check.message).toBe('FAIL the phone line reads "Step 4 of 6 · Wait"');
  });

  it("fails a page with no step track", () => {
    expect(checkTrackNames(null, null, LIVE_TRACK_NAMES).message).toBe(
      "FAIL no step track on the page",
    );
  });
});

/** The Persona_List entry for one key. Throws when the list has no such persona. */
function personaRow(key: string): PersonaDateRow {
  const row = personaList.personas.find((persona) => persona.key === key);
  if (!row) throw new Error(`no persona ${key} in personas.json`);
  return row;
}

const ENGLISH_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** The en-GB long date for a `YYYY-MM-DD` string, built here so the expectation is not the formatter. */
function longDateOf(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${Number(day)} ${ENGLISH_MONTHS[Number(month) - 1]} ${year}`;
}

/** The "Month YYYY" form of a `YYYY-MM-DD` string. */
function monthYearOf(iso: string): string {
  const [year, month] = iso.split("-");
  return `${ENGLISH_MONTHS[Number(month) - 1]} ${year}`;
}

describe("expectedPersonaDates and checkPersonaDateStrings (spec 18, 16.2)", () => {
  it("formats each walk persona's Persona_List dates with the letter-date formatters", () => {
    for (const key of WALK_PERSONA_KEYS) {
      const row = personaRow(key);
      const expected = expectedPersonaDates(row);
      expect(expected.writtenAsOf).toBe(longDateOf(row.written_as_of));
      expect(expected.memoryMonth).toBe(monthYearOf(row.written_as_of));
      expect(expected.opensOn).toBe(longDateOf(row.opens_at.slice(0, 10)));
    }
  });

  it("passes a step that shows the formatted written-as-of and opening dates", () => {
    const expected = expectedPersonaDates(personaRow("us-maya"));
    const check = checkPersonaDateStrings(
      expected,
      `Maya is fictional. This letter was written as of ${expected.writtenAsOf}. Opens ${expected.opensOn}`,
      { written: true, memory: true, opening: true },
    );
    expect(check.ok).toBe(true);
    expect(check.message).toBe(
      `PASS us-maya shows written as of "${expected.writtenAsOf}", memory month "${expected.memoryMonth}", opens on "${expected.opensOn}"`,
    );
  });

  it("fails a step that still shows an Old_Persona_Date for the written-as-of line", () => {
    const expected = expectedPersonaDates(personaRow("us-maya"));
    const check = checkPersonaDateStrings(
      expected,
      "This letter was written as of 5 November 2024.",
      { written: true },
    );
    expect(check.ok).toBe(false);
    expect(check.message).toBe(
      `FAIL us-maya does not show written as of "${expected.writtenAsOf}"`,
    );
  });

  it("fails when letter-date.ts cannot format a Persona_List date", () => {
    const expected = expectedPersonaDates({
      key: "broken",
      written_as_of: "2023-06-05",
      opens_at: "not-a-date",
    });
    const check = checkPersonaDateStrings(expected, "Opens", { opening: true });
    expect(check.ok).toBe(false);
    expect(check.message).toBe(
      "FAIL broken: letter-date.ts formatted no opens on from personas.json",
    );
  });
});

describe("checkSealedForDemoLine (spec 18, 16.3)", () => {
  it("passes when the line uses the approved wording and the header's sealedAt date", () => {
    const check = checkSealedForDemoLine(
      "Sealed later, for this demo, on 25 November 2026.",
      "2026-11-25T10:00:00.000Z",
    );
    expect(check.ok).toBe(true);
    expect(check.message).toBe(
      'PASS sealed-for-demo line reads "Sealed later, for this demo, on 25 November 2026."',
    );
  });

  it("fails when the line's date is not the header's sealedAt date", () => {
    const check = checkSealedForDemoLine(
      "Sealed later, for this demo, on 25 November 2026.",
      "2026-11-26T10:00:00.000Z",
    );
    expect(check.ok).toBe(false);
    expect(check.message).toBe(
      'FAIL sealed-for-demo line reads "Sealed later, for this demo, on 25 November 2026.", expected "Sealed later, for this demo, on 26 November 2026."',
    );
  });

  it("fails when the page shows no sealed-for-demo line", () => {
    expect(checkSealedForDemoLine(null, "2026-11-25T10:00:00.000Z").message).toBe(
      'FAIL no sealed-for-demo line on the page, expected "Sealed later, for this demo, on 25 November 2026."',
    );
  });

  it("fails when the served header has no readable sealedAt", () => {
    expect(expectedSealedForDemoLine("not-a-date")).toBeNull();
    expect(checkSealedForDemoLine("Sealed later, for this demo, on 25 November 2026.", "not-a-date").message).toBe(
      "FAIL the served header has no readable sealedAt",
    );
  });
});

describe("findSealedForDemoLine (spec 18, 16.3)", () => {
  it("reads the sealed-for-demo line from the page text, trimmed", () => {
    const body = "Maya's letter\n  Sealed later, for this demo, on 25 November 2026.  \nRead on";
    expect(findSealedForDemoLine(body)).toBe(
      "Sealed later, for this demo, on 25 November 2026.",
    );
  });

  it("returns null when the page text has no sealed-for-demo line", () => {
    expect(findSealedForDemoLine("Maya's letter\nRead on")).toBeNull();
  });
});

describe("findStaleWalkText and checkWalkLetterText (spec 18, 16.5)", () => {
  it("passes letter text with the new dates and new prices", () => {
    expect(findStaleWalkText("Regular was about $3.91 a gallon, opens 1 January 2027.")).toEqual([]);
    const check = checkWalkLetterText(
      ["Regular was about $3.91 a gallon."],
      "us-maya letter text",
    );
    expect(check.ok).toBe(true);
    expect(check.message).toBe(
      "PASS us-maya letter text has no Old_Persona_Date or pre-reseal price",
    );
  });

  it("does not count a stale term inside a longer number or word", () => {
    expect(findStaleWalkText("On 15 Nov 2024 it cost $3.640")).toEqual([]);
  });

  it("fails letter text that holds an Old_Persona_Date and a pre-reseal price", () => {
    const check = checkWalkLetterText(
      ["I wrote this on 5 November 2024.", "Regular was about $3.64 a gallon."],
      "us-maya letter text",
    );
    expect(check.ok).toBe(false);
    expect(check.message).toBe(
      'FAIL us-maya letter text shows "5 November 2024", "$3.64"',
    );
  });

  it("fails a Price_Line that quotes the pre-reseal EUR form", () => {
    expect(findStaleWalkText("Petrol was about EUR 1.79 a litre.")).toEqual([
      "EUR 1.79",
    ]);
  });
});

describe("buildReceiptsReport (spec 18, 16.4)", () => {
  const figures: ReceiptFigureRead[] = [
    {
      metricId: "fixture-metric-a",
      then: {
        value: "FIXTURE 1.00",
        period: "2024-11-11",
        retrievedAt: "2026-11-01T16:39:37Z",
      },
      atOpening: {
        value: "FIXTURE 2.00",
        period: "2026-11-16",
        retrievedAt: "2026-11-01T16:39:37Z",
      },
    },
  ];

  it("lists each side's value, period and retrieved date, in order", () => {
    const report = buildReceiptsReport("us-maya", figures);
    expect(report.rows).toEqual([
      { metricId: "fixture-metric-a", side: "then", value: "FIXTURE 1.00", period: "2024-11-11" },
      { metricId: "fixture-metric-a", side: "at opening", value: "FIXTURE 2.00", period: "2026-11-16" },
    ]);
    expect(report.retrieved).toEqual([
      { metricId: "fixture-metric-a", side: "then", retrievedOn: "2026-11-01" },
      { metricId: "fixture-metric-a", side: "at opening", retrievedOn: "2026-11-01" },
    ]);
    expect(report.lines).toEqual([
      "us-maya | fixture-metric-a | then | FIXTURE 1.00 | 2024-11-11",
      "us-maya | fixture-metric-a | at opening | FIXTURE 2.00 | 2026-11-16",
      "us-maya | fixture-metric-a | then | historical record, retrieved 2026-11-01",
      "us-maya | fixture-metric-a | at opening | historical record, retrieved 2026-11-01",
    ]);
  });

  it("refuses a persona with no figures", () => {
    expect(() => buildReceiptsReport("us-priya", figures)).toThrow(
      "buildReceiptsReport: us-priya has no figures",
    );
  });

  it("refuses a retrieved_at with no date part", () => {
    const bad: ReceiptFigureRead[] = [
      {
        ...figures[0],
        then: { ...figures[0].then, retrievedAt: "not-a-date" },
      },
    ];
    expect(() => buildReceiptsReport("eu-tomas", bad)).toThrow(
      'buildReceiptsReport: retrieved_at has no date part: "not-a-date"',
    );
  });
});
