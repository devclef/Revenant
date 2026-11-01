// Feature: 05-reveal-ceremony, Property 1: Every Flow state maps to exactly one Stage
//
// `stageFor` (stages.ts) is the executable form of the R3.1 "Stage resolution"
// table in design.md. This test pins that table across the whole input space:
// every FlowState tag, every reveal stage (1, 2, 3) and arbitrary LocalView
// values, checked against an independent oracle that re-states the table by
// hand. If the function and the table ever drift, a counterexample is found.
//
// The oracle is deliberately NOT a copy of `stageFor`'s control flow: it reads
// the table row by row, so a change to either side is caught. It covers:
//   - loading / sealed / openable / verifying -> envelope (any local view);
//   - verified -> intact (any local view);
//   - recall / submitting / submit_failed -> recall (any local view);
//   - reveal stage 1 -> "seal" when sealing is true, else "marks";
//   - reveal stage 2 -> "letter" (any local view);
//   - reveal stage 3 -> the step ("then" / "passage" / "now"), and "close"
//     when step is "done" (the default local view maps stage 3 to "close");
//   - not_placed / unreachable / verification_failed / open_failed -> error.
//
// Validates R3.1.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import type {
  FlowState,
  OpenFailedKind,
  Opened,
} from "../reveal/opening-machine";
import {
  DEFAULT_LOCAL_VIEW,
  stageFor,
  type LocalView,
  type Stage,
} from "./stages";

// --- fixtures ----------------------------------------------------------------
//
// The payload-bearing FlowState variants need an `Opened`/record/drafts slice
// to type-check. `stageFor` reads none of it — it switches on `state.tag` and,
// for `reveal`, on `state.stage` — so these are minimal shells cast to the
// variant. The Stage never depends on any payload value (R3.1).

// A bare Opened stand-in; its fields are never read by stageFor.
const OPENED_STUB: Opened = {
  letterId: "letter-1",
  header: { sealedAt: "2024-10-01T00:00:00.000Z", opensAt: "2024-11-05T00:00:00.000Z" },
  payload: {} as never,
  openingKey: {} as never,
};

const RECORD = { version: 1, answers: [] } as never;
const DRAFTS = {} as never;
const SEALED = { ciphertext: "c", nonce: "n" } as never;

const OPEN_FAILED_KINDS: OpenFailedKind[] = [
  "wrong_key",
  "tampered",
  "unsupported_format",
  "invalid_payload",
  "invalid_input",
];

// --- state arbitraries -------------------------------------------------------
//
// One arbitrary per FlowState tag. The `reveal` tag is split by stage so the
// stage number is a first-class input, exactly as the table rows are. Error
// `open_failed` varies its `kind`; the Stage must stay `error` regardless.

const nonRevealStateArbs: fc.Arbitrary<FlowState>[] = [
  fc.constant<FlowState>({ tag: "loading" }),
  fc.constant<FlowState>({ tag: "sealed", opensAt: "2024-11-05T00:00:00.000Z" }),
  fc.constant<FlowState>({ tag: "openable", envelope: {}, envelopeHash: "h" }),
  fc.constant<FlowState>({ tag: "verifying" }),
  fc.constant<FlowState>({ tag: "verified", opened: OPENED_STUB }),
  fc.constant<FlowState>({
    tag: "recall",
    opened: OPENED_STUB,
    drafts: DRAFTS,
    invalid: [],
  }),
  fc.constant<FlowState>({
    tag: "submitting",
    opened: OPENED_STUB,
    drafts: DRAFTS,
    record: RECORD,
    sealed: SEALED,
  }),
  fc.constant<FlowState>({
    tag: "submit_failed",
    opened: OPENED_STUB,
    drafts: DRAFTS,
    record: RECORD,
    sealed: SEALED,
  }),
  fc.constant<FlowState>({ tag: "not_placed" }),
  fc.constant<FlowState>({ tag: "unreachable" }),
  fc.constant<FlowState>({ tag: "verification_failed" }),
  ...OPEN_FAILED_KINDS.map((kind) =>
    fc.constant<FlowState>({ tag: "open_failed", kind }),
  ),
];

const revealStateArb: fc.Arbitrary<FlowState> = fc
  .constantFrom<1 | 2 | 3>(1, 2, 3)
  .map((stage) => ({ tag: "reveal", opened: OPENED_STUB, record: RECORD, stage }));

// Every FlowState tag, with `reveal` present at each of its three stages.
const stateArb: fc.Arbitrary<FlowState> = fc.oneof(
  ...nonRevealStateArbs,
  revealStateArb,
);

// Arbitrary LocalView: both axes vary freely so "any local view" rows are
// genuinely exercised with sealing true/false and every step value.
const localViewArb: fc.Arbitrary<LocalView> = fc.record({
  sealing: fc.boolean(),
  step: fc.constantFrom<LocalView["step"]>("then", "passage", "now", "done"),
});

// --- the oracle --------------------------------------------------------------
//
// The R3.1 table, restated independently of stageFor. This is the "named by the
// table" Stage the function must return for every (state, local) pair.

function expectedStage(state: FlowState, local: LocalView): Stage {
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
    case "reveal":
      if (state.stage === 1) return local.sealing ? "seal" : "marks";
      if (state.stage === 2) return "letter";
      // stage 3
      return local.step === "done" ? "close" : local.step;
    case "not_placed":
    case "unreachable":
    case "verification_failed":
    case "open_failed":
      return "error";
  }
}

// --- the property ------------------------------------------------------------

describe("Property 1: every Flow state maps to exactly one Stage (R3.1)", () => {
  it("stageFor returns exactly the Stage named by the R3.1 table, for every state and local view", () => {
    fc.assert(
      fc.property(stateArb, localViewArb, (state, local) => {
        expect(stageFor(state, local)).toBe(expectedStage(state, local));
      }),
      { numRuns: 100 },
    );
  });

  it("maps the default local view's stage-3 reveal to close (R3.1 'Final state first')", () => {
    expect(DEFAULT_LOCAL_VIEW).toEqual({ sealing: false, step: "done" });
    const stage3: FlowState = {
      tag: "reveal",
      opened: OPENED_STUB,
      record: RECORD,
      stage: 3,
    };
    expect(stageFor(stage3, DEFAULT_LOCAL_VIEW)).toBe("close");
  });
});
