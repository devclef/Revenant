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
  EDGE_BAND_PX,
  GHOST_X_IN_FRAME,
  GHOST_X_NARROW,
  SCENE_BREAKPOINT_PX,
  SCENE_FRAME_MAX_PX,
  SOIL_BAND_NARROW_VH,
  SOIL_BAND_WIDE_VH,
  SOIL_TOP_NARROW_VH,
  SOIL_TOP_WIDE_VH,
} from "../constants";

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
