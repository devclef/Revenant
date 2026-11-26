// Feature: 20-easier-sealing-and-receipts, Part B, Property 14: while Simulated_Mode
// is on, the Backup_Choice stays "card" and the card is ticked
// (Requirements 12.1, 12.3, 12.4).
//
// The gate and the toggle run through the write-draft reducer the page uses, and
// each property runs at least 100 times (fast-check default).

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import {
  INITIAL_WRITE_DRAFT,
  reduceWriteDraft,
  type BackupChoiceValue,
  type WriteDraft,
} from "../write-draft";
import {
  IGNORE_CHOICE,
  simulatedChoice,
  simulatedToggleEvent,
} from "./simulated-mode";

const CHOICES: readonly (BackupChoiceValue | null)[] = [null, "card", "skip"];
const choiceArb = fc.constantFrom(...CHOICES);

type Step =
  | { kind: "on" }
  | { kind: "off" }
  | { kind: "choose"; choice: BackupChoiceValue | null };

const stepArb: fc.Arbitrary<Step> = fc.oneof(
  fc.constant<Step>({ kind: "on" }),
  fc.constant<Step>({ kind: "off" }),
  choiceArb.map((choice): Step => ({ kind: "choose", choice })),
);

/** Start a draft with the given Backup_Choice, through the reducer. */
function draftWith(choice: BackupChoiceValue | null): WriteDraft {
  return reduceWriteDraft(INITIAL_WRITE_DRAFT, { type: "BACKUP_CHOICE_CHANGED", choice });
}

describe("simulatedChoice gate (spec 20, Part B)", () => {
  it("passes every choice through while Simulated_Mode is off", () => {
    for (const choice of CHOICES) {
      expect(simulatedChoice(false, choice)).toBe(choice);
    }
  });

  it("keeps only 'card' while Simulated_Mode is on", () => {
    expect(simulatedChoice(true, "card")).toBe("card");
    expect(simulatedChoice(true, "skip")).toBe(IGNORE_CHOICE);
    expect(simulatedChoice(true, null)).toBe(IGNORE_CHOICE);
  });
});

describe("simulatedToggleEvent (spec 20, Part B)", () => {
  it("turning the mode on dispatches BACKUP_CHOICE_CHANGED with 'card'", () => {
    expect(simulatedToggleEvent(true)).toEqual({ type: "BACKUP_CHOICE_CHANGED", choice: "card" });
  });

  it("turning the mode off dispatches nothing", () => {
    expect(simulatedToggleEvent(false)).toBeNull();
  });
});

describe("Property 14: Simulated_Mode holds the Backup_Choice at 'card'", () => {
  it("keeps the card ticked after every event while the mode is on, and turning it off changes nothing", () => {
    fc.assert(
      fc.property(choiceArb, fc.array(stepArb, { maxLength: 10 }), (start, steps) => {
        let draft = draftWith(start);
        let simulated = false;

        for (const step of steps) {
          const before = draft;
          if (step.kind === "on") {
            simulated = true;
            const event = simulatedToggleEvent(true);
            if (event !== null) draft = reduceWriteDraft(draft, event);
          } else if (step.kind === "off") {
            simulated = false;
            const event = simulatedToggleEvent(false);
            if (event !== null) draft = reduceWriteDraft(draft, event);
            // Turning it off dispatches nothing, so the draft is unchanged.
            expect(draft).toBe(before);
          } else {
            const next = simulatedChoice(simulated, step.choice);
            if (next !== IGNORE_CHOICE) {
              draft = reduceWriteDraft(draft, { type: "BACKUP_CHOICE_CHANGED", choice: next });
            }
          }

          if (simulated) {
            expect(draft.backupChoice).toBe("card");
            expect(draft.backupCardTicked).toBe(true);
            expect(draft.warningTicked).toBe(true);
          }
        }
      }),
    );
  });

  it("after the mode is turned off the choice stays 'card' until a later change", () => {
    fc.assert(
      fc.property(choiceArb, fc.array(choiceArb, { maxLength: 10 }), (start, later) => {
        let draft = draftWith(start);
        draft = reduceWriteDraft(draft, { type: "BACKUP_CHOICE_CHANGED", choice: "card" });
        // Simulated_Mode is switched off. The choice is still "card".
        expect(simulatedToggleEvent(false)).toBeNull();
        expect(draft.backupChoice).toBe("card");
        expect(draft.backupCardTicked).toBe(true);

        // A later change with the mode off passes through unchanged.
        for (const choice of later) {
          const next = simulatedChoice(false, choice);
          expect(next).toBe(choice);
          draft = reduceWriteDraft(draft, { type: "BACKUP_CHOICE_CHANGED", choice: next as BackupChoiceValue | null });
          expect(draft.backupChoice).toBe(choice);
        }
      }),
    );
  });
});
