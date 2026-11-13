// Same-figure check (spec 03-persona-demo, issue #383).
//
// isSameFigure answers one question: do two sealed figures record the same
// official observation? It is an exact comparison. There is no Number(),
// tolerance or rounding, and no parseFloat or parseInt on any value.
//
// This module imports nothing from src/lib/crypto, src/lib/db or Node
// built-ins, so it is pure and safe to use in the browser and on the server.

import type { FigureV1 } from "@/lib/seal-format";
import { isZero, parseDecimal, sub } from "./decimal";

/**
 * True only when both figures are official, their source, series_id, unit,
 * region and period are equal strings, and their values are equal as exact
 * decimals (so "3.40" and "3.4" are the same figure).
 *
 * Returns false when either value does not parse as a decimal. The caller
 * (computeChange) then decides the result.
 */
export function isSameFigure(then: FigureV1, now: FigureV1): boolean {
  if (then.kind !== "official" || now.kind !== "official") {
    return false;
  }
  if (
    then.source !== now.source ||
    then.series_id !== now.series_id ||
    then.unit !== now.unit ||
    then.region !== now.region ||
    then.period !== now.period
  ) {
    return false;
  }

  let difference;
  try {
    difference = sub(parseDecimal(then.value), parseDecimal(now.value));
  } catch {
    return false;
  }
  return isZero(difference);
}
