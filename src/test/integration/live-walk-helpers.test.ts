import { describe, expect, it } from "vitest";

import {
  EXPECTED_STEPS,
  MOTION_CONTROL_SELECTOR,
  WALK_STEP_NAMES,
  checkMotionControlCount,
  expectedShotNames,
  findPlaceholderFigures,
  recordStepResult,
  reportMissingShots,
  stepShotName,
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
