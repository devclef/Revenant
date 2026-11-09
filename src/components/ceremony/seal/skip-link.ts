// Feature: 09-demo-polish
//
// The Skip_Link under the seal (spec 09 C4.2, C4.3). It reads "Skip to the
// receipts" and sends SHOW_ALL exactly once. It is shown while the seal has not
// broken, which is the only time a part of the Reveal can still be hidden at
// stage 1. Once the seal breaks it is gone, so it cannot send a second time.
//
// Pure functions only. SealBreak wires them to the controller.

/** The minimal controller surface the Skip_Link reads and calls. */
export type SkipLinkSeal = {
  /** True once the seal has broken. */
  broken: boolean;
  /** "Show everything": breaks the seal and sends SHOW_ALL. */
  showAll: () => void;
};

/** The Skip_Link shows while the parent asks for it and the seal is not broken. */
export function skipLinkVisible(showAll: boolean, broken: boolean): boolean {
  return showAll && !broken;
}

/**
 * Whether the seal is a registered Skip sequence. It is registered only from
 * the button press (`breaking`) until the seal has broken. At the marks, before
 * any press, nothing is registered, so the Top_Bar shows no Skip.
 */
export function skipRegisteredFor(breaking: boolean, broken: boolean): boolean {
  return breaking && !broken;
}

/**
 * Activate the Skip_Link. Sends SHOW_ALL at most once: a second activation
 * after the seal has broken does nothing.
 */
export function activateSkipLink(seal: SkipLinkSeal): void {
  if (seal.broken) return;
  seal.showAll();
}
