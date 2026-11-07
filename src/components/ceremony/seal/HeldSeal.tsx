"use client";

// Feature: 07-judge-journey
//
// HeldSeal: the pointer target on the wax seal (design.md "HeldSeal", R10.16,
// R12.11, R19.6). It wraps the seal and forwards pointer presses to the
// `useSealBreak` controller. The visible seal stays the same; a `::before` box
// at least SEAL_HIT_MIN_PX square takes the pointer, so the target stays above
// the 44 px minimum at the narrow 0.8 scale.
//
// The target is aria-hidden and outside the tab order. The "Break the seal"
// button is the accessible control (R6.3, Property 19).

import type {
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
  CSSProperties,
  ReactNode,
} from "react";

import { SEAL_HIT_MIN_PX } from "../constants";
import type { SealController } from "./useSealBreak";
import styles from "./HeldSeal.module.css";

export type HeldSealProps = {
  /** The seal controller from `useSealBreak`. */
  controller: SealController;
  /** Extra class names for the wrapper (the seal's placement). */
  className?: string;
  /** Marks the pressable seal as the page's primary control (spec 09 C4.1). */
  primary?: boolean;
  children?: ReactNode;
};

/** The hit box size, set as a custom property the stylesheet reads. */
const HIT_VARS = { "--seal-hit-min": `${SEAL_HIT_MIN_PX}px` } as CSSProperties;

export function HeldSeal({ controller, className, primary = false, children }: HeldSealProps) {
  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    controller.press(event.currentTarget, event.pointerId);
  };
  // A long press on touch opens the browser's callout menu. The seal is a
  // press-and-hold control, so that menu is suppressed (spec 09 P8.1).
  const onContextMenu = (event: ReactMouseEvent<HTMLElement>) => {
    event.preventDefault();
  };
  const classes = className ? `${styles.target} ${className}` : styles.target;
  return (
    <span
      className={classes}
      style={HIT_VARS}
      aria-hidden="true"
      data-seal-target
      data-primary-control={primary ? "" : undefined}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
    >
      {children}
    </span>
  );
}
