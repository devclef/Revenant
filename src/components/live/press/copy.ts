// Feature: 13-the-seal
//
// Copy for the press control on the Seal step (spec 13, design section 2).
// Kept with the press feature so the seal, recall and reveal strings stay
// together for review. Plain, neutral, no exclamation marks (tone.md).

export const PRESS_COPY = {
  /** The accessible name of the one press control. */
  name: "Press the seal",
  /** The one plain line shown while the press is disabled (P1.5). */
  chooseFirst: "Choose what to do about the backup key first.",
  /** The one plain line of the Setting_State (P5.5). No "Confirm your passkey". */
  setting: "Your device will ask once more to set the seal. Press the wax.",
} as const;
