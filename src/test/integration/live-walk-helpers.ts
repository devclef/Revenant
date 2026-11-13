/**
 * Pure helpers for the Live_Walk (spec 12, Q1 and Q2). No browser, no network,
 * no imports. The walk replay in `live-walk.test.ts` uses them to name Step_Shots,
 * list the expected set, report missing shots, count Motion_Controls, look for
 * placeholder figures in the final reveal, and record each step's result.
 */

/** The ten steps of the walk, in order. `<step>` in a Step_Shot name is one of these. */
export const WALK_STEP_NAMES = [
  "write",
  "write-receipts",
  "seal",
  "wait",
  "unlock",
  "testify",
  "marks",
  "letter",
  "figures",
  "close",
] as const;

export type WalkStepName = (typeof WALK_STEP_NAMES)[number];

/** The two widths every Step_Shot is taken at (Q2.1). */
export const WALK_SIZES = [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
] as const;

/** The two walk variants (Q1.3). */
export const WALK_VARIANTS = ["one-figure", "no-figure"] as const;

export type WalkVariant = (typeof WALK_VARIANTS)[number];

/**
 * Steps that produce a Step_Shot in each variant. Both variants reach every
 * step: the no-figure letter still goes through the figures stage, where the
 * Nothing_To_Compare_Line is shown, and it ends on the 0-figure close (Q2.3).
 * Filenames carry no variant, so both variants expect the same names.
 */
export const EXPECTED_STEPS: Record<WalkVariant, readonly WalkStepName[]> = {
  "one-figure": WALK_STEP_NAMES,
  "no-figure": WALK_STEP_NAMES,
};

/** The CSS selector for the Motion_Control (Q1, Motion_Control count check). */
export const MOTION_CONTROL_SELECTOR = 'button[aria-label*="motion" i]';

/** Build one Step_Shot file name: `live-<nn>-<step>-<w>x<h>[-reduced].png`. */
export function stepShotName(input: {
  step: string;
  width: number;
  height: number;
  reduced?: boolean;
}): string {
  const index = WALK_STEP_NAMES.indexOf(input.step as WalkStepName);
  if (index === -1) {
    throw new Error(`Unknown walk step: ${input.step}`);
  }
  const nn = String(index + 1).padStart(2, "0");
  const suffix = input.reduced ? "-reduced" : "";
  return `live-${nn}-${input.step}-${input.width}x${input.height}${suffix}.png`;
}

/**
 * Every Step_Shot name a variant must produce: each expected step, at both
 * widths, once without and once with `prefers-reduced-motion: reduce`.
 */
export function expectedShotNames(variant: WalkVariant): string[] {
  const names: string[] = [];
  for (const reduced of [false, true]) {
    for (const size of WALK_SIZES) {
      for (const step of EXPECTED_STEPS[variant]) {
        names.push(
          stepShotName({
            step,
            width: size.width,
            height: size.height,
            reduced,
          }),
        );
      }
    }
  }
  return names;
}

/**
 * Compare the expected Step_Shot names with the files that exist. Returns one
 * `FAIL missing Step_Shot <name>` line per missing file, or a single PASS line.
 */
export function reportMissingShots(
  expected: readonly string[],
  present: readonly string[],
): { missing: string[]; lines: string[] } {
  const presentSet = new Set(present);
  const missing = expected.filter((name) => !presentSet.has(name));
  if (missing.length === 0) {
    return {
      missing,
      lines: [`PASS all ${expected.length} Step_Shots present`],
    };
  }
  return {
    missing,
    lines: missing.map((name) => `FAIL missing Step_Shot ${name}`),
  };
}

/**
 * Check the Motion_Control count. The spec needs exactly one (Q1.6 and the
 * Motion_Control acceptance criteria), so any other count fails.
 */
export function checkMotionControlCount(count: number): {
  ok: boolean;
  message: string;
} {
  if (count === 1) {
    return { ok: true, message: "PASS Motion_Control count 1" };
  }
  return {
    ok: false,
    message: `FAIL Motion_Control count ${count}, expected 1 (${MOTION_CONTROL_SELECTOR})`,
  };
}

const PLACEHOLDER_PATTERNS: readonly { term: string; pattern: RegExp }[] = [
  // "0.000" and "0.0%" must stand alone: "10.0%" or "0.0001" are real values.
  { term: "0.000", pattern: /(?<![\d.])0\.000(?!\d)/ },
  { term: "0.0%", pattern: /(?<![\d.])0\.0%/ },
  { term: "unchanged", pattern: /\bunchanged\b/i },
];

/**
 * Return the placeholder strings found in the final reveal text: "0.000",
 * "0.0%" and "unchanged". An empty array means none were found.
 */
export function findPlaceholderFigures(text: string): string[] {
  return PLACEHOLDER_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(
    ({ term }) => term,
  );
}

/** One defect found at a step. Every field is required so the findings are complete. */
export type WalkDefect = {
  step: WalkStepName;
  expected: string;
  observed: string;
  suspectedFile: string;
};

/** The result of one step of the walk (Q1.5). */
export type WalkStepResult = {
  step: WalkStepName;
  pass: boolean;
  observation: string;
  shots: string[];
  defects: WalkDefect[];
};

/**
 * Build the result record for one step. A step passes when it has no defects.
 * Throws on an unknown step name so a typo cannot reach the findings block.
 */
export function recordStepResult(input: {
  step: string;
  observation: string;
  shots: string[];
  defects: WalkDefect[];
}): WalkStepResult {
  const step = input.step as WalkStepName;
  if (!WALK_STEP_NAMES.includes(step)) {
    throw new Error(`Unknown walk step: ${input.step}`);
  }
  return {
    step,
    pass: input.defects.length === 0,
    observation: input.observation,
    shots: [...input.shots],
    defects: input.defects.map((defect) => ({ ...defect })),
  };
}
