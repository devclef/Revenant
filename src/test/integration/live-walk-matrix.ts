/**
 * The Live_Walk variant matrix (Q1.3, Q2.1). Pure data and name builders, no
 * browser. `WALK_MATRIX` lists four runs per width (eight in all):
 *
 * 1. no figure, motion on;
 * 2. no figure, `prefers-reduced-motion: reduce`;
 * 3. one figure, motion on;
 * 4. one figure, `prefers-reduced-motion: reduce`.
 */
import {
  EXPECTED_STEPS,
  WALK_SIZES,
  WALK_STEP_NAMES,
  stepShotName,
  type WalkStepName,
  type WalkVariant,
} from "./live-walk-helpers";

export type WalkMatrixEntry = {
  /** Stable id, for example `1440x900-one-figure-reduced`. */
  id: string;
  width: number;
  height: number;
  variant: WalkVariant;
  reduced: boolean;
};

/** Environment variable that turns the live walk on. Unset means skipped. */
export const WALK_ENV = "WALK";

/** True only when `WALK` is exactly `1`. Any other value, or no value, skips the walk. */
export function walkEnabled(env: Record<string, string | undefined>): boolean {
  return env[WALK_ENV] === "1";
}

/** The matrix: each width, with no figure or one figure, each with motion on and reduced. */
export const WALK_MATRIX: readonly WalkMatrixEntry[] = WALK_SIZES.flatMap(
  (size) => {
    const runs: { variant: WalkVariant; reduced: boolean }[] = [
      { variant: "no-figure", reduced: false },
      { variant: "no-figure", reduced: true },
      { variant: "one-figure", reduced: false },
      { variant: "one-figure", reduced: true },
    ];
    return runs.map(({ variant, reduced }) => ({
      id: `${size.width}x${size.height}-${variant}${reduced ? "-reduced" : ""}`,
      width: size.width,
      height: size.height,
      variant,
      reduced,
    }));
  },
);

/** What one browser run of a matrix entry does: its width, motion and whether a figure is added. */
export type WalkMatrixRun = {
  size: { width: number; height: number };
  reduced: boolean;
  /** True for the one-figure variant: a figure is picked at the write-receipts stage. */
  figure: boolean;
};

/** The run a matrix entry describes. Only the one-figure variant picks a figure. */
export function matrixRun(entry: WalkMatrixEntry): WalkMatrixRun {
  return {
    size: { width: entry.width, height: entry.height },
    reduced: entry.reduced,
    figure: entry.variant === "one-figure",
  };
}

/**
 * The Step_Shot names one matrix entry must produce, in walk order. `steps`
 * limits the set to the stages a run reaches; the default is the whole walk.
 */
export function matrixShotNames(
  entry: WalkMatrixEntry,
  steps: readonly WalkStepName[] = WALK_STEP_NAMES,
): string[] {
  return EXPECTED_STEPS[entry.variant]
    .filter((step) => steps.includes(step))
    .map((step) =>
      stepShotName({
        step,
        width: entry.width,
        height: entry.height,
        reduced: entry.reduced,
      }),
    );
}

/**
 * The one keyboard run (Q1.3): the seal is pressed with Space on the focused
 * control. It is kept out of WALK_MATRIX, which lists eight mouse and touch runs.
 * Its Step_Shot names carry a `-keyboard` suffix.
 */
export const KEYBOARD_MATRIX_ENTRY: WalkMatrixEntry = {
  id: "1440x900-keyboard",
  width: 1440,
  height: 900,
  variant: "no-figure",
  reduced: false,
};

/**
 * The persona tamper runs (spec 13, A1): each width, with motion on and reduced.
 * Each run ends on the `tamper` Step_Shot. It needs no passkey.
 */
export type TamperMatrixEntry = {
  /** Stable id, for example `390x844-reduced`. */
  id: string;
  width: number;
  height: number;
  reduced: boolean;
};

export const TAMPER_MATRIX: readonly TamperMatrixEntry[] = WALK_SIZES.flatMap(
  (size) =>
    [false, true].map((reduced) => ({
      id: `${size.width}x${size.height}${reduced ? "-reduced" : ""}`,
      width: size.width,
      height: size.height,
      reduced,
    })),
);

/** The one Step_Shot a persona tamper run writes. */
export function tamperShotNames(entry: TamperMatrixEntry): string[] {
  return [
    stepShotName({
      step: "tamper",
      width: entry.width,
      height: entry.height,
      reduced: entry.reduced,
    }),
  ];
}
