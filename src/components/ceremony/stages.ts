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

/** The Stages in the order the reveal reaches them. `error` can follow any of them, so it sorts last. */
const STAGE_ORDER: readonly Stage[] = [
  "emerging",
  "sealed",
  "envelope",
  "recall",
  "marks",
  "seal",
  "letter",
  "figures",
  "close",
  "error",
];

/**
 * The Stages a letter can reach, in order. A letter with no official figures
 * has no `figures` Stage (spec 10 L5.1), so it is left out of the list.
 */
export function stageListFor(hasFigures: boolean): readonly Stage[] {
  return hasFigures ? STAGE_ORDER : STAGE_ORDER.filter((stage) => stage !== "figures");
}

/** True for every Stage after `recall` (`marks` onward, and `error`). */
export function stageIsAfterRecall(stage: Stage): boolean {
  return STAGE_ORDER.indexOf(stage) > STAGE_ORDER.indexOf("recall");
}

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

/** Whether the opened letter in a reveal state has at least one sealed figure. */
function hasFigures(state: Extract<FlowState, { tag: "reveal" }>): boolean {
  return state.opened.payload.figures.length > 0;
}

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
    case "reading":
    case "submitting":
    case "submit_failed":
      return "recall";

    case "reveal": {
      // A letter with no figures has no figures stage: stages 2 and 3 both
      // resolve to `close`, the letter and the Close (spec 10 C8.6).
      switch (state.stage) {
        case 1:
          return local.sealing ? "seal" : "marks";
        case 2:
          return hasFigures(state) ? "letter" : "close";
        case 3:
          return !hasFigures(state) || local.figures === "settled" ? "close" : "figures";
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
 * after \"See the numbers\""; spec 10 design.md, "Focus: Load_Entry and
 * Gesture_Entry").
 *
 * - `stage-heading`: the first question's heading (`[data-stage-heading]`),
 *   focused with `preventScroll` and no scroll. Used on a Load_Entry into
 *   `recall`, so the page stays where it loaded.
 * - `author-testimony-heading`: the Author_Testimony_Heading, with a scroll.
 * - `letter-heading`: the Caption_Block heading (`[data-letter-heading]`).
 * - `figures-heading`: the Figures_Heading, `[data-figures-heading]`.
 * - `none`: move nothing (the settle from `figures` to `close`).
 * - `default`: the spec 07 rule (`[data-stage-focus]`, else the newest heading,
 *   else the region).
 */
export type FocusTarget =
  | { kind: "stage-heading" }
  | { kind: "author-testimony-heading" }
  | { kind: "letter-heading" }
  | { kind: "figures-heading" }
  | { kind: "none" }
  | { kind: "default" };

/**
 * The shape of the letter that the focus table reads. `authorQuestions` is true
 * when the letter has Author_Questions; `figures` when it has at least one
 * sealed figure. Both are false before `recall`, where no letter is open yet.
 */
export type FocusShape = { authorQuestions: boolean; figures: boolean };

/**
 * The shape of the letter in a flow state. Only the states that hold an opened
 * payload carry a shape; every other state reports both values as false.
 *
 * `authorQuestions` is true when the sealed recall questions include a text
 * question (an Author_Question, spec 10 C2).
 */
export function letterShape(state: FlowState): FocusShape {
  switch (state.tag) {
    case "recall":
    case "submitting":
    case "submit_failed":
    case "reveal":
      return {
        authorQuestions: state.opened.payload.recall_questions.some(
          (question) => question.answer_type === "text",
        ),
        figures: state.opened.payload.figures.length > 0,
      };
    default:
      return { authorQuestions: false, figures: false };
  }
}

/**
 * The focus target for a Stage change, from the previous Stage, the next one and
 * the letter's shape. `prev` is `null` on first mount. The table is the one in
 * spec 10 design.md, "Focus: Load_Entry and Gesture_Entry".
 */
export function focusTargetFor(
  prev: Stage | null,
  next: Stage,
  shape: FocusShape,
): FocusTarget {
  // Load_Entry: the persona page reaches `recall` from `emerging`.
  if (prev === "emerging" && next === "recall") return { kind: "stage-heading" };
  // Gesture_Entry: a Live_Letter or Real_Letter reaches `recall` from `envelope`.
  if (prev === "envelope" && next === "recall") return { kind: "default" };
  if (prev === "figures" && next === "close") return { kind: "none" };
  if (prev === "letter" && next === "figures") return { kind: "figures-heading" };
  if (prev === "letter" && next === "close" && shape.figures) {
    return { kind: "figures-heading" };
  }
  // Skip from marks or seal jumps to the letter, the figures or the close.
  if (prev === "marks" || prev === "seal") {
    if (next === "letter") {
      return shape.authorQuestions
        ? { kind: "author-testimony-heading" }
        : { kind: "default" };
    }
    if (next === "figures" || next === "close") {
      if (shape.authorQuestions) return { kind: "author-testimony-heading" };
      if (shape.figures) return { kind: "figures-heading" };
      if (next === "close") return { kind: "letter-heading" };
    }
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
