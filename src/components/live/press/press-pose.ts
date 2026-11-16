import type { SealState } from "../seal-machine";
import type { PressState } from "./press-hold";

/**
 * The pose of the wax and the Signet on the Seal_Step (spec 13, design section 2).
 *
 * A pure function. It reads no clock and no media query: the caller passes
 * `instant` (reduced motion or Calm_Mode) and gets the final pose for the
 * current seal state straight away.
 */

/**
 * The wax pose. `bead` and `spread` are the two pooling stages before the full
 * pool (P3). `armed` is the full pool, shown when the hold is complete.
 */
export type SealPose =
  | "unpressed"
  | "bead"
  | "spread"
  | "armed"
  | "signet_down"
  | "setting"
  | "set"
  | "lifted";

/** The three wax stages (P3). `full` is also the finished pool. */
export type PoolStage = "bead" | "spread" | "full";

/**
 * Stage of the wax pool for a press progress from 0 to 1. Full progress is always
 * the full pool, so a cut P3 (one pool at completion) still reads correctly.
 */
export function poolStage(progress: number): PoolStage {
  if (!(progress > 0) || progress < 1 / 3) return "bead";
  if (progress < 1) return "spread";
  return "full";
}

/** The pose a seal state settles into. Used directly under instant mode. */
function finalPose(seal: SealState): SealPose {
  switch (seal.tag) {
    case "write":
      return "armed";
    case "creating":
      return "signet_down";
    case "created":
    case "confirming":
    case "preparing":
    case "sealing":
      return "setting";
    case "sealed":
      return "set";
    case "cancelled":
    case "failed":
    case "cannot_lock":
    case "fallback_key":
      return "lifted";
  }
}

/**
 * The pose of the wax and Signet for a seal state and a press state.
 *
 * `instant` (reduced motion or Calm_Mode) skips the hold and draws the final
 * pose for the state. Otherwise the press phase decides the pose on `write`.
 */
export function sealPose(
  seal: SealState,
  press: PressState,
  instant = false,
): SealPose {
  if (instant) return finalPose(seal);
  if (seal.tag !== "write") return finalPose(seal);

  switch (press.phase) {
    case "idle":
      return "unpressed";
    case "holding":
    case "settling": {
      // Progress picks the stage, so a receding press drops back through the stages.
      const stage = poolStage(press.progress);
      return stage === "full" ? "armed" : stage;
    }
    case "armed":
    case "pressed":
      return "armed";
  }
}
