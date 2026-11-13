/**
 * The Live_Walk variant matrix (Q1.3, Q2.1). Pure data and name builders, no
 * browser. Each width runs three times: with no figure, with one figure, and
 * once more with one figure under `prefers-reduced-motion: reduce`.
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

/** The matrix: each width, with no figure, one figure, and one reduced-motion run. */
export const WALK_MATRIX: readonly WalkMatrixEntry[] = WALK_SIZES.flatMap(
  (size) => {
    const runs: { variant: WalkVariant; reduced: boolean }[] = [
      { variant: "no-figure", reduced: false },
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
