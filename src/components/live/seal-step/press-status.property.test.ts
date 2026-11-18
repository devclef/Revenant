// Feature: 14-write-desk, Property 2: The Press_Status_Line is never empty and follows its table
//
// Property test for pressStatusLine (spec 14, design "Correctness Properties" 2;
// requirements S6.6, S6.7, Q2.6). fast-check runs each property at least 100 times.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { LIVE_COPY } from "../copy";
import { PRESS_COPY } from "../press/copy";
import type { BackupChoiceValue } from "../write-draft";
import {
  envelopeCaption,
  pressStatusLine,
  type MotionSetting,
  type PressStatusTag,
} from "./press-status";

const TAGS: readonly PressStatusTag[] = ["write", "creating", "created", "confirming", "preparing", "sealing"];
const CHOICES: readonly (BackupChoiceValue | null)[] = [null, "card", "skip"];
const MOTIONS: readonly MotionSetting[] = ["full", "reduced", "calm"];

/** The S6.7 table, written out again here so the test does not reuse the code under test. */
function expectedLine(
  tag: PressStatusTag,
  choice: BackupChoiceValue | null,
  motion: MotionSetting,
): { text: string; tone: "muted" | "accent" } {
  if (tag === "write") {
    if (choice === null) return { text: PRESS_COPY.chooseFirst, tone: "muted" };
    return {
      text: motion === "full" ? PRESS_COPY.holdToSeal : PRESS_COPY.pressToSeal,
      tone: "accent",
    };
  }
  const text: Record<Exclude<PressStatusTag, "write">, string> = {
    creating: LIVE_COPY.stepCreating,
    created: PRESS_COPY.setting,
    confirming: LIVE_COPY.stepConfirming,
    preparing: LIVE_COPY.stepPreparing,
    sealing: LIVE_COPY.stepSealing,
  };
  return { text: text[tag], tone: "muted" };
}

const tagArb = fc.constantFrom(...TAGS);
const choiceArb = fc.constantFrom(...CHOICES);
const motionArb = fc.constantFrom(...MOTIONS);

describe("pressStatusLine (spec 14, Property 2)", () => {
  it("is never empty and follows the S6.7 table for every input", () => {
    fc.assert(
      fc.property(tagArb, choiceArb, motionArb, (tag, backupChoice, motion) => {
        const status = pressStatusLine({ tag, backupChoice, motion });
        expect(status.text.trim().length).toBeGreaterThan(0);
        expect(status).toEqual(expectedLine(tag, backupChoice, motion));
      }),
    );
  });

  it("uses the accent tone exactly when the tag is write and a choice is made", () => {
    fc.assert(
      fc.property(tagArb, choiceArb, motionArb, (tag, backupChoice, motion) => {
        const { tone } = pressStatusLine({ tag, backupChoice, motion });
        expect(tone === "accent").toBe(tag === "write" && backupChoice !== null);
      }),
    );
  });

  it("never shows the created-state line that the Seal step must not repeat", () => {
    fc.assert(
      fc.property(tagArb, choiceArb, motionArb, (tag, backupChoice, motion) => {
        expect(pressStatusLine({ tag, backupChoice, motion }).text).not.toBe(LIVE_COPY.stepCreated);
      }),
    );
  });
});

describe("envelopeCaption (spec 14, S6.2)", () => {
  it("names the count, singular for one and bare for none", () => {
    expect(envelopeCaption(0)).toBe("To me, on opening day");
    expect(envelopeCaption(1)).toBe("To me, on opening day · 1 question on top");
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 50 }), (n) => {
        expect(envelopeCaption(n)).toBe(`To me, on opening day · ${n} questions on top`);
      }),
    );
  });
});
