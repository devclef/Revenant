/**
 * Keeps a focused Text_Field and its Field_Group inside the visual viewport
 * (spec 09 P9, spec 16 requirement 1). On a phone the on-screen keyboard
 * shrinks the visual viewport without moving the layout viewport, so the field
 * can end up under the keyboard. iOS Safari ignores the `interactiveWidget`
 * viewport setting, so the page has to scroll the field back into view itself.
 *
 * The hook scrolls only while Keyboard_Open and only for a focused Text_Field.
 * Every other focus, and every change while the keyboard is shut, is ignored.
 *
 * The band kept on screen runs from the visual viewport's top plus the clear
 * space under the Compact_Top_Bar, to its bottom less a small margin.
 */

import { useEffect, type RefObject } from "react";

/** Space kept clear at the top of the visual viewport (below the top bar). */
export const KEEP_TOP_CLEAR_PX = 56;

/** Space kept clear at the bottom of the visual viewport. */
export const KEEP_BOTTOM_CLEAR_PX = 8;

/**
 * The shortfall between the layout viewport and the visual viewport that counts
 * as an open on-screen keyboard. Scrollbars and mobile toolbars leave gaps
 * below this; the shortest phone keyboard in portrait is above it.
 */
export const KEYBOARD_THRESHOLD_PX = 150;

/** A visual viewport scale within this of 1 counts as unzoomed. */
export const SCALE_TOLERANCE = 0.01;

/** The part of `window.visualViewport` this hook reads. */
export type VisualViewportBox = { offsetTop: number; height: number; scale: number };

/** The part of `window` this hook reads: the visual viewport and scrolling. */
export type ViewportHost = {
  visualViewport?: VisualViewportBox | null;
  innerHeight: number;
  scrollBy: (options: ScrollToOptions) => void;
};

/** The viewport numbers that decide whether the on-screen keyboard is open. */
export type ViewportState = { innerHeight: number; height: number; scale: number };

/** A box in viewport coordinates. */
export type Box = { top: number; bottom: number };

/** The part of an element this hook reads. */
export type BoxedElement = { getBoundingClientRect(): Box };

/** The part of a form control this hook reads to decide whether it is a Text_Field. */
export type FieldLike = {
  tagName: string;
  type?: string;
  getAttribute(name: string): string | null;
};

/** A focused element that can be measured and classified. */
export type FieldElement = FieldLike & BoxedElement;

const TEXT_INPUT_TYPES = ["text", "search", "email", "tel", "url", "password", "number"];

/**
 * True while the on-screen keyboard is open: the visual viewport is shorter
 * than the layout viewport by at least KEYBOARD_THRESHOLD_PX, and it is not
 * zoomed. Pinch zoom alone does not count.
 */
export function isKeyboardOpen(v: ViewportState): boolean {
  return v.innerHeight - v.height >= KEYBOARD_THRESHOLD_PX && Math.abs(v.scale - 1) <= SCALE_TOLERANCE;
}

/**
 * True for a textarea, or an input whose type is text, search, email, tel, url,
 * password or number. An element with a button or slider role is never a
 * Text_Field. A missing type on an input means text, as in HTML.
 */
export function isTextField(el: FieldLike | null): boolean {
  if (el === null) return false;
  const role = el.getAttribute("role");
  if (role === "button" || role === "slider") return false;
  const tag = el.tagName.toUpperCase();
  if (tag === "TEXTAREA") return true;
  if (tag !== "INPUT") return false;
  const type = (el.type ?? "text").toLowerCase();
  return TEXT_INPUT_TYPES.includes(type);
}

/**
 * The box to keep in the band: the group's box when the group fits the band,
 * otherwise the focused field's own box (spec 16 requirement 1.7).
 */
export function keptBox(group: Box, field: Box, band: Box): Box {
  const bandHeight = band.bottom - band.top;
  return group.bottom - group.top <= bandHeight ? group : field;
}

/**
 * The scroll distance that brings a box inside a band. Zero when the box
 * already fits. A box taller than the band aligns its top edge, so the first
 * line stays readable.
 */
export function scrollDeltaFor(box: Box, band: Box): number {
  const boxHeight = box.bottom - box.top;
  const bandHeight = band.bottom - band.top;
  if (boxHeight > bandHeight) return box.top - band.top;
  if (box.top < band.top) return box.top - band.top;
  if (box.bottom > band.bottom) return box.bottom - band.bottom;
  return 0;
}

/**
 * Scrolls the focused Text_Field's Field_Group into the visual viewport. Acts
 * only while Keyboard_Open and only when `field` is a Text_Field. A group
 * taller than the band keeps the field's own box in the band instead. Returns
 * the scroll distance applied (0 when nothing moved).
 */
export function keepInVisualViewport(
  group: BoxedElement | null,
  field: FieldElement | null,
  host: ViewportHost,
  calm: boolean,
): number {
  const viewport = host.visualViewport;
  if (!viewport || group === null || field === null) return 0;
  const open = isKeyboardOpen({ innerHeight: host.innerHeight, height: viewport.height, scale: viewport.scale });
  if (!open || !isTextField(field)) return 0;
  const band = {
    top: viewport.offsetTop + KEEP_TOP_CLEAR_PX,
    bottom: viewport.offsetTop + viewport.height - KEEP_BOTTOM_CLEAR_PX,
  };
  const delta = scrollDeltaFor(
    keptBox(group.getBoundingClientRect(), field.getBoundingClientRect(), band),
    band,
  );
  if (delta !== 0) {
    host.scrollBy({ top: delta, behavior: calm ? "auto" : "smooth" });
  }
  return delta;
}

/**
 * Attaches the keep-in-view behaviour to a Field_Group element. On focus inside
 * the group, and on the visual viewport's `resize` and `scroll` (the window's
 * when there is no visual viewport), the focused Text_Field inside the group is
 * kept in view. The listeners are attached the same way with or without
 * `window.visualViewport`; without one the keyboard is never open, so nothing
 * scrolls. Under Calm the scroll is instant (`"auto"`).
 */
export function useKeepInVisualViewport(ref: RefObject<HTMLElement | null>, calm: boolean): void {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const element = ref.current;
    if (element === null) return;
    const viewport = window.visualViewport ?? null;
    const changes: EventTarget = viewport ?? window;

    const keep = () => {
      const active = document.activeElement;
      if (active === null || !element.contains(active)) return;
      keepInVisualViewport(element, active as unknown as FieldElement, window, calm);
    };

    element.addEventListener("focusin", keep);
    changes.addEventListener("resize", keep);
    changes.addEventListener("scroll", keep);
    return () => {
      element.removeEventListener("focusin", keep);
      changes.removeEventListener("resize", keep);
      changes.removeEventListener("scroll", keep);
    };
  }, [ref, calm]);
}
