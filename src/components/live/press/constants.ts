/**
 * Timing for pressing the seal on the Seal_Step (spec 13, design section 2).
 *
 * Time is passed into the press model; these constants are the only numbers
 * it reads from the clock settings.
 */

/** How long the press must be held before the passkey prompt may start (P2.1). Between 600 and 1500 ms. */
export const SEAL_PRESS_HOLD_MS = 900;

/** How long the wax pool takes to recede after a release that did not finish the hold. */
export const SEAL_PRESS_SETTLE_MS = 300;
