// Feature: 20-easier-sealing-and-receipts, Part B (Simulated_Mode).
//
// The Backup_Choice gate for Simulated_Mode (design.md section 4.2, Requirements
// 12.1, 12.3, 12.4). Simulated_Mode is only a demo mode, and it needs a backup
// key card, so while it is on the choice is always "card". No React here, so
// SealPage and the property test run the same code.

import type { BackupChoiceValue, WriteDraftEvent } from "../write-draft";

/** The value the gate returns for a change that must be ignored. */
export const IGNORE_CHOICE = "ignore" as const;

/**
 * What a Backup_Choice change should become while Simulated_Mode is on or off.
 * While it is on, only "card" is kept and any other change (a "skip" or a
 * cleared choice) returns "ignore". While it is off, the choice passes through
 * unchanged, so turning it off leaves the chosen card alone (Requirement 12.4).
 */
export function simulatedChoice(
  simulated: boolean,
  choice: BackupChoiceValue | null,
): BackupChoiceValue | null | typeof IGNORE_CHOICE {
  if (!simulated) return choice;
  return choice === "card" ? "card" : IGNORE_CHOICE;
}

/**
 * The write-draft event dispatched when Simulated_Mode is switched. Turning it
 * on selects the backup card. Turning it off dispatches nothing, so the choice
 * stays "card" until the visitor changes it (Requirement 12.4).
 */
export function simulatedToggleEvent(on: boolean): WriteDraftEvent | null {
  return on ? { type: "BACKUP_CHOICE_CHANGED", choice: "card" } : null;
}
