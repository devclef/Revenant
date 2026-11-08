"use client";

// Feature: 07-judge-journey (spec task 5, R13); spec 09 L6 (task 18, step 1)
//
// The letter stage (stage 2). The Caption_Block sits on the dark, in the sans,
// above the paper. It holds the Stage heading, the Letter_Disclosure, the seal
// line and the Seal_Verdict with its Fingerprint (`caption`). The paper is an
// `article` whose only child is the Letter_Text paragraph, so the letter reads
// as something someone wrote.
//
// - The Caption_Block comes before the paper in document order (L6.4).
// - No mask, clip or fade touches the text (R13.4). The only motion is the
//   paper's unfold: a Web Animation with `fill: "backwards"`, started in a
//   layout effect in full motion only. Light and calm modes start nothing, so
//   the static render is the final state.
// - `LetterBlock` adds nothing next to the text: no annotation, highlight or
//   link (R13.7).
//
// Every string comes from the reveal copy through `SealedLetter`.

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import {
  SealedLetterCaption,
  SealedLetterText,
  type SealedLetterProps,
} from "@/components/reveal/SealedLetter";
import type { LetterKind } from "@/components/reveal/FigureLine";
import { REVEAL_COPY } from "@/components/reveal/copy";

import { CREASE_POSITIONS, EASE_STANDARD, UNFOLD_AT_MS, UNFOLD_MS } from "../constants";
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
  /**
   * Extra content for the Caption_Block, after the labels. The reveal passes
   * the Fingerprint (the Seal_Verdict and its control) here.
   */
  caption?: ReactNode;
  /**
   * The letter's kind. A `"live"` or `"real"` letter marks its Letter_Text
   * paragraph with `data-user-content`; a `"persona"` letter does not.
   */
  letterKind?: LetterKind;
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

/**
 * The Light_Shaft's move from the Soil down to the paper, with the unfold. It
 * uses transform and opacity only (spec 09 L7).
 */
const SHAFT_FROM = { transform: "translateY(-12%)", opacity: 0 };
const SHAFT_TO = { transform: "translateY(0)", opacity: 1 };

/** Two horizontal creases, at 1/3 and 2/3 of the paper height (spec 09 L8). */
function creaseTop(share: number): string {
  return `${(share * 100).toFixed(4)}%`;
}

export function LetterBlock(props: LetterBlockProps) {
  const { still = false, caption, collapsible = false, letterKind, ...letterProps } = props;
  const { mode } = useMotion();
  const sheetRef = useRef<HTMLDivElement>(null);
  const shaftRef = useRef<HTMLDivElement>(null);
  const [stillAtMount] = useState(still);
  // Skip finishes the unfold at once, so the letter sits at its end state.
  const skip = useMaybeSequence();
  const register = skip?.register;
  // Light and calm modes (and a still letter) start no animation: the shaft
  // and the paper sit at their final state from the first paint.
  const lightStatic = mode !== "full" || stillAtMount;

  useLayoutEffect(() => {
    // Light and calm modes start no animation (R11.2, Property 22). A letter
    // that mounts still (Show everything) shows at its end state (R12.8).
    if (lightStatic) return undefined;
    const sheet = sheetRef.current;
    if (sheet === null || typeof sheet.animate !== "function") return undefined;

    let animation: Animation | undefined;
    try {
      animation = sheet.animate([UNFOLD_FROM, UNFOLD_TO], {
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

    // The shaft moves with the unfold. If its animation fails, the shaft simply
    // sits at its final state.
    let shaftAnimation: Animation | undefined;
    const shaft = shaftRef.current;
    if (shaft !== null && typeof shaft.animate === "function") {
      try {
        shaftAnimation = shaft.animate([SHAFT_FROM, SHAFT_TO], {
          duration: UNFOLD_MS,
          delay: UNFOLD_AT_MS,
          easing: EASE_STANDARD,
          fill: "backwards",
        });
      } catch {
        shaftAnimation = undefined;
      }
    }
    const shaftNow = shaftAnimation;

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
        try {
          shaftNow?.finish();
        } catch {
          // The shaft is already at its final state if this throws.
        }
      });
      current.onfinish = () => unregister?.();
    }
    return () => {
      unregister?.();
      current.cancel();
      shaftNow?.cancel();
    };
  }, [lightStatic, register]);

  const paper = (
    <div ref={sheetRef} className={styles.sheet}>
      <div
        ref={shaftRef}
        className={styles.lightShaft}
        aria-hidden="true"
        data-light-shaft=""
        data-light={lightStatic ? "static" : "unfold"}
      />
      <article className={styles.paper}>
        <SealedLetterText opened={letterProps.opened} letterKind={letterKind} />
      </article>
      {CREASE_POSITIONS.map((share, index) => (
        <div
          key={index}
          className={styles.crease}
          aria-hidden="true"
          data-crease={index + 1}
          style={{ top: creaseTop(share) }}
        />
      ))}
    </div>
  );

  return (
    <div className={styles.letterBlock}>
      <header className={styles.caption}>
        <SealedLetterCaption
          opened={letterProps.opened}
          personaName={letterProps.personaName}
          variant={letterProps.variant}
          letterId={letterProps.letterId}
        />
        {caption}
      </header>
      {collapsible ? (
        <details className={styles.letterDisclosure} data-letter-disclosure="">
          <summary>{REVEAL_COPY.letterDisclosureSummary}</summary>
          {paper}
        </details>
      ) : (
        paper
      )}
    </div>
  );
}
