// Feature: 09-demo-polish
//
// Where the pressable wax seal is drawn in `marks` and `seal` (spec 09 C5.1,
// C5.2, design "C5. The seal at the Ghost"). At the Desktop_Sizes and the
// Wide_Size the seal sits on the Envelope the Ghost holds, and the Content_Column
// keeps only the "Break the seal" button and the Skip_Link. Below the R14.1
// breakpoint (900 CSS px) the seal stays in the Content_Column, as it was.
//
// The rule is pure so the width classes can be tested without a DOM. The
// Envelope's slot exists only after the client mounts it, so `slotReady` is
// false on the server and on the first client render, and the seal stays in the
// Content_Column until the slot is there.

/** The R14.1 breakpoint: the Desktop_Sizes start here (spec 09 C5.1). */
export const SEAL_ON_ENVELOPE_MIN_PX = 900;

export type SealPlacement = "envelope" | "content";

export type SealPlacementInput = {
  /** The viewport width in CSS px, or null before the client has read it. */
  viewportWidth: number | null;
  /** True once the held Envelope's slot is mounted in the Ghost. */
  slotReady: boolean;
};

/**
 * "envelope" when the viewport is a Desktop_Size or the Wide_Size and the held
 * Envelope is mounted; "content" otherwise (the Phone_Sizes, the tablet band
 * below 900 px, an unknown width, or no Envelope yet).
 */
export function sealPlacement({ viewportWidth, slotReady }: SealPlacementInput): SealPlacement {
  if (!slotReady || viewportWidth === null) return "content";
  return viewportWidth >= SEAL_ON_ENVELOPE_MIN_PX ? "envelope" : "content";
}

/** The Break the seal wax width floor and ceiling in CSS px (spec 13 U8.1, U8.2). */
export const BREAK_SEAL_MIN_PX = 120;
export const BREAK_SEAL_MAX_PX = 160;
/** The fluid share of the viewport width between the floor and the ceiling. */
export const BREAK_SEAL_VW = 12;

/**
 * The Break the seal width in CSS px at a viewport width. It is the same rule as
 * `--break-seal-d` in scene/tokens.css, `clamp(120px, 12vw, 160px)`: 120 px at
 * the phone widths and 160 px from 1334 px wide up (so at 1440 it is 160 px).
 */
export function breakSealWidthPx(viewportWidth: number): number {
  const fluid = (BREAK_SEAL_VW / 100) * viewportWidth;
  return Math.min(BREAK_SEAL_MAX_PX, Math.max(BREAK_SEAL_MIN_PX, fluid));
}
