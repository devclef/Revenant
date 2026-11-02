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
// - A visible skip control is shown while the ink runs. It settles the letter
//   at once, and focus moves to the letter's heading.
// - If a line height can't be read, or the motion mode is light or calm, the
//   text is shown with no animation and no skip control (planInkRun).
//
// No `Math.random` and no `Date.now` (Property 21). The clock lives in the
// Web Animations API and a timer, inside the effect.

import { useLayoutEffect, useRef, useState } from "react";

import { SealedLetter, type SealedLetterProps } from "@/components/reveal/SealedLetter";

import { CEREMONY_COPY } from "../copy";
import { useMotion } from "../motion";
import { planInkRun, startInkSession, type InkSession } from "./inkSession";
import styles from "./InkLetter.module.css";

export type InkLetterProps = SealedLetterProps;

export function InkLetter(props: InkLetterProps) {
  const { mode } = useMotion();
  const rootRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<InkSession | undefined>(undefined);
  const [inkRunning, setInkRunning] = useState(false);
  const { opened, personaName } = props;

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (root === null) return undefined;

    const text = root.querySelector<HTMLElement>("[data-ink-text]");
    if (text === null) return undefined;

    const start = planInkRun({
      mode,
      computedLineHeight: getComputedStyle(text).lineHeight,
      boxHeightPx: text.getBoundingClientRect().height,
    });
    if (start === undefined) return undefined;

    const session = startInkSession(text, start, () => {
      sessionRef.current = undefined;
      setInkRunning(false);
    });
    if (session === undefined) return undefined;

    sessionRef.current = session;
    setInkRunning(true);
    return () => {
      session.cancel();
      sessionRef.current = undefined;
      setInkRunning(false);
    };
  }, [mode, opened, personaName]);

  function skipInk() {
    const session = sessionRef.current;
    if (session === undefined) return;
    session.skip();
    sessionRef.current = undefined;
    setInkRunning(false);
    // The control is removed once the ink settles, so move focus to the
    // letter's heading rather than leaving it on nothing.
    rootRef.current?.querySelector<HTMLElement>("h2")?.focus();
  }

  return (
    <div ref={rootRef}>
      {inkRunning ? (
        <div className={styles.controls}>
          <button type="button" className={styles.skip} onClick={skipInk}>
            {CEREMONY_COPY.inkSkip}
          </button>
        </div>
      ) : null}
      <SealedLetter {...props} />
    </div>
  );
}
