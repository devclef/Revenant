"use client";

// Feature: 05-reveal-ceremony
//
// The desk scene (design.md "Desk", "Final state first", R13.1, R13.4-R13.7,
// R11.2, R8.6, R15.1). `DeskScene` is the dark desk the persona page and the
// `/demo` index sit on: a CSS surface (gradients from DeskScene.module.css), a
// decorative candle light layer, and a parallax plane that carries the page's
// content. On the persona page it replaces `PageShell`.
//
// What it renders, in order:
//
//   [data-desk]          the desk surface and the pointer-light / parallax ref
//                        target. Carries data-desk-motion so the CSS can settle
//                        the candle and the plane in calm / light modes.
//     [data-candle]      a decorative radial-gradient candle pool, aria-hidden.
//     [data-desk-plane]  the parallax plane that holds `children`, in order.
//     <Calm control>     one button that toggles motion off/on, rendered on the
//                        client only (see "Final state first" below).
//
// All three scene elements carry bare *global* data attributes (not hashed
// CSS-module class names); DeskScene.module.css targets them with `:global(...)`
// selectors. The scene applies no className of its own, so the static markup is
// exactly the data attributes the module styles.
//
// Pointer light and parallax (R13.6, R8.6): `useLight` returns a ref attached
// to the desk root. In `full` motion it listens for pointer movement and writes
// the `--light-*` and `--parallax-*` custom properties onto the root; they
// inherit down to the candle layer and the plane. The design says the light
// follows the pointer in full/light modes and the parallax tilt is full-only;
// `useLight` itself only attaches in `full`, and the module CSS also drops the
// transform in `light`, so a light-mode desk shows the settled plane either
// way. No dust and no tilt here — those load by dynamic import in task 7.
//
// Final state first (design.md, R17.3): the very first render — the server
// render and the first client render — is the settled desk, drawn purely with
// CSS, with no JS-only chrome. The Calm control is JS-only: a reader with no
// JavaScript cannot toggle a React boolean, so the button appears only after
// mount. Gating it behind a mounted flag keeps the static markup to the desk
// and its children alone (the server render carries no control text), and the
// hydrated client then shows the button. This also matches the scene's test,
// which renders the static markup and asserts the scene contributes no inline
// text of its own.
//
// Copy (R15.1): the Calm control's label is the only text the scene adds, and
// it comes from `CEREMONY_COPY` — no inline literal lives here. Its label flips
// with the resolved mode, exactly as CeremonyRoot does, so the control reads
// "Turn off motion" while motion is on and "Turn motion back on" once off.
//
// No `Math.random` and no `Date.now` in render (Property 21 / the ceremony
// source scan): the pointer work lives in `useLight`'s effect, and `mounted`
// is a plain boolean flipped in an effect. The server and the first client
// render produce identical markup. Imports no `@/lib/crypto`.

import { useEffect, useState, type ReactNode } from "react";

import { CEREMONY_COPY } from "../copy";
import { useMotion } from "../motion";
import { useLight } from "./useLight";

export type DeskSceneProps = {
  /** The page content that rests on the desk, in source order. */
  children: ReactNode;
};

/**
 * The dark desk. Renders the desk surface (the pointer-light / parallax target),
 * a decorative candle light layer, the parallax plane carrying the children,
 * and — on the client only — the Calm control.
 */
export function DeskScene({ children }: DeskSceneProps) {
  const { mode, setCalm } = useMotion();
  // The pointer-light and parallax ref. `useLight` attaches its listeners only
  // in `full` motion; in `light` / `calm` the desk stays settled.
  const deskRef = useLight<HTMLDivElement>();

  // The Calm control is JS-only, so it is withheld from the server render and
  // the first client render (Final state first). After mount it appears.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // `light` counts as `full` for the control label: only `calm` is "motion
  // off" (R3.2 / CeremonyRoot). The label flips with the mode.
  const motionOff = mode === "calm";
  const calmLabel = motionOff ? CEREMONY_COPY.calmOff : CEREMONY_COPY.calmOn;

  return (
    <div ref={deskRef} data-desk data-desk-motion={mode}>
      {/* Candle light layer: a radial gradient above the desk, decoration. */}
      <div data-candle aria-hidden="true" />
      {/* Parallax plane: holds the content, in order, and tilts in full motion. */}
      <div data-desk-plane>{children}</div>
      {/* Calm control (R11.2): client-only, labelled from CEREMONY_COPY. */}
      {mounted ? (
        <button
          type="button"
          data-desk-calm
          onClick={() => setCalm(!motionOff)}
        >
          {calmLabel}
        </button>
      ) : null}
    </div>
  );
}
