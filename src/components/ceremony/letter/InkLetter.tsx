"use client";

// Feature: 05-reveal-ceremony
//
// The ink reveal for the sealed letter (R7.2, Property 14's ink clause,
// Property 16). It wraps `SealedLetter` and changes only how the letter text
// is covered, never what is in the DOM.
//
// - The full letter text, and every label, is in the markup from the first
//   render, so a screen reader and a no-JavaScript reader get the whole letter.
// - Labels are never masked. Only the element marked `data-ink-text` is.
// - In full motion, a layout effect (before first paint) measures the letter's
//   line boxes and animates only `mask-*` properties, one line after another.
// - If a line height can't be read, or the motion mode is light or calm, the
//   text is shown with no animation at all.
//
// No `Math.random` and no `Date.now` (Property 21). The clock lives in the
// Web Animations API, inside the effect.

import { useLayoutEffect, useRef } from "react";

import { SealedLetter, type SealedLetterProps } from "@/components/reveal/SealedLetter";

import { useMotion } from "../motion";
import { applyInk, countInkLines, readLineHeightPx, type InkRun } from "./inkMask";
import { inkPlan } from "./inkPlan";

export type InkLetterProps = SealedLetterProps;

export function InkLetter(props: InkLetterProps) {
  const { mode } = useMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const { opened, personaName } = props;

  useLayoutEffect(() => {
    if (mode !== "full") return undefined;
    const root = rootRef.current;
    if (root === null) return undefined;

    const text = root.querySelector<HTMLElement>("[data-ink-text]");
    if (text === null) return undefined;

    const lineHeightPx = readLineHeightPx(getComputedStyle(text).lineHeight);
    if (lineHeightPx === undefined) return undefined;

    const lines = countInkLines(text.getBoundingClientRect().height, lineHeightPx);
    if (lines === 0) return undefined;

    const run: InkRun | undefined = applyInk(text, {
      lineHeightPx,
      plan: inkPlan(lines),
    });
    return () => run?.cancel();
  }, [mode, opened, personaName]);

  return (
    <div ref={rootRef}>
      <SealedLetter {...props} />
    </div>
  );
}
