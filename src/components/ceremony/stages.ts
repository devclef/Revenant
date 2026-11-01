// Feature: 05-reveal-ceremony
//
// Stage resolution (design.md "Stage resolution"). One pure function maps the
// Opening_Flow state and the view-local animation state to exactly one Stage.
// The table in the requirements (R3.1) is the source of truth; `stageFor` is
// its executable form. This module has no side effects and reads no
// data-driven value: the Stage depends only on the flow tag, the reveal stage
// number and the local view.

import type { FlowState } from "../reveal/opening-machine";

/**
 * The visual Stages of the ceremony. Each names a distinct scene on the desk.
 * `/demo` sets `desk` on its own root and has no Flow, so `stageFor` never
 * returns `desk` itself.
 */
export type Stage =
  | "desk"
  | "envelope"
  | "intact"
  | "recall"
  | "marks"
  | "seal"
  | "letter"
  | "then"
  | "passage"
  | "now"
  | "close"
  | "error";

/**
 * View-local animation state, held by the running views and reported up to
 * `CeremonyRoot` so `data-ceremony` can name the Stage. It is not flow state.
 *
 * - `sealing`: a Seal_Break is in progress (stage 1 only).
 * - `step`: the stage 3 Step; `"done"` is the final, settled state.
 */
export type LocalView = {
  sealing: boolean;
  step: "then" | "passage" | "now" | "done";
};

/**
 * The default local view. A static render reports the final, settled state:
 * no seal break in progress, and stage 3 at `"done"` so it resolves to
 * `close` (design.md "Final state first").
 */
export const DEFAULT_LOCAL_VIEW: LocalView = { sealing: false, step: "done" };

/**
 * Resolve the Stage for a `(flow state, local view)` pair, exactly per the
 * design.md "Stage resolution" table. Pure: no side effects, no data-driven
 * values.
 */
export function stageFor(state: FlowState, local: LocalView): Stage {
  switch (state.tag) {
    case "loading":
    case "sealed":
    case "openable":
    case "verifying":
      return "envelope";

    case "verified":
      return "intact";

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
          return local.step === "done" ? "close" : local.step;
      }
    }

    case "not_placed":
    case "unreachable":
    case "verification_failed":
    case "open_failed":
      return "error";
  }
}
