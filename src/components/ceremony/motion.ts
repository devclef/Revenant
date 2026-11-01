"use client";

// Feature: 05-reveal-ceremony
//
// Motion context for the reveal Ceremony (design.md "Motion modes", R1.5,
// R11.2, R13.6, R17.3). `MotionProvider` holds the current motion mode and
// `useMotion()` reads it.
//
// Mode:
//  - `calm` when `prefers-reduced-motion: reduce` matches, or the judge presses
//    the Calm control. Calm settings live in React state only (R1.5): no
//    storage, no network.
//  - `light` for a low-power device (few cores, Save-Data, or a slow frame
//    probe): dust, parallax and tilt are off and camera moves become
//    cross-fades (R13.6). The Flow is unchanged.
//  - `full` otherwise.
//
// The server render and the FIRST client render always report `full` and the
// final state, so the server and client markup match (hydration, R17.3). The
// real mode is read in a layout effect after mount; a later task (task 5)
// fills in the media-query listener, the Calm toggle and the low-power probe.
// This module keeps its public surface — `MotionProvider`, `useMotion`,
// `MotionMode`, `MotionContextValue` — so dependants (`DeskScene`,
// `CeremonyRoot`) and their tests compile against the final shape.
//
// No `Math.random` and no `Date.now`: the server and client render the same
// markup (Property 21). Imports no `@/lib/crypto`.

import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/** The three motion modes. `light` still changes Stages, only lighter. */
export type MotionMode = "full" | "light" | "calm";

/** The value exposed by `useMotion()`. */
export type MotionContextValue = {
  /** The resolved motion mode for this render. */
  mode: MotionMode;
  /**
   * Turn the judge's Calm control on or off. `true` forces `calm`; `false`
   * returns to the device-resolved mode. State only, no persistence (R1.5).
   */
  setCalm: (on: boolean) => void;
};

const MotionContext = createContext<MotionContextValue | null>(null);

/**
 * Provides the motion context. The initial value is always `full` and the
 * final state, matching the server render (R17.3); task 5 adds the layout
 * effect that resolves the real device mode after mount.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  const [calm, setCalmState] = useState(false);

  const setCalm = useCallback((on: boolean) => {
    setCalmState(on);
  }, []);

  const mode: MotionMode = calm ? "calm" : "full";

  const value = useMemo<MotionContextValue>(
    () => ({ mode, setCalm }),
    [mode, setCalm],
  );

  return createElement(MotionContext.Provider, { value }, children);
}

/**
 * Read the motion context. Throws when used outside a `MotionProvider`, so a
 * missing provider is a loud wiring bug rather than a silent wrong mode.
 */
export function useMotion(): MotionContextValue {
  const value = useContext(MotionContext);
  if (value === null) {
    throw new Error("useMotion must be used within a MotionProvider");
  }
  return value;
}
