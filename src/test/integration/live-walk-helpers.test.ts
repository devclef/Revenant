import { describe, expect, it } from "vitest";

import {
  EXPECTED_STEPS,
  MOTION_CONTROL_SELECTOR,
  SKIP_LINK_STAGE,
  STEP_SUSPECTED_FILES,
  WALK_STEP_NAMES,
  advanceSettle,
  checkClippedText,
  checkConsoleErrors,
  checkContrast,
  checkForbiddenFinalText,
  checkHorizontalScroll,
  checkMotionControlCount,
  checkOwnNumberRowsBlank,
  checkRunShots,
  checkStepIndicator,
  checkStepSnapshot,
  contrastFloor,
  contrastRatio,
  defectsFromChecks,
  expectedShotNames,
  findPlaceholderFigures,
  parseCssColor,
  recordStepResult,
  reportMissingShots,
  shotsWrittenSince,
  skipLinkBlocksSettle,
  stepShotName,
  walkShotName,
  type PageSnapshot,
} from "./live-walk-helpers";

describe("stepShotName", () => {
  it("names the first and last steps with a two-digit order", () => {
    expect(stepShotName({ step: "write", width: 1440, height: 900 })).toBe(
      "live-01-write-1440x900.png",
    );
    expect(stepShotName({ step: "close", width: 390, height: 844 })).toBe(
      "live-10-close-390x844.png",
    );
  });

  it("follows the pattern at both widths", () => {
    expect(stepShotName({ step: "seal", width: 1440, height: 900 })).toBe(
      "live-03-seal-1440x900.png",
    );
    expect(stepShotName({ step: "seal", width: 390, height: 844 })).toBe(
      "live-03-seal-390x844.png",
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
    ).toBe("live-09-figures-1440x900-reduced.png");
    expect(
      stepShotName({
        step: "figures",
        width: 390,
        height: 844,
        reduced: false,
      }),
    ).toBe("live-09-figures-390x844.png");
  });

  it("names the step, not the Stage, for write-receipts", () => {
    expect(
      stepShotName({ step: "write-receipts", width: 390, height: 844 }),
    ).toBe("live-02-write-receipts-390x844.png");
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
    expect(names).toHaveLength(10 * 2 * 2);
    expect(names).toContain("live-01-write-1440x900.png");
    expect(names).toContain("live-10-close-390x844-reduced.png");
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
      shots: ["live-09-figures-390x844.png"],
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
        },
        {
          tag: "p",
          text: "wide",
          scrollWidth: 300,
          clientWidth: 100,
          overflowX: "visible",
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
      },
    ]);
    expect(clipped.ok).toBe(false);
    expect(clipped.message).toContain('"Cut off"');
  });
});

describe("checkStepIndicator", () => {
  it("passes when the current item matches the step", () => {
    expect(checkStepIndicator("Break the seal", /^break the seal$/i).ok).toBe(
      true,
    );
  });

  it("fails when the current item disagrees or is missing", () => {
    expect(checkStepIndicator("Testify", /^break the seal$/i).ok).toBe(false);
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
    const wrongItem = { ...CLEAN_SNAPSHOT, currentStep: "Testify" };
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
      currentStep: "See the receipts",
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
    const onLetter = { ...CLEAN_SNAPSHOT, currentStep: "See the receipts" };
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
    ).toBe("live-07-marks-1440x900.png");
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
    ).toBe("live-10-close-390x844-reduced-via-skip.png");
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
      "FAIL missing Step_Shot live-03-seal-390x844.png",
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
    const files = expected.map((name) => ({ name, mtimeMs: runStart + 1 }));
    const result = checkRunShots(expected, shotsWrittenSince(files, runStart));
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
