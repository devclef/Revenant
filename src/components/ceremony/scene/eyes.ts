// Feature: 07-judge-journey
//
// Eye follow (design.md "Eye follow", R5.5 to R5.8). Pure functions only: the
// Ghost reads a pointer, asks this module for the offset, and applies it.
// Nothing here touches the DOM, so the rule is testable without a browser.

import { EYE_FOLLOW_RADIUS_PX, EYE_MAX_X, EYE_MAX_Y } from "../constants";
import type { EyeOffset } from "./ghost-geometry";

/** A point in CSS pixels, in the viewport's coordinate space. */
export type EyePoint = { x: number; y: number };

/**
 * The eyes' offset for a pointer at `pointer`, with the eyes centred at
 * `centre`. Both points are in CSS pixels.
 *
 * The offset points from the centre towards the pointer. Its length grows with
 * the distance and reaches the full offset at EYE_FOLLOW_RADIUS_PX. Because
 * dx and dy are scaled by EYE_MAX_X and EYE_MAX_Y, the length is at most
 * EYE_MAX_OFFSET (5). A pointer exactly on the centre gives (0, 0).
 */
export function eyeOffset(pointer: EyePoint, centre: EyePoint): EyeOffset {
  const ox = pointer.x - centre.x;
  const oy = pointer.y - centre.y;
  const distance = Math.hypot(ox, oy);
  if (distance === 0) return { dx: 0, dy: 0 };

  const k = Math.min(1, distance / EYE_FOLLOW_RADIUS_PX);
  return {
    dx: (ox / distance) * EYE_MAX_X * k,
    dy: (oy / distance) * EYE_MAX_Y * k,
  };
}

/**
 * Whether a pointer event moves the eyes. Only `mouse` and `pen` do (R5.7).
 * Touch and keyboard leave the eyes idle. In Calm there is no follow at all
 * (R5.7), so `calm` wins over the pointer type.
 */
export function followsPointer(pointerType: string, calm: boolean): boolean {
  if (calm) return false;
  return pointerType === "mouse" || pointerType === "pen";
}
