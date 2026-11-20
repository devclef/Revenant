// Feature: 13-the-seal
//
// Property tests for the Seal step press (spec 13, design "Correctness
// Properties" 7 and 8; requirements P1.5, P2.8, P5.2, P5.7, P7.2 to P7.4, Q2.4).
// fast-check runs each property at least 100 times. No DOM, no network.

import { describe, expect, it, vi } from "vitest";
import fc from "fast-check";

import { INITIAL_SEAL_STATE, sealReducer } from "../seal-machine";
import type { SealEvent, SealState } from "../seal-machine";
import {
  CLEARED_WRITE_DRAFT,
  canPress,
  initialWriteDraft,
  reduceWriteDraft,
  type BackupChoiceValue,
  type WriteDraft,
  type WriteDraftEvent,
} from "../write-draft";
import { validateWrite } from "../form";
import { createPressController, type PressConfig } from "./usePressEnvelope";

const RUNS = { numRuns: 200 };
const SEALING_DAY = "2026-11-16";

// ---------------------------------------------------------------------------
// Property 7: the seal machine accepts each press only in its source state and
// allows at most two prompts.
// ---------------------------------------------------------------------------

const HASH = "a".repeat(64);

const sealEventArb: fc.Arbitrary<SealEvent> = fc.oneof(
  fc.constant<SealEvent>({ type: "CREATE_PRESS" }),
  fc.constant<SealEvent>({ type: "CREATED" }),
  fc.constant<SealEvent>({ type: "CONFIRM_PRESS" }),
  fc.constant<SealEvent>({ type: "CONFIRMED" }),
  fc.constant<SealEvent>({ type: "PREPARED" }),
  fc.constant<SealEvent>({
    type: "SEALED",
    letterId: "letter-1",
    sealedAt: "2026-11-16T10:00:00.000Z",
    opensAt: "2027-02-16T00:00:00.000Z",
    offsetMs: 0,
    factors: "both",
    envelopeHash: HASH,
  }),
  fc.boolean().map<SealEvent>((passkeyCreated) => ({
    type: "CANNOT_LOCK",
    passkeyCreated,
  })),
  fc
    .tuple(
      fc.constantFrom(
        "network",
        "server",
        "clock",
        "busy",
        "missing_then",
        "too_early",
        "invalid_date",
      ),
      fc.boolean(),
    )
    .map<SealEvent>(([kind, passkeyCreated]) => ({
      type: "FAILED",
      kind: kind as Extract<SealEvent, { type: "FAILED" }>["kind"],
      passkeyCreated,
    })),
  fc.constant<SealEvent>({ type: "CANCELLED" }),
  fc.constant<SealEvent>({ type: "RETRY" }),
  fc.constant<SealEvent>({ type: "FALLBACK_START" }),
  fc.constant<SealEvent>({ type: "FALLBACK_SEAL_PRESS" }),
  fc.constant<SealEvent>({ type: "FALLBACK_DECLINE" }),
);

describe("Property 7: the seal machine accepts each press only in its source state and allows at most two prompts", () => {
  // Feature: 13-the-seal, Property 7: The seal machine accepts each press only in its source state and allows at most two prompts
  it("ignores CREATE_PRESS outside write and CONFIRM_PRESS outside created, and enters creating or confirming at most twice between returns to write", () => {
    fc.assert(
      fc.property(fc.array(sealEventArb, { maxLength: 60 }), (events) => {
        let state: SealState = INITIAL_SEAL_STATE;
        let entriesSinceWrite = 0;

        for (const event of events) {
          const prev = state;
          const next = sealReducer(prev, event);

          if (event.type === "CREATE_PRESS" && prev.tag !== "write") {
            expect(next).toBe(prev);
          }
          if (event.type === "CONFIRM_PRESS" && prev.tag !== "created") {
            expect(next).toBe(prev);
          }

          if (next.tag === "write" && prev.tag !== "write") {
            entriesSinceWrite = 0;
          }
          const entersPrompt =
            (next.tag === "creating" && prev.tag !== "creating") ||
            (next.tag === "confirming" && prev.tag !== "confirming");
          if (entersPrompt) entriesSinceWrite += 1;
          expect(entriesSinceWrite).toBeLessThanOrEqual(2);

          state = next;
        }
      }),
      RUNS,
    );
  });

  it("the two-prompt cap is reached by a press then a confirm, and a further press needs a return to write", () => {
    let state: SealState = INITIAL_SEAL_STATE;
    state = sealReducer(state, { type: "CREATE_PRESS" });
    state = sealReducer(state, { type: "CREATED" });
    state = sealReducer(state, { type: "CONFIRM_PRESS" });
    expect(state.tag).toBe("confirming");
    // A second CREATE_PRESS in confirming changes nothing (no third prompt).
    expect(sealReducer(state, { type: "CREATE_PRESS" })).toBe(state);
    state = sealReducer(state, { type: "CANCELLED" });
    expect(state.tag).toBe("cancelled");
    expect(sealReducer(state, { type: "CREATE_PRESS" })).toBe(state);
    state = sealReducer(state, { type: "RETRY" });
    expect(state.tag).toBe("write");
    expect(sealReducer(state, { type: "CREATE_PRESS" }).tag).toBe("creating");
  });
});

// ---------------------------------------------------------------------------
// Property 8: the press is enabled only when the backup choice is made and the
// input is valid.
// ---------------------------------------------------------------------------

const backupChoiceArb: fc.Arbitrary<BackupChoiceValue | null> = fc.constantFrom(
  null,
  "card" as const,
  "skip" as const,
);

const selfReportedRowArb = fc.record({
  name: fc.string({ maxLength: 20 }),
  value: fc.string({ maxLength: 12 }),
  unit: fc.string({ maxLength: 12 }),
  region: fc.string({ maxLength: 12 }),
  period: fc.oneof(
    fc.constantFrom("", "2026-10", "2026-11", "2027-01", "not a period"),
    fc.string({ maxLength: 10 }),
  ),
});

const draftArb: fc.Arbitrary<WriteDraft> = fc.record({
  text: fc.oneof(
    fc.constant(""),
    fc.constant("   \n\t "),
    fc.string({ maxLength: 40 }),
    fc.string({ minLength: 5001, maxLength: 5003 }),
  ),
  metricIds: fc.uniqueArray(fc.constantFrom("m1", "m2", "m3", "m4", "m5"), {
    maxLength: 6,
  }),
  backupChoice: backupChoiceArb,
  warningTicked: fc.boolean(),
  backupCardTicked: fc.boolean(),
  questions: fc.array(fc.string({ maxLength: 40 }), { maxLength: 4 }),
  answers: fc.array(fc.string({ maxLength: 40 }), { maxLength: 4 }),
  selfReported: fc.array(selfReportedRowArb, { maxLength: 3 }),
});

function draftWriteProblems(draft: WriteDraft) {
  return validateWrite({
    text: draft.text,
    metricIds: draft.metricIds,
    warningTicked: draft.warningTicked,
    backupCardTicked: draft.backupCardTicked,
    questions: draft.questions,
    answers: draft.answers,
    selfReported: draft.selfReported,
    sealingDay: SEALING_DAY,
  });
}

describe("Property 8: the press is enabled only when the backup choice is made and the input is valid", () => {
  // Feature: 13-the-seal, Property 8: The press is enabled only when the backup choice is made and the input is valid
  it("canPress is true if and only if a backup choice is set and validateWrite reports no write problem", () => {
    fc.assert(
      fc.property(draftArb, (draft) => {
        const expected =
          draft.backupChoice !== null && draftWriteProblems(draft).length === 0;
        expect(canPress(draft, SEALING_DAY)).toBe(expected);
      }),
      RUNS,
    );
  });

  it("any backup choice sets warningTicked and backupCardTicked as the reducer defines them", () => {
    fc.assert(
      fc.property(draftArb, backupChoiceArb, (draft, choice) => {
        const next = reduceWriteDraft(draft, {
          type: "BACKUP_CHOICE_CHANGED",
          choice,
        } satisfies WriteDraftEvent);
        expect(next.backupChoice).toBe(choice);
        expect(next.warningTicked).toBe(choice !== null);
        expect(next.backupCardTicked).toBe(choice === "card");
        if (choice === "skip" || choice === "card") {
          expect(next.warningTicked).toBe(true);
          expect(next.backupCardTicked).toBe(choice === "card");
        }
      }),
      RUNS,
    );
  });

  it("a fresh draft with the default question and text still needs a choice before the press opens", () => {
    const draft = {
      ...initialWriteDraft("demo"),
      text: "Dear me",
      metricIds: ["m1"],
      answers: ["I remember it."],
    };
    expect(canPress(draft, SEALING_DAY)).toBe(false);
    // The default question with a blank answer blocks the press (spec 15, R7.4).
    expect(
      canPress({ ...draft, answers: [""] }, SEALING_DAY),
    ).toBe(false);
    expect(
      canPress(
        reduceWriteDraft(draft, { type: "BACKUP_CHOICE_CHANGED", choice: "skip" }),
        SEALING_DAY,
      ),
    ).toBe(true);
    expect(canPress(CLEARED_WRITE_DRAFT, SEALING_DAY)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// P5.2: the passkey prompt never starts from a timer. A press that is held,
// armed or cancelled with no release and no activation starts nothing.
// ---------------------------------------------------------------------------

describe("P5.2: no timer starts the prompt", () => {
  it("down, tick and cancel alone never call onCreatePress or onConfirmPress", () => {
    const onCreatePress = vi.fn();
    const onConfirmPress = vi.fn();
    const config: PressConfig = {
      mode: "write",
      disabled: false,
      instant: false,
      onCreatePress,
      onConfirmPress,
    };
    const controller = createPressController(
      () => config,
      () => undefined,
    );

    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            op: fc.constantFrom("down", "tick", "cancel"),
            gap: fc.integer({ min: 0, max: 1500 }),
          }),
          { maxLength: 40 },
        ),
        (steps) => {
          let now = 0;
          for (const step of steps) {
            now += step.gap;
            if (step.op === "down") controller.down(now);
            else if (step.op === "tick") controller.tick(now);
            else controller.cancel(now);
          }
          controller.reset();
        },
      ),
      RUNS,
    );

    expect(onCreatePress).not.toHaveBeenCalled();
    expect(onConfirmPress).not.toHaveBeenCalled();
  });
});
