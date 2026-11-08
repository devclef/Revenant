// Feature: 05-reveal-ceremony
//
// Stage resolution (design.md "Stage resolution"). One pure function maps the
// Opening_Flow state and the view-local animation state to exactly one Stage.
// The table in the requirements (R3.1) is the source of truth; `stageFor` is
// its executable form. This module has no side effects and reads no
// data-driven value: the Stage depends only on the flow tag, the reveal stage
// number and the local view.

import { SCENE_COPY } from "./scene/copy";
import type { FlowState } from "../reveal/opening-machine";

/**
 * The one line for the emerging Stage (spec 07 task 2). EnvelopeView's visible
 * statement and the Stage's role=status line both read this string, so the
 * words a reader sees are the words announced. `loading` gives the loading
 * line; `openable` and `verifying` (the same scene) give the checking line.
 */
export function emergingStatus(tag: FlowState["tag"]): string {
  return tag === "loading"
    ? SCENE_COPY.emergingStatus.loading
    : SCENE_COPY.emergingStatus.verifying;
}

/**
 * The visual Stages of the ceremony. Each names a distinct scene on the desk.
 */
export type Stage =
  | "emerging"
  | "sealed"
  | "envelope"
  | "recall"
  | "marks"
  | "seal"
  | "letter"
  | "figures"
  | "close"
  | "error";

/**
 * View-local animation state, held by the running views and reported up to
 * `CeremonyRoot` so `data-ceremony` can name the Stage. It is not flow state.
 *
 * - `emergence`: the CSS Emergence on the persona page (spec 07); `"done"`
 *   once it has finished or Skip has finished it.
 * - `sealing`: a Seal_Break is in progress (stage 1 only).
 * - `figures`: the stage 3 figures fade-up; `"settled"` is the final state
 *   and the Close mounts from it.
 */
export type LocalView = {
  emergence: "running" | "done";
  sealing: boolean;
  figures: "running" | "settled";
};

/**
 * The default local view. A static render reports the final, settled state:
 * the Emergence has finished, no seal break is in progress, and the figures
 * are settled so stage 3 resolves to `close` (design.md "Final state first").
 */
export const DEFAULT_LOCAL_VIEW: LocalView = {
  emergence: "done",
  sealing: false,
  figures: "settled",
};

/**
 * Resolve the Stage for a `(flow state, local view)` pair, exactly per the
 * design.md "Stage resolution" table. Pure: no side effects, no data-driven
 * values.
 */
export function stageFor(state: FlowState, local: LocalView): Stage {
  switch (state.tag) {
    case "loading":
    case "openable":
    case "verifying":
      return "emerging";

    case "sealed":
      return "sealed";

    case "awaiting_key":
    case "unlocking":
      return "envelope";

    case "recall":
    case "submitting":
    case "submit_failed":
      return "recall";

    case "reveal": {
      switch (state.stage) {
        case 1:
          return local.sealing ? "seal" : "marks";
        case 2:
          return "letter";
        case 3:
          return local.figures === "settled" ? "close" : "figures";
      }
    }

    case "not_placed":
    case "unreachable":
    case "verification_failed":
    case "open_failed":
      return "error";
  }
}

/**
 * Whether the Ghost holds the handed pose (design.md "The Ghost", the pose
 * table). The Ghost lifts once the reader has picked the letter up, so it is
 * handed from `recall` through `seal`. It stays risen in every Stage before
 * `recall`. The horizontal placement never depends on this value.
 */
export function ghostHanded(stage: Stage): boolean {
  return stage === "recall" || stage === "marks" || stage === "seal";
}

/**
 * Where keyboard focus moves after a Stage change (spec 08 design.md, "Focus
 * after \"See the numbers\"").
 *
 * - `none`: move nothing (the settle from `figures` to `close`).
 * - `figures-heading`: focus the Figures_Heading, `[data-figures-heading]`.
 * - `default`: the spec 07 rule (`[data-stage-focus]`, else the newest heading,
 *   else the region).
 */
export type FocusTarget =
  | { kind: "none" }
  | { kind: "figures-heading" }
  | { kind: "default" };

/**
 * The focus target for a Stage change, from the previous Stage and the next
 * one. The pair alone tells the cause apart, so no third argument is needed.
 * `prev` is `null` on first mount.
 */
export function focusTargetFor(prev: Stage | null, next: Stage): FocusTarget {
  if (prev === "figures" && next === "close") return { kind: "none" };
  if (prev === "letter" && next === "figures") return { kind: "figures-heading" };
  // Skip to the receipts jumps from marks or seal to the figures stage first,
  // then settles to close.
  if ((prev === "marks" || prev === "seal") && next === "figures") {
    return { kind: "figures-heading" };
  }
  if (
    (prev === "letter" || prev === "marks" || prev === "seal") &&
    next === "close"
  ) {
    return { kind: "figures-heading" };
  }
  return { kind: "default" };
}

/**
 * Whether a Stage is at or after `recall`, so the persona hero takes its
 * smaller size (spec 08 design.md, "The Hero after the First_Step").
 */
export function afterFirstStep(stage: Stage): boolean {
  return (
    stage === "recall" ||
    stage === "marks" ||
    stage === "seal" ||
    stage === "letter" ||
    stage === "figures" ||
    stage === "close"
  );
}

/**
 * Whether the Ghost is unmounted in a Stage, so the Content_Column can lift its
 * cap (spec 08 design.md, "The reveal layout after the Ghost leaves").
 */
export function afterGhost(stage: Stage): boolean {
  return stage === "letter" || stage === "figures" || stage === "close";
}

/**
 * Whether the focus effect must rescue focus to the Figures_Heading. The only
 * case is a removed focus: the element was taken away in the same commit, so
 * `document.activeElement` is `body`, and the target is `none`, which would
 * otherwise leave focus nowhere (spec 08 design.md, `focusTargetFor` notes).
 */
export function shouldRescueFocus(
  activeIsBody: boolean,
  target: FocusTarget,
): boolean {
  return activeIsBody && target.kind === "none";
}
