/**
 * Keeps a focused field and its Next or submit control inside the visual
 * viewport (spec 09 P9). On a phone the on-screen keyboard shrinks the visual
 * viewport without moving the layout viewport, so the field can end up under
 * the keyboard. iOS Safari ignores the `interactiveWidget` viewport setting, so
 * the page has to scroll the field back into view itself.
 *
 * The band kept on screen runs from the visual viewport's top plus the clear
 * space under the Compact_Top_Bar, to its bottom less a small margin. The
 * element passed in is the group that holds the field and its control, so its
 * box is the union of both.
 */

import { useEffect, type RefObject } from "react";

/** Space kept clear at the top of the visual viewport (below the top bar). */
export const KEEP_TOP_CLEAR_PX = 56;

/** Space kept clear at the bottom of the visual viewport. */
export const KEEP_BOTTOM_CLEAR_PX = 8;

/** The part of `window.visualViewport` this hook reads. */
export type VisualViewportBox = { offsetTop: number; height: number };

/** The part of `window` this hook reads: the visual viewport and scrolling. */
export type ViewportHost = {
  visualViewport?: VisualViewportBox | null;
  scrollBy: (options: ScrollToOptions) => void;
};

/** The part of an element this hook reads. */
export type BoxedElement = { getBoundingClientRect(): { top: number; bottom: number } };

/**
 * The scroll distance that brings a box inside a band. Zero when the box
 * already fits. A box taller than the band aligns its top edge, so the first
 * line stays readable.
 */
export function scrollDeltaFor(
  box: { top: number; bottom: number },
  band: { top: number; bottom: number },
): number {
  const boxHeight = box.bottom - box.top;
  const bandHeight = band.bottom - band.top;
  if (boxHeight > bandHeight) return box.top - band.top;
  if (box.top < band.top) return box.top - band.top;
  if (box.bottom > band.bottom) return box.bottom - band.bottom;
  return 0;
}

/**
 * Scrolls the element into the visual viewport when it is not already there.
 * Does nothing when the host has no `visualViewport`, or no element is given.
 * Returns the scroll distance applied (0 when nothing moved).
 */
export function keepInVisualViewport(
  element: BoxedElement | null,
  host: ViewportHost,
  calm: boolean,
): number {
  const viewport = host.visualViewport;
  if (!viewport || element === null) return 0;
  const band = {
    top: viewport.offsetTop + KEEP_TOP_CLEAR_PX,
    bottom: viewport.offsetTop + viewport.height - KEEP_BOTTOM_CLEAR_PX,
  };
  const delta = scrollDeltaFor(element.getBoundingClientRect(), band);
  if (delta !== 0) {
    host.scrollBy({ top: delta, behavior: calm ? "auto" : "smooth" });
  }
  return delta;
}

/**
 * Attaches the keep-in-view behaviour to a group element. On focus inside the
 * group, and on the visual viewport's `resize` and `scroll` while focus is
 * inside it, the group is kept in view. Under Calm the scroll is instant
 * (`"auto"`). Without `window.visualViewport` the hook attaches nothing.
 */
export function useKeepInVisualViewport(
  ref: RefObject<HTMLElement | null>,
  calm: boolean,
): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    const element = ref.current;
    if (element === null) return;

    const keep = () => {
      keepInVisualViewport(element, window, calm);
    };
    const onViewportChange = () => {
      if (element.contains(document.activeElement)) keep();
    };

    element.addEventListener("focusin", keep);
    viewport.addEventListener("resize", onViewportChange);
    viewport.addEventListener("scroll", onViewportChange);
    return () => {
      element.removeEventListener("focusin", keep);
      viewport.removeEventListener("resize", onViewportChange);
      viewport.removeEventListener("scroll", onViewportChange);
    };
  }, [ref, calm]);
}
