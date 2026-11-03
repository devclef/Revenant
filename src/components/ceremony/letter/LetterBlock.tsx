"use client";

// Feature: 07-judge-journey (spec task 5, R13)
//
// The letter stage (stage 2). One rounded purple block holds one paper panel.
// The paper carries the stage heading, the labels and `SealedLetter`'s
// paragraph, so the letter text is one text node in the EB Garamond face.
//
// - No mask, clip or fade touches the text (R13.4). The only motion is the
//   paper's unfold: a Web Animation with `fill: "backwards"`, started in a
//   layout effect in full motion only. Light and calm modes start nothing, so
//   the static render is the final state.
// - Two `aria-hidden` creases sit at one third and two thirds of the paper.
// - `LetterBlock` adds nothing next to the text: no annotation, highlight or
//   link (R13.7).
//
// Every string comes from the reveal copy through `SealedLetter`.

import { useLayoutEffect, useRef, useState } from "react";

import { SealedLetter, type SealedLetterProps } from "@/components/reveal/SealedLetter";

import { EASE_STANDARD, UNFOLD_AT_MS, UNFOLD_MS } from "../constants";
import { useMotion } from "../motion";
import { useMaybeSequence } from "../skip-optional";
import styles from "./LetterBlock.module.css";

export type LetterBlockProps = SealedLetterProps & {
  /**
   * True when the letter mounts at its end state with no unfold (Show
   * everything, R12.8). Read once at mount, so a later stage change never
   * replays or cancels the unfold.
   */
  still?: boolean;
};

/** The paper's unfold: from a folded pose to flat, opacity 0 to 1. */
const UNFOLD_FROM = {
  transform: "perspective(900px) rotateX(-70deg) scaleY(0.35)",
  opacity: 0,
};
const UNFOLD_TO = {
  transform: "perspective(900px) rotateX(0deg) scaleY(1)",
  opacity: 1,
};

export function LetterBlock(props: LetterBlockProps) {
  const { still = false, ...letterProps } = props;
  const { mode } = useMotion();
  const paperRef = useRef<HTMLDivElement>(null);
  const [stillAtMount] = useState(still);
  // Skip finishes the unfold at once, so the letter sits at its end state.
  const skip = useMaybeSequence();
  const register = skip?.register;

  useLayoutEffect(() => {
    // Light and calm modes start no animation (R11.2, Property 22). A letter
    // that mounts still (Show everything) shows at its end state (R12.8).
    if (mode !== "full" || stillAtMount) return undefined;
    const paper = paperRef.current;
    if (paper === null || typeof paper.animate !== "function") return undefined;

    let animation: Animation | undefined;
    try {
      animation = paper.animate([UNFOLD_FROM, UNFOLD_TO], {
        duration: UNFOLD_MS,
        delay: UNFOLD_AT_MS,
        easing: EASE_STANDARD,
        fill: "backwards",
      });
    } catch {
      // A throwing Web Animations call leaves the paper at its final pose.
      return undefined;
    }
    if (animation === undefined) return undefined;
    const current = animation;

    // The unfold is one Skip step. It ends when it finishes, by its own clock or
    // by Skip (finish() fires onfinish), so the step unregisters then.
    let unregister: (() => void) | undefined;
    if (register !== undefined) {
      unregister = register(() => {
        try {
          current.finish();
        } catch {
          // A finish that throws leaves the paper at its final pose already.
        }
      });
      current.onfinish = () => unregister?.();
    }
    return () => {
      unregister?.();
      current.cancel();
    };
  }, [mode, stillAtMount, register]);

  return (
    <div className={styles.letterBlock}>
      <div ref={paperRef} className={styles.paper}>
        <span className={styles.crease} style={{ left: "33.3%" }} aria-hidden="true" />
        <span className={styles.crease} style={{ left: "66.6%" }} aria-hidden="true" />
        <SealedLetter {...letterProps} />
      </div>
    </div>
  );
}
