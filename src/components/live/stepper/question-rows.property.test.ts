// Property 5: the Author_Question rows survive every way back (spec 10, C2.10,
// C2.12, C9.5).
//
// SealPage holds the rows in the stepper's draft and moves between steps with
// reduceStepper. An oracle folds the same row events with reduceWriteDraft from
// the mode's starting draft, so the expected rows do not come from the reducer
// under test. After every action, the stepper's rows equal the oracle's. The
// cancelled, failed, cannot_lock and Try again screens are driven through the
// flow reducer, which must not change the rows either.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { LIVE_COPY, questionStarters } from "../copy";
import { sealReducer, INITIAL_SEAL_STATE } from "../seal-machine";
import {
  initialWriteDraft,
  reduceWriteDraft,
  type WriteDraft,
  type WriteDraftEvent,
} from "../write-draft";

import {
  initialStepperState,
  reduceStepper,
  type StepperAction,
} from "./live-steps";

const questionEventArb: fc.Arbitrary<WriteDraftEvent> = fc.oneof(
  fc
    .record({
      index: fc.integer({ min: 0, max: 3 }),
      text: fc.string({ maxLength: 12 }),
    })
    .map(({ index, text }): WriteDraftEvent => ({
      type: "QUESTION_CHANGED",
      index,
      text,
    })),
  fc.constant<WriteDraftEvent>({ type: "QUESTION_ADDED" }),
  fc
    .integer({ min: 0, max: 3 })
    .map((index): WriteDraftEvent => ({ type: "QUESTION_REMOVED", index })),
  fc
    .constantFrom(...questionStarters)
    .map((text): WriteDraftEvent => ({ type: "QUESTION_STARTER", text })),
);

const actionArb: fc.Arbitrary<StepperAction> = fc.oneof(
  fc.constant<StepperAction>({ type: "NEXT" }),
  fc.constant<StepperAction>({ type: "BACK" }),
  questionEventArb.map((event): StepperAction => ({ type: "DRAFT", event })),
);

describe("Property 5: the question rows survive every way back", () => {
  it("the rows match the oracle after every action, for both modes", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("demo" as const, "real" as const),
        fc.array(actionArb, { maxLength: 40 }),
        (mode, actions) => {
          let state = initialStepperState("write", mode);
          let oracle: WriteDraft = initialWriteDraft(mode);

          for (const action of actions) {
            if (action.type === "DRAFT") {
              oracle = reduceWriteDraft(oracle, action.event);
            }
            state = reduceStepper(state, action);
            expect(state.draft.questions).toEqual(oracle.questions);
          }
        },
      ),
    );
  });

  it("a demo draft starts with the Live_Prefill row and a real draft with none", () => {
    expect(initialStepperState("write", "demo").draft.questions).toEqual([
      LIVE_COPY.livePrefill,
    ]);
    expect(initialStepperState("write", "real").draft.questions).toEqual([]);
  });

  it("keeps the rows through cancelled, failed, cannot_lock and Try again", () => {
    let state = initialStepperState("write", "demo");
    state = reduceStepper(state, {
      type: "DRAFT",
      event: { type: "QUESTION_CHANGED", index: 0, text: "Kept row" },
    });
    state = reduceStepper(state, {
      type: "DRAFT",
      event: { type: "QUESTION_ADDED" },
    });
    state = reduceStepper(state, {
      type: "DRAFT",
      event: { type: "QUESTION_CHANGED", index: 1, text: "Second row" },
    });
    const rows = ["Kept row", "Second row"];
    expect(state.draft.questions).toEqual(rows);

    // Each flow screen is reached and left through the flow reducer. The
    // stepper's draft is not touched by any of them.
    let flow = sealReducer(INITIAL_SEAL_STATE, { type: "CREATE_PRESS" });
    flow = sealReducer(flow, { type: "CANCELLED" });
    flow = sealReducer(flow, { type: "RETRY" });
    expect(flow.tag).toBe("write");
    expect(state.draft.questions).toEqual(rows);

    flow = sealReducer(flow, { type: "CREATE_PRESS" });
    flow = sealReducer(flow, {
      type: "FAILED",
      kind: "server",
      passkeyCreated: false,
    });
    flow = sealReducer(flow, { type: "RETRY" });
    expect(flow.tag).toBe("write");
    expect(state.draft.questions).toEqual(rows);

    flow = sealReducer(flow, { type: "CREATE_PRESS" });
    flow = sealReducer(flow, { type: "CANNOT_LOCK", passkeyCreated: false });
    flow = sealReducer(flow, { type: "RETRY" });
    expect(flow.tag).toBe("write");
    expect(state.draft.questions).toEqual(rows);
  });
});
