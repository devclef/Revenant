import { MAX_FIGURES, MAX_LETTER_CODE_POINTS, MIN_FIGURES } from "./constants";

/**
 * Pure form rules for the live Seal_Page (spec 06, design.md "form.ts"). Each
 * problem maps to one key in LIVE_COPY. These rules run before any request is
 * sent. The server applies its own limits.
 *
 * Pure module: no imports beyond the constants, safe in the browser and tests.
 */

/** A rule the write form breaks. Each value names one message in LIVE_COPY. */
export type WriteProblem =
  | "letter_empty"
  | "letter_too_long"
  | "figures_none"
  | "figures_too_many"
  | "warning_unticked";

/**
 * Count the letter length in Unicode code points, so an emoji or an accented
 * letter written as two code units still counts once (R12.4).
 */
export function countCodePoints(s: string): number {
  return [...s].length;
}

/**
 * Check a write against the live Seal_Page rules. An empty array means the
 * write is valid. The problems come in this fixed order: letter, figures, then
 * the passkey warning (R12.3, R13.2, R15.11). The warning is required only when
 * no backup key card is chosen: a backup key card is the second way in (R21.2).
 *
 * A letter is empty when it has no character other than whitespace.
 */
/**
 * The most figures a visitor may choose from the series offered: the smaller of
 * MAX_FIGURES and the offered count (spec 08, R10.7). Today that is 4.
 */
export function figureLimit(offeredCount: number): number {
  return Math.min(MAX_FIGURES, Math.max(0, Math.floor(offeredCount)));
}

export function validateWrite(input: {
  text: string;
  metricIds: readonly string[];
  warningTicked: boolean;
  /** The optional backup key card box (R21.1). Defaults to unticked. */
  backupCardTicked?: boolean;
  /** The figure maximum for this picker. Defaults to MAX_FIGURES. */
  maxFigures?: number;
}): WriteProblem[] {
  const maxFigures = input.maxFigures ?? MAX_FIGURES;
  const problems: WriteProblem[] = [];

  if (input.text.trim().length === 0) {
    problems.push("letter_empty");
  } else if (countCodePoints(input.text) > MAX_LETTER_CODE_POINTS) {
    problems.push("letter_too_long");
  }

  if (input.metricIds.length < MIN_FIGURES) {
    problems.push("figures_none");
  } else if (input.metricIds.length > maxFigures) {
    problems.push("figures_too_many");
  }

  if (!input.warningTicked && input.backupCardTicked !== true) {
    problems.push("warning_unticked");
  }

  return problems;
}
