"use client";

// Feature: 13-the-seal
//
// The Skip for the press animations on the Seal step (spec 13, design section 2,
// P2.6). While the Signet or the Setting_State animation runs, the press
// registers one skip callback with the page's Skip context. The Top_Bar Skip
// then appears, so the page keeps one Skip control.
//
// Skip only moves the animation to its final frame, through the callback the
// caller passes in. It never calls, awaits or answers a passkey prompt. This
// file imports nothing that creates or reads a credential, and a source scan
// in press-skip.test.ts keeps it that way.

import { useEffect, useRef } from "react";

import { useMaybeSequence } from "../../ceremony/skip-optional";

/** The one part of the Skip context this module uses. */
export type SkipRegistrar = {
  register: (skip: () => void) => () => void;
};

/**
 * Registers the skip callback while `active` is true. Returns the unregister
 * function, or undefined when nothing was registered (no Skip context, or the
 * animation is not running).
 */
export function registerPressSkip(
  registrar: SkipRegistrar | null,
  active: boolean,
  onSkip: () => void,
): (() => void) | undefined {
  if (registrar === null || !active) return undefined;
  return registrar.register(() => {
    onSkip();
  });
}

/**
 * React binding for `registerPressSkip`. Registers while `active`, and
 * unregisters when it turns false or the component unmounts. The latest
 * `onSkip` is read on each skip, so a new callback does not re-register.
 */
export function usePressSkip(active: boolean, onSkip: () => void): void {
  const registrar = useMaybeSequence();
  const onSkipRef = useRef(onSkip);
  onSkipRef.current = onSkip;

  // The registrar object changes identity when the Skip count changes, so
  // depend on its register function, which is stable.
  const register = registrar?.register ?? null;

  useEffect(() => {
    const unregister = registerPressSkip(
      register === null ? null : { register },
      active,
      () => onSkipRef.current(),
    );
    return unregister;
  }, [register, active]);
}
