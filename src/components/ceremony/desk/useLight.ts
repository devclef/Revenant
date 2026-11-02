"use client";

// Feature: 05-reveal-ceremony
//
// The pointer-light hook for the desk (design.md "Desk", R13.6, R8.6). As the
// pointer moves over the desk it drives two decorative CSS custom properties on
// a target element:
//
//   --light-x / --light-y   the candle light's position, in the element's own
//                            coordinate space (0 at the left/top edge, 1 at the
//                            right/bottom edge, clamped). The CSS reads these to
//                            place the radial-gradient candle layer.
//
//   --parallax-x / --parallax-y   the parallax offset in pixels, within
//                            PARALLAX_MAX_PX of centre; --parallax-deg the tilt
//                            in degrees, within PARALLAX_MAX_DEG. The CSS reads
//                            these to shift and tilt the parallax plane.
//
// This is the task-1 scene base: pointer-driven light and the parallax plane.
// Device-orientation tilt (tilt.ts) is task 7 and is NOT wired here.
//
// rAF-throttled: a `pointermove` only records the latest event and schedules a
// single animation frame; the DOM writes happen once per frame, never per
// event. Everything that touches the DOM, `requestAnimationFrame` or
// `performance` runs inside the effect, never during render, so the server and
// first client render produce identical markup (Property 21 / the ceremony
// source scan). No `Math.random` and no `Date.now` anywhere. All listeners and
// the pending frame are cleaned up on unmount or when motion leaves `full`.
//
// Imports no `@/lib/crypto`.

import { useEffect, useRef } from "react";

import { PARALLAX_MAX_DEG, PARALLAX_MAX_PX } from "../constants";
import { useMotion } from "../motion";

/** A minimal rectangle shape, satisfied by `DOMRect`. */
export type LightRect = {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
};

/** The resolved light-and-parallax values for one pointer position. */
export type LightValues = {
  /** Candle position across the element, 0..1 (left/top to right/bottom). */
  readonly x: number;
  readonly y: number;
  /** Parallax offset in pixels, within [-PARALLAX_MAX_PX, PARALLAX_MAX_PX]. */
  readonly px: number;
  readonly py: number;
  /** Parallax tilt in degrees, within [-PARALLAX_MAX_DEG, PARALLAX_MAX_DEG]. */
  readonly degX: number;
  readonly degY: number;
};

/** Clamp `n` into the inclusive range [lo, hi]. */
function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

/**
 * Pure mapping from a pointer position to the desk's light and parallax values.
 *
 * `(clientX, clientY)` is a viewport point (as a `pointermove` reports) and
 * `rect` is the target element's bounding box. The result is deterministic and
 * depends only on its inputs: no time, no randomness, no DOM.
 *
 *  - `x` / `y` are the pointer's position within the element, 0 at the
 *    left/top edge and 1 at the right/bottom edge, clamped to [0, 1]. A
 *    zero-area element maps to its centre (0.5).
 *  - `px` / `py` and `degX` / `degY` are the parallax offset and tilt, scaled
 *    from the pointer's distance from the element's centre (−1..1 on each axis)
 *    and clamped to `PARALLAX_MAX_PX` / `PARALLAX_MAX_DEG`. They stay within
 *    those bounds for any input, including a pointer outside the element.
 */
export function lightFromPointer(
  rect: LightRect,
  clientX: number,
  clientY: number,
): LightValues {
  const fracX = rect.width > 0 ? (clientX - rect.left) / rect.width : 0.5;
  const fracY = rect.height > 0 ? (clientY - rect.top) / rect.height : 0.5;

  const x = clamp(fracX, 0, 1);
  const y = clamp(fracY, 0, 1);

  // Signed distance from the centre on each axis, −1 (edge) .. 1 (edge),
  // clamped so a pointer outside the element never exceeds the bounds.
  const centredX = clamp(fracX * 2 - 1, -1, 1);
  const centredY = clamp(fracY * 2 - 1, -1, 1);

  return {
    x,
    y,
    px: centredX * PARALLAX_MAX_PX,
    py: centredY * PARALLAX_MAX_PX,
    // Tilt is opposite the offset so the plane leans toward the pointer: the
    // top edge tips away as the pointer rises. Both axes stay within
    // PARALLAX_MAX_DEG.
    degX: -centredY * PARALLAX_MAX_DEG,
    degY: centredX * PARALLAX_MAX_DEG,
  };
}

/** Write one resolved light frame onto the target element's inline style. */
export function applyLight(el: HTMLElement, v: LightValues): void {
  el.style.setProperty("--light-x", String(v.x));
  el.style.setProperty("--light-y", String(v.y));
  el.style.setProperty("--parallax-x", `${v.px}px`);
  el.style.setProperty("--parallax-y", `${v.py}px`);
  el.style.setProperty("--parallax-deg-x", `${v.degX}deg`);
  el.style.setProperty("--parallax-deg-y", `${v.degY}deg`);
}

/**
 * Wire the pointer-driven candle light and parallax onto one element.
 *
 * Returns a ref to attach to the desk element. The hook listens for pointer
 * movement only when the motion mode is `full`; in `light` or `calm` the desk
 * stays settled and no listeners are attached. On every pointer move it records
 * the latest event and, if none is pending, schedules a single animation frame
 * that reads the element's box, maps the pointer through `lightFromPointer`,
 * and writes the custom properties once. The listener, the pending frame and
 * the recorded event are all released on unmount or when the mode changes.
 */
export function useLight<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const { mode } = useMotion();

  useEffect(() => {
    // Only full motion drives the light and parallax (R13.6). Settled modes
    // attach nothing, so there is nothing to clean up either.
    if (mode !== "full") return;

    const el = ref.current;
    if (el === null) return;

    let frame = 0;
    let pending: { x: number; y: number } | null = null;

    const flush = (): void => {
      frame = 0;
      const next = pending;
      pending = null;
      if (next === null) return;
      const rect = el.getBoundingClientRect();
      applyLight(el, lightFromPointer(rect, next.x, next.y));
    };

    const onPointerMove = (event: PointerEvent): void => {
      // Record only the latest position; coalesce to one DOM write per frame.
      pending = { x: event.clientX, y: event.clientY };
      if (frame === 0) {
        frame = requestAnimationFrame(flush);
      }
    };

    el.addEventListener("pointermove", onPointerMove);

    return () => {
      el.removeEventListener("pointermove", onPointerMove);
      if (frame !== 0) {
        cancelAnimationFrame(frame);
        frame = 0;
      }
      pending = null;
    };
  }, [mode]);

  return ref;
}
