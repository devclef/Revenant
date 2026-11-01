"use client";

// Feature: 05-reveal-ceremony
//
// Motion context for the reveal Ceremony (design.md "Motion modes", R1.5,
// R11.2, R13.6, R17.3). `MotionProvider` holds the current motion mode and
// `useMotion()` reads it.
//
// Mode:
//  - `calm` when `matchMedia("(prefers-reduced-motion: reduce)")` matches, or
//    the judge presses the Calm control. Calm settings live in React state
//    only (R1.5): no storage, no network.
//  - `light` for a low-power device: `navigator.hardwareConcurrency` below
//    `LOW_POWER_CORES`, `navigator.connection.saveData`, or a one-second frame
//    probe whose average frame is slower than `LOW_POWER_FRAME_MS`. In `light`
//    dust, parallax and tilt are off and camera moves become cross-fades
//    (R13.6). The Flow is unchanged.
//  - `full` otherwise.
//
// Final state first (design.md, R17.3): the server render and the FIRST client
// render always report `full`. The device mode (reduced-motion and the
// low-power signals) is read in a layout effect AFTER mount, so the server and
// the first client render produce identical markup and hydration never
// mismatches. Pressing Calm is a user action after mount, so it only ever
// moves the already-hydrated tree.
//
// No `Math.random` and no `Date.now` in render: the resolved mode is computed
// in effects, not during render, so the server and client render the same
// markup (Property 21). The frame probe reads `performance.now()` inside an
// effect only. This module imports no `@/lib/crypto`.

import {
  createContext,
  createElement,
  Fragment,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { LOW_POWER_CORES, LOW_POWER_FRAME_MS, LOW_POWER_PROBE_MS } from "./constants";

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

/**
 * The pure mode resolution, the single source of truth for `useMotion().mode`.
 * Calm (reduced motion OR the judge's Calm control) wins over everything, then
 * a low-power device is `light`, else `full`. Takes resolved booleans only, so
 * it reads no global and touches no storage — exhaustively unit-testable.
 */
export function resolveMode(state: {
  reducedMotion: boolean;
  calmControl: boolean;
  lowPower: boolean;
}): MotionMode {
  if (state.reducedMotion || state.calmControl) {
    return "calm";
  }
  if (state.lowPower) {
    return "light";
  }
  return "full";
}

const MotionContext = createContext<MotionContextValue | null>(null);

/**
 * Whether the device asks for reduced motion right now. Reads `matchMedia`
 * defensively: a server or a browser without it reports `false` (no reduced
 * motion), which keeps the default `full`. Called only from effects.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The `saveData` hint from the Network Information API, where the browser
 * exposes it. The API is non-standard and absent from the TS DOM lib, so it is
 * read through a narrow local shape rather than widening global types.
 */
function saveDataRequested(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  const connection = (navigator as Navigator & {
    connection?: { saveData?: boolean };
  }).connection;
  return connection?.saveData === true;
}

/** Whether the machine reports fewer than `LOW_POWER_CORES` logical cores. */
function fewCores(): boolean {
  if (typeof navigator === "undefined") {
    return false;
  }
  const cores = navigator.hardwareConcurrency;
  return typeof cores === "number" && cores > 0 && cores < LOW_POWER_CORES;
}

/** The three device signals that can mark a device as low-power. */
export type LowPowerSignals = {
  /** `navigator.hardwareConcurrency` is below `LOW_POWER_CORES`. */
  fewCores: boolean;
  /** `navigator.connection.saveData` is on. */
  saveData: boolean;
  /** The one-second frame probe measured an average frame slower than `LOW_POWER_FRAME_MS`. */
  slowFrame: boolean;
};

/**
 * The pure low-power decision: a device is low-power when ANY signal fired.
 * Takes resolved signals and returns a boolean only — it reads no global, runs
 * no probe and touches no storage, so it is exhaustively unit-testable. A
 * low-power device renders the `light` mode (lighter Stages, no dust/parallax);
 * with no signal it stays `full`.
 */
export function decideLowPower(signals: LowPowerSignals): boolean {
  return signals.fewCores || signals.saveData || signals.slowFrame;
}

/**
 * Run a one-second frame probe. Resolves `true` when the average frame over
 * `LOW_POWER_PROBE_MS` is slower than `LOW_POWER_FRAME_MS` (a low-power
 * signal). Resolves `false` when it can't run (no `requestAnimationFrame`, no
 * frames observed, or a fast machine). The probe is read with
 * `performance.now()` inside this effect-time helper, never during render.
 */
function probeFrameRate(): Promise<boolean> {
  return new Promise((resolve) => {
    if (
      typeof window === "undefined" ||
      typeof window.requestAnimationFrame !== "function" ||
      typeof performance === "undefined" ||
      typeof performance.now !== "function"
    ) {
      resolve(false);
      return;
    }

    const start = performance.now();
    let frames = 0;

    const tick = (now: number) => {
      frames += 1;
      if (now - start < LOW_POWER_PROBE_MS) {
        window.requestAnimationFrame(tick);
        return;
      }
      const elapsed = now - start;
      // No frames observed: can't judge, so not low-power.
      if (frames <= 0 || elapsed <= 0) {
        resolve(false);
        return;
      }
      const averageFrameMs = elapsed / frames;
      resolve(averageFrameMs > LOW_POWER_FRAME_MS);
    };

    window.requestAnimationFrame(tick);
  });
}

/**
 * Provides the motion context. The initial mode is always `full`, matching the
 * server render and the first client render (R17.3). After mount, a layout
 * effect resolves the real device mode:
 *
 *  1. A `prefers-reduced-motion` listener keeps the calm signal current.
 *  2. The low-power signals (few cores, Save-Data, or the frame probe) resolve
 *     `light` once, if calm is not in force.
 *
 * The resolved mode is `calm` when reduced motion or the Calm control is on,
 * else `light` when a low-power signal fired, else `full`.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  // One Calm control per page: a nested provider defers to the parent, so the
  // desk and the ceremony always share one mode.
  const parent = useContext(MotionContext);
  if (parent !== null) {
    return createElement(Fragment, null, children);
  }
  return createElement(RootMotionProvider, null, children);
}

function RootMotionProvider({ children }: { children: ReactNode }) {
  // The Calm control (R1.5): React state only.
  const [calmControl, setCalmControl] = useState(false);
  // The device-resolved signals, read after mount. Both start cleared so the
  // first render is `full` and matches the server (R17.3).
  const [reducedMotion, setReducedMotion] = useState(false);
  const [lowPower, setLowPower] = useState(false);

  const setCalm = useCallback((on: boolean) => {
    setCalmControl(on);
  }, []);

  useLayoutEffect(() => {
    let active = true;

    // 1. Reduced-motion: read once and then follow changes.
    const media =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)")
        : null;

    setReducedMotion(prefersReducedMotion());

    const onMediaChange = (event: MediaQueryListEvent) => {
      if (active) {
        setReducedMotion(event.matches);
      }
    };
    media?.addEventListener("change", onMediaChange);

    // 2. Low-power: the cheap signals decide immediately; otherwise the frame
    // probe runs for one second. Reduced motion already forces calm, so the
    // probe is skipped when it is set (nothing would change the resolved mode).
    // `decideLowPower` is the single source of truth for the OR of the signals.
    if (decideLowPower({ fewCores: fewCores(), saveData: saveDataRequested(), slowFrame: false })) {
      setLowPower(true);
    } else if (!prefersReducedMotion()) {
      void probeFrameRate().then((slow) => {
        if (active && decideLowPower({ fewCores: false, saveData: false, slowFrame: slow })) {
          setLowPower(true);
        }
      });
    }

    return () => {
      active = false;
      media?.removeEventListener("change", onMediaChange);
    };
  }, []);

  const mode: MotionMode = useMemo(
    () => resolveMode({ reducedMotion, calmControl, lowPower }),
    [reducedMotion, calmControl, lowPower],
  );

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
