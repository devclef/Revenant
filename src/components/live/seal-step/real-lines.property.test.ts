// Feature: 19-real-sealing-stepper, Property 6: Real seal-step lines change only where specified and never name the demo
//
// Property test over the real and default inputs of pressStatusLine and
// sealStepsView (spec 19, design "Correctness Properties" 6). Demo_Mode output
// is the baseline: a real call may differ only on the lines the spec names, and
// no real line may contain the word "demo". fast-check runs each property at
// least 100 times.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { REAL_COPY } from "../copy";
import { PRESS_COPY } from "../press/copy";
import type { BackupChoiceValue } from "../write-draft";
import {
  pressStatusLine,
  type MotionSetting,
  type PressStatusTag,
} from "./press-status";
import { sealStepsView } from "./seal-steps";

const TAGS: readonly PressStatusTag[] = [
  "write",
  "creating",
  "created",
  "confirming",
  "preparing",
  "sealing",
];
const CHOICES: readonly (BackupChoiceValue | null)[] = [null, "card", "skip"];
const MOTIONS: readonly MotionSetting[] = ["full", "reduced", "calm"];

const tagArb = fc.constantFrom(...TAGS);
const choiceArb = fc.constantFrom(...CHOICES);
const motionArb = fc.constantFrom(...MOTIONS);
const flagArb = fc.option(fc.boolean(), { nil: undefined });

const DEMO_WORD = /demo/i;

describe("pressStatusLine real inputs (spec 19, Property 6)", () => {
  it("differs from the Demo_Mode line only for a write state with a choice and an unset date", () => {
    fc.assert(
      fc.property(
        tagArb,
        choiceArb,
        motionArb,
        flagArb,
        (tag, backupChoice, motion, needsDate) => {
          const real = pressStatusLine({
            tag,
            backupChoice,
            motion,
            needsDate,
          });
          const demo = pressStatusLine({ tag, backupChoice, motion });
          const specified =
            tag === "write" && backupChoice !== null && needsDate === true;
          if (specified) {
            expect(real).toEqual({
              text: REAL_COPY.pressNeedsDate,
              tone: "muted",
            });
          } else {
            expect(real).toEqual(demo);
          }
        },
      ),
    );
  });

  it("never names the demo on a real line", () => {
    fc.assert(
      fc.property(tagArb, choiceArb, motionArb, (tag, backupChoice, motion) => {
        const real = pressStatusLine({
          tag,
          backupChoice,
          motion,
          needsDate: true,
        });
        expect(real.text).not.toMatch(DEMO_WORD);
        expect(REAL_COPY.pressNeedsDate).not.toMatch(DEMO_WORD);
      }),
    );
  });
});

describe("sealStepsView real inputs (spec 19, Property 6)", () => {
  it("changes only the two first-press hints, never the states or the second hint", () => {
    fc.assert(
      fc.property(
        tagArb,
        choiceArb,
        fc.boolean(),
        (tag, backupChoice, real) => {
          const demo = sealStepsView({ tag, backupChoice });
          const realView = sealStepsView({ tag, backupChoice, real });
          // States are the same in both modes.
          expect(realView.one.state).toBe(demo.one.state);
          expect(realView.two.state).toBe(demo.two.state);
          // The second press hint never changes.
          expect(realView.two.hint).toBe(demo.two.hint);
          // Press one's hint changes only to the matching REAL_COPY line.
          if (real && demo.one.hint === PRESS_COPY.stepOneHint) {
            expect(realView.one.hint).toBe(REAL_COPY.stepOneHint);
          } else if (real && demo.one.hint === PRESS_COPY.stepPasskeyMade) {
            expect(realView.one.hint).toBe(REAL_COPY.stepPasskeyMade);
          } else {
            expect(realView.one.hint).toBe(demo.one.hint);
          }
        },
      ),
    );
  });

  it("never names the demo on a real hint", () => {
    fc.assert(
      fc.property(tagArb, choiceArb, (tag, backupChoice) => {
        const view = sealStepsView({ tag, backupChoice, real: true });
        for (const hint of [view.one.hint, view.two.hint]) {
          if (hint !== null) expect(hint).not.toMatch(DEMO_WORD);
        }
      }),
    );
  });
});
