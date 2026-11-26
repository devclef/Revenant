// Feature: 20-easier-sealing-and-receipts (spec 20, design 1.5 and Requirement 16.2).
//
// The press and Seal_Button strings that spec 20 changed or added. Each one is
// non-empty, passes the Tone_Check, and equals its design 1.5 value. The
// Tone_Check is copy-tone.ts's toneProblems, the same check the other copy
// tests use.

import { describe, expect, it } from "vitest";

import { toneProblems } from "@/components/copy-tone";

import { REAL_COPY } from "./copy";
import { PRESS_COPY } from "./press/copy";

const NAMED: ReadonlyArray<readonly [string, string, string]> = [
  [
    "PRESS_COPY.holdToSeal",
    PRESS_COPY.holdToSeal,
    "Press and hold the wax, or use the button under it.",
  ],
  [
    "PRESS_COPY.pressToSeal",
    PRESS_COPY.pressToSeal,
    "Press the wax, or use the button under it.",
  ],
  [
    "PRESS_COPY.setting",
    PRESS_COPY.setting,
    "Your device will ask once more to set the seal. Press the wax, or use the button under it.",
  ],
  [
    "PRESS_COPY.fixFields",
    PRESS_COPY.fixFields,
    "Fix the fields marked above. Then press the wax, or use the button under it.",
  ],
  [
    "PRESS_COPY.stepOneHint",
    PRESS_COPY.stepOneHint,
    'Press the wax, or use the button under it. The passkey is saved as "Revenant demo".',
  ],
  [
    "PRESS_COPY.stepTwoHint",
    PRESS_COPY.stepTwoHint,
    "Your device will ask once more to set the seal. Press the wax, or use the button under it.",
  ],
  ["PRESS_COPY.sealButtonCreate", PRESS_COPY.sealButtonCreate, "Make your passkey"],
  ["PRESS_COPY.sealButtonSet", PRESS_COPY.sealButtonSet, "Set the seal"],
  [
    "REAL_COPY.stepOneHint",
    REAL_COPY.stepOneHint,
    "Press the wax, or use the button under it. The passkey is named for this letter's opening date.",
  ],
];

describe("Seal_Button and press copy (spec 20, design 1.5)", () => {
  it.each(NAMED)("%s is non-empty, passes the Tone_Check and equals its design value", (_name, value, expected) => {
    expect(typeof value).toBe("string");
    expect(value.length).toBeGreaterThan(0);
    expect(toneProblems(value)).toEqual([]);
    expect(value).toBe(expected);
  });

  it("keeps the two button labels equal to the press list's words", () => {
    expect(PRESS_COPY.sealButtonCreate).toBe(PRESS_COPY.stepOne);
    expect(PRESS_COPY.sealButtonSet).toBe(PRESS_COPY.stepTwo);
  });
});
