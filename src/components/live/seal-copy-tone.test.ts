// Feature: 20-easier-sealing-and-receipts (spec 20, design 1.5 and Requirement 16.2).
//
// The press and Seal_Button strings that spec 20 changed or added. Each one is
// non-empty, passes the Tone_Check, and equals its design 1.5 value. The
// Tone_Check is copy-tone.ts's toneProblems, the same check the other copy
// tests use.

import { describe, expect, it } from "vitest";

import { toneProblems } from "@/components/copy-tone";

import { LIVE_COPY, REAL_COPY } from "./copy";
import { PRESS_COPY } from "./press/copy";
import { sealStepCopy } from "./seal-step/simulated-copy";

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
  [
    "LIVE_COPY.noPrfPress",
    LIVE_COPY.noPrfPress,
    "Save the key and tick the box. Then choose Seal with this key.",
  ],
  [
    "REAL_COPY.intro",
    REAL_COPY.intro,
    "Your letter is sealed in this browser with your passkey or a backup key.",
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

// Feature: 20-easier-sealing-and-receipts (Part B, Requirements 11.7, 16.2 to 16.6).
//
// Every Simulated_Mode key is listed by name and passes the Tone_Check. The
// wording rules for the leave-the-tab, lost-key and passkey-name lines are
// checked on the same strings.

const SIMULATED_KEYS: ReadonlyArray<readonly [string, string]> = [
  ["LIVE_COPY.simulateLabel", LIVE_COPY.simulateLabel],
  ["LIVE_COPY.simulatedNotice", LIVE_COPY.simulatedNotice],
  ["LIVE_COPY.simulatedBackupRequired", LIVE_COPY.simulatedBackupRequired],
  ["LIVE_COPY.simulatedKeyReminder", LIVE_COPY.simulatedKeyReminder],
  ["LIVE_COPY.simulatedUnavailable", LIVE_COPY.simulatedUnavailable],
  ["LIVE_COPY.sealParagraphSimulated", LIVE_COPY.sealParagraphSimulated],
  ["LIVE_COPY.warningSimulated", LIVE_COPY.warningSimulated],
  ["LIVE_COPY.stepCreatingSimulated", LIVE_COPY.stepCreatingSimulated],
  ["LIVE_COPY.stepCreatedSimulated", LIVE_COPY.stepCreatedSimulated],
  ["LIVE_COPY.stepConfirmingSimulated", LIVE_COPY.stepConfirmingSimulated],
  ["PRESS_COPY.settingSimulated", PRESS_COPY.settingSimulated],
  ["PRESS_COPY.stepOneHintSimulated", PRESS_COPY.stepOneHintSimulated],
  ["PRESS_COPY.stepPasskeyMadeSimulated", PRESS_COPY.stepPasskeyMadeSimulated],
  ["PRESS_COPY.stepTwoHintSimulated", PRESS_COPY.stepTwoHintSimulated],
  ["PRESS_COPY.sealButtonCreateSimulated", PRESS_COPY.sealButtonCreateSimulated],
];

/** Simulated_Mode strings, excluding the one that may name the passkey manager. */
const SIMULATED_VALUES = SIMULATED_KEYS.filter(
  ([name]) => name !== "LIVE_COPY.simulatedNotice",
).map(([, value]) => value);

const PASSKEY_MODE_NAMES = [
  "your device will ask",
  "waiting for your device",
  "saved as",
  "passkey manager",
  "revenant demo",
];

describe("Simulated_Mode copy (spec 20, Part B, Requirements 11.7, 16.2 to 16.6)", () => {
  it.each(SIMULATED_KEYS)("%s is non-empty and passes the Tone_Check", (_name, value) => {
    expect(value.length).toBeGreaterThan(0);
    expect(toneProblems(value)).toEqual([]);
  });

  it("says leave or reload in simulatedNotice and simulatedKeyReminder", () => {
    expect(LIVE_COPY.simulatedNotice).toContain("leave or reload");
    expect(LIVE_COPY.simulatedKeyReminder).toContain("leave or reload");
  });

  it("keeps the lost-key and cannot-recover sentences in the warnings, with no may or might", () => {
    const warnings = [
      LIVE_COPY.fallbackWarning,
      LIVE_COPY.warningSimulated,
      LIVE_COPY.simulatedBackupRequired,
      LIVE_COPY.simulatedKeyReminder,
    ];
    for (const text of warnings) {
      expect(text).toContain("lost key means a lost letter");
      expect(text).toContain("cannot recover");
      expect(text).not.toMatch(/\b(may|might)\b/i);
    }
  });

  it("never puts tab next to close or shut in a new string", () => {
    const pair = /\btab\b[^.]*\b(close|shut)\b|\b(close|shut)\b[^.]*\btab\b/i;
    for (const [, value] of SIMULATED_KEYS) {
      expect(value).not.toMatch(pair);
    }
  });

  it("uses no Requirement 16.6 phrase in a Simulated_Mode string except the passkey manager line in simulatedNotice", () => {
    for (const value of SIMULATED_VALUES) {
      for (const phrase of PASSKEY_MODE_NAMES) {
        expect(value.toLowerCase()).not.toContain(phrase);
      }
    }
    expect(LIVE_COPY.simulatedNotice.toLowerCase()).not.toContain("your device will ask");
    expect(LIVE_COPY.simulatedNotice.toLowerCase()).not.toContain("waiting for your device");
    expect(LIVE_COPY.simulatedNotice.toLowerCase()).not.toContain("saved as");
    expect(LIVE_COPY.simulatedNotice.toLowerCase()).not.toContain("revenant demo");
  });

  it("gives the passkey-mode lines with simulated false and the simulated lines with true", () => {
    const off = sealStepCopy(false);
    const on = sealStepCopy(true);
    expect(off.sealParagraph).toBe(LIVE_COPY.sealParagraph);
    expect(on.sealParagraph).toBe(LIVE_COPY.sealParagraphSimulated);
    expect(on.warning).toBe(LIVE_COPY.warningSimulated);
    expect(on.stepCreating).toBe(LIVE_COPY.stepCreatingSimulated);
    expect(on.stepCreated).toBe(LIVE_COPY.stepCreatedSimulated);
    expect(on.stepConfirming).toBe(LIVE_COPY.stepConfirmingSimulated);
    expect(on.setting).toBe(PRESS_COPY.settingSimulated);
    expect(on.stepOneHint).toBe(PRESS_COPY.stepOneHintSimulated);
    expect(on.stepPasskeyMade).toBe(PRESS_COPY.stepPasskeyMadeSimulated);
    expect(on.stepTwoHint).toBe(PRESS_COPY.stepTwoHintSimulated);
    expect(on.sealButtonCreate).toBe(PRESS_COPY.sealButtonCreateSimulated);
    expect(off.sealButtonCreate).toBe(PRESS_COPY.sealButtonCreate);
    expect(off.warning).toBe(LIVE_COPY.warning);
  });
});
