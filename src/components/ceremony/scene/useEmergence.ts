"use client";

// Feature: 07-judge-journey
//
// The Emergence state (design.md "The Pick_Up_Button gate", R9.8 to R9.11,
// R9.14). The rise is a CSS animation the server markup already carries. On
// mount this hook reads it with `getAnimations()`. While the rise runs it sets
// `emergence: "running"` and registers a Skip sequence whose skip finishes the
// animation. When the animation finishes, or Skip finishes it, the hook sets
// `emergence: "done"` and unregisters.
//
// With no running rise (Calm, reduced motion, no animation support, or a rise
// that already ended) `emergence` stays at its settled `"done"` default, so the
// Pick_Up_Button shows at once. The layout effect runs before the flow can
// reach `verified` (the flow needs a network round trip), so the button is
// never shown while the rise is still playing.

import { useLayoutEffect, type RefObject } from "react";

import { useLocalView } from "../local-view";
import { useSequence } from "../skip";

/**
 * The running or pending rise animation among an element's animations, if any.
 * A finished animation does not count. Pure, so the lookup is testable without
 * a DOM.
 */
export function findRise(animations: readonly Animation[]): Animation | undefined {
  return animations.find(
    (animation) =>
      animation.playState !== "finished" &&
      (animation as CSSAnimation).animationName === "rise",
  );
}

/**
 * Track the rise on the element behind `ref`. See the module comment for the
 * states it reports.
 */
export function useEmergence(ref: RefObject<HTMLElement | null>): void {
  const { setLocalView } = useLocalView();
  const { register } = useSequence();

  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null || typeof element.getAnimations !== "function") return;

    const rise = findRise(element.getAnimations());
    if (rise === undefined) return;

    let active = true;
    setLocalView({ emergence: "running" });

    const unregister = register(() => {
      rise.finish();
    });

    // `finished` rejects when the animation is cancelled (Calm turned on). A
    // cancelled rise is settled too, so both outcomes end the Emergence.
    const settle = () => {
      if (!active) return;
      active = false;
      unregister();
      setLocalView({ emergence: "done" });
    };
    rise.finished.then(settle, settle);

    return () => {
      active = false;
      unregister();
    };
  }, [ref, register, setLocalView]);
}
