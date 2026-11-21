"use client";

/**
 * A Field_Group that keeps its focused Text_Field inside the visual viewport
 * (spec 16, requirement 1.8). It renders one element, `as` the caller picks,
 * and calls useKeepInVisualViewport with its own ref. Use it for each field
 * group (the field and its label, help and own Next or submit control).
 * Pass only `data-*` attributes through; the element stays the same as before.
 */

import { createElement, useRef, type ReactNode } from "react";

import { useCalmInForce } from "@/components/ceremony/motion";

import { useKeepInVisualViewport } from "./use-keep-in-visual-viewport";

export type KeepGroupProps = {
  /** The element to render. A row in a list is an `li`; everything else is a `div`. */
  as: "li" | "div";
  className?: string;
  children?: ReactNode;
  [dataAttribute: `data-${string}`]: string | undefined;
};

export function KeepGroup({ as, className, children, ...dataAttributes }: KeepGroupProps) {
  const ref = useRef<HTMLElement>(null);
  const calm = useCalmInForce();
  useKeepInVisualViewport(ref, calm);
  return createElement(as, { ref, className, ...dataAttributes }, children);
}
