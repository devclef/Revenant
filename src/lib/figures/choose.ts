// The stored-else-bundled-else-null rule for one series (spec 08-judge-polish,
// Fallback_Refresh, Property 1). Pure: no database, no file reads. The caller
// supplies the stored figure and the bundled figure it already looked up.

import type { FigureV1 } from "@/lib/seal-format";

/** The figure a series answers with, and whether it came from the bundled file. */
export interface ChosenFigure {
  readonly figure: FigureV1 | null;
  readonly fallback: boolean;
}

/**
 * The stored-else-bundled-else-null rule (spec 08-judge-polish, Fallback_Refresh,
 * Property 1). A stored figure always wins and is never marked as a fallback. A
 * bundled figure is used only where nothing is stored, and is marked `fallback:
 * true`. Where neither exists the figure is null and `fallback` is false.
 */
export function chooseFigure(
  stored: FigureV1 | null,
  bundled: FigureV1 | null,
): ChosenFigure {
  if (stored !== null) return { figure: stored, fallback: false };
  if (bundled !== null) return { figure: bundled, fallback: true };
  return { figure: null, fallback: false };
}
