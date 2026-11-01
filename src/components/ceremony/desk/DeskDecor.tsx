"use client";

// Feature: 05-reveal-ceremony
//
// The desk's decorative layers: the canvas dust and the tilt control (design.md
// "Desk", R13.3, R8.6, R11.3). Mounted by DeskScene, inside the desk and below
// the parallax plane.
//
// In `full` motion the canvas renders and, after mount, `loadDeskDecor` imports
// dust.ts and tilt.ts. The dust starts on the canvas. Tilt starts at once where
// no permission is needed. Where iOS needs one, the "Let the light follow your
// phone" control appears, and tilt starts only if the user grants permission.
// Denied permission hides the control and leaves the pointer light in place.
//
// In `light` and `calm` nothing renders and nothing is imported. The effect
// cleanup stops dust and tilt whenever the mode leaves `full` or the component
// unmounts.
//
// Server markup: the canvas (aria-hidden, no text) and no button, because the
// control appears only after the effect runs. So the first render matches the
// server (Property 21).

import { useEffect, useRef, useState, type RefObject } from "react";

import { CEREMONY_COPY } from "../copy";
import ceremony from "../ceremony.module.css";
import { useMotion } from "../motion";
import {
  loadDeskDecor,
  wantsDeskDecor,
  type DeskDecorModules,
} from "./decor-loader";
import styles from "./DeskDecor.module.css";

export type DeskDecorProps = {
  /** The element tilt moves: the desk root, the same target as the pointer light. */
  readonly target: RefObject<HTMLElement | null>;
};

export function DeskDecor({ target }: DeskDecorProps) {
  const { mode } = useMotion();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modulesRef = useRef<DeskDecorModules | null>(null);
  const stopTiltRef = useRef<() => void>(() => undefined);
  const [askForTilt, setAskForTilt] = useState(false);

  useEffect(() => {
    if (!wantsDeskDecor(mode)) return;

    let active = true;
    let stopDust: () => void = () => undefined;

    void loadDeskDecor(mode).then((mods) => {
      if (!active || mods === null) return;
      modulesRef.current = mods;

      const canvas = canvasRef.current;
      if (canvas !== null) {
        stopDust = mods.dust.startDust(canvas);
      }

      const el = target.current;
      if (mods.tilt.needsTiltPermission(mods.tilt.browserTiltWindow())) {
        // iOS: wait for a tap before tilt can start.
        setAskForTilt(true);
      } else if (el !== null) {
        stopTiltRef.current = mods.tilt.startTilt(el, mods.tilt.browserTiltWindow());
      }
    });

    return () => {
      active = false;
      stopDust();
      stopTiltRef.current();
      stopTiltRef.current = () => undefined;
      modulesRef.current = null;
      setAskForTilt(false);
    };
  }, [mode, target]);

  const enableTilt = async (): Promise<void> => {
    const mods = modulesRef.current;
    const el = target.current;
    if (mods === null || el === null) return;
    const win = mods.tilt.browserTiltWindow();
    const granted = await mods.tilt.requestTiltPermission(win);
    // Whatever the answer, the control goes: a denial leaves the pointer light.
    setAskForTilt(false);
    if (granted) {
      stopTiltRef.current();
      stopTiltRef.current = mods.tilt.startTilt(el, win);
    }
  };

  if (!wantsDeskDecor(mode)) return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        data-desk-dust
        className={styles.dust}
        aria-hidden="true"
      />
      {askForTilt ? (
        <button
          type="button"
          className={`${ceremony.deskControl} ${styles.tilt}`}
          onClick={() => {
            void enableTilt();
          }}
        >
          {CEREMONY_COPY.tiltEnable}
        </button>
      ) : null}
    </>
  );
}
