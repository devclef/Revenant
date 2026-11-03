// Feature: 07-judge-journey
//
// Pure geometry for the Scene_Frame and the Soil (design.md "The Scene_Frame",
// "SceneBackdrop and the Soil"). The CSS in scene.module.css repeats these
// values; scene-frame.test.ts checks the two agree. Nothing here reads the DOM
// or the clock, so it is testable in the node environment.
//
// Breakpoint rule: "at or above 900 px" is the wide layout. Below it, the
// narrow values apply.

import {
  COLUMN_GAP_UNDER_SOIL_PX,
  EDGE_BAND_PX,
  GHOST_X_IN_FRAME,
  GHOST_X_NARROW,
  NARROW_GHOST_SCALE,
  SCENE_BREAKPOINT_PX,
  SCENE_FRAME_MAX_PX,
  SOIL_BAND_NARROW_VH,
  SOIL_BAND_WIDE_VH,
  SOIL_TOP_NARROW_VH,
  SOIL_TOP_WIDE_VH,
} from "../constants";

/** The gap between the Top_Bar and the lifted scene (design.md "Narrow layout during recall and marks"). */
const LIFT_TOP_GAP_PX = 4;

/** Boxes measured in the page, in pixels from the top of the window. */
export type PickUpBoxes = {
  /** Top of the Ghost_Box (its drawing). */
  ghostTop: number;
  /** Bottom of the pit, the scale's origin. */
  pitBottom: number;
  /** Bottom of the Top_Bar. */
  topBarBottom: number;
  /** Bottom of the Soil strip, before the lift. */
  soilBottom: number;
};

/** The narrow pick-up lift: the scene's `translateY` and the column's start. */
export type PickUpLift = { y: number; columnStart: number };

/** No lift: used when a box cannot be read, so the scene stays where it is. */
export const NO_PICKUP_LIFT: PickUpLift = { y: 0, columnStart: 0 };

/**
 * The narrow lift in `recall` and `marks` (design.md "Narrow layout during
 * `recall` and `marks`"). The Ghost's top is scaled about the pit's bottom by
 * NARROW_GHOST_SCALE. The scene moves up so the scaled top sits under the
 * Top_Bar. The column then starts just under the lifted Soil strip. A box that
 * is missing or not finite returns no lift, so nothing moves on a bad read.
 */
export function narrowPickUpLift(boxes: PickUpBoxes | null): PickUpLift {
  if (boxes === null) return NO_PICKUP_LIFT;
  const values = [boxes.ghostTop, boxes.pitBottom, boxes.topBarBottom, boxes.soilBottom];
  if (!values.every((value) => Number.isFinite(value))) return NO_PICKUP_LIFT;
  const { ghostTop, pitBottom, topBarBottom, soilBottom } = boxes;
  const ghostTopScaled = pitBottom - (pitBottom - ghostTop) * NARROW_GHOST_SCALE;
  const y = topBarBottom + LIFT_TOP_GAP_PX - ghostTopScaled;
  const columnStart = soilBottom + y - topBarBottom + COLUMN_GAP_UNDER_SOIL_PX;
  return { y, columnStart };
}

/**
 * The top padding of the persona column's content, in px, so the headline starts
 * at `columnStart` under the lifted Soil strip (R5.19, R10.15). `columnStart` is
 * measured from the Top_Bar's bottom, so the padding is that point less the
 * column's own top. Null when the lift is the 0-lift fallback or a value is not
 * finite: the column then keeps its CSS padding.
 */
export function narrowColumnPadding(
  boxes: PickUpBoxes | null,
  lift: PickUpLift,
  columnTop: number,
): number | null {
  if (boxes === null || lift === NO_PICKUP_LIFT) return null;
  if (!Number.isFinite(columnTop)) return null;
  return boxes.topBarBottom + lift.columnStart - columnTop;
}

/** True at or above the one R14.1 breakpoint (900 px). */
export function isWideLayout(viewportWidth: number): boolean {
  return viewportWidth >= SCENE_BREAKPOINT_PX;
}

/** Scene_Frame width: `min(100vw, 1440px)`. */
export function frameWidth(viewportWidth: number): number {
  return Math.min(viewportWidth, SCENE_FRAME_MAX_PX);
}

/** Left edge of the Scene_Frame: `(100vw - frameW) / 2`. */
export function frameLeft(viewportWidth: number): number {
  return (viewportWidth - frameWidth(viewportWidth)) / 2;
}

/**
 * The x of the light and the Ghost's pit, in pixels from the window's left
 * edge. At or above 900 px it is `frameL + 72 % of frameW`; below, 50 % of the
 * window. It does not depend on the Stage, so the light never moves sideways.
 */
export function ghostCentreX(viewportWidth: number): number {
  if (!isWideLayout(viewportWidth)) {
    return viewportWidth * GHOST_X_NARROW;
  }
  return frameLeft(viewportWidth) + frameWidth(viewportWidth) * GHOST_X_IN_FRAME;
}

/** Soil top, in pixels from the top of a viewport of this height. */
export function soilTopPx(viewportWidth: number, viewportHeight: number): number {
  const vh = isWideLayout(viewportWidth) ? SOIL_TOP_WIDE_VH : SOIL_TOP_NARROW_VH;
  return (viewportHeight * vh) / 100;
}

/** Soil strip height, in pixels. */
export function soilBandPx(viewportWidth: number, viewportHeight: number): number {
  const vh = isWideLayout(viewportWidth) ? SOIL_BAND_WIDE_VH : SOIL_BAND_NARROW_VH;
  return (viewportHeight * vh) / 100;
}

/** Soil strip bottom, in pixels. Below it the page is the plain background. */
export function soilBottomPx(viewportWidth: number, viewportHeight: number): number {
  return soilTopPx(viewportWidth, viewportHeight) + soilBandPx(viewportWidth, viewportHeight);
}

/**
 * The jag's points sit between these two shares of the strip height (R6.3),
 * and no point is higher than SOIL_JAG_CAP_PX. The cap keeps the jag inside the
 * 14 px band on a tall window, where 11 % of the strip would be more than 14 px.
 * The CSS writes each point as `min(share, 12px)`.
 */
export const SOIL_JAG_MIN_SHARE = 0.02;
export const SOIL_JAG_MAX_SHARE = 0.11;
export const SOIL_JAG_CAP_PX = 12;

/** The jag's highest point in pixels, for a strip of this height. */
export function soilJagMaxPx(bandPx: number): number {
  return Math.min(bandPx * SOIL_JAG_MAX_SHARE, SOIL_JAG_CAP_PX);
}

/** The jag band the design allows above the soil, in pixels (R6.3). */
export const SOIL_EDGE_BAND_PX = EDGE_BAND_PX;

/**
 * The x of the Soil_Canvas light, in pixels from the window's left edge. It is
 * the same rule as `ghostCentreX`, under the name the Soil_Canvas uses: at or
 * above 900 px `frameL + 0.72 × frameW`, below it `w / 2`. It never depends on
 * the Stage, so the base is not redrawn when the Stage changes.
 */
export function lightX(viewportWidth: number): number {
  return ghostCentreX(viewportWidth);
}
