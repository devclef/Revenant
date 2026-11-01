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
//
// The one Calm control lives in CeremonyRoot; this scene has none.
//
// The scene elements carry local CSS-module classes (.desk, .candle, .plane)
// from DeskScene.module.css, plus the data attributes the tests and the
// motion selectors key off. The root also carries `.desk` from
// ceremony.module.css, which holds the desk tokens and focus rings.
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
// CSS. The scene has no button and no JS-only chrome, so the static markup is
// the desk and its children alone and works with no JavaScript.
//
// Copy (R15.1): the scene adds no text of its own. The one Calm control is
// rendered by CeremonyRoot, which shares this scene's motion mode through the
// one MotionProvider, so pressing it sets both data-desk-motion and
// data-ceremony-motion.
//
// No `Math.random` and no `Date.now` in render (Property 21 / the ceremony
// source scan): the pointer work lives in `useLight`'s effect. The server and
// the first client render produce identical markup. Imports no
// `@/lib/crypto`.

import { type ReactNode } from "react";

import { useMotion } from "../motion";
import ceremony from "../ceremony.module.css";
import { useLight } from "./useLight";
import styles from "./DeskScene.module.css";

export type DeskSceneProps = {
  /** The page content that rests on the desk, in source order. */
  children: ReactNode;
};

/**
 * The dark desk. Renders the desk surface (the pointer-light / parallax target),
 * and a decorative candle light layer, the parallax plane carrying the children.
 */
export function DeskScene({ children }: DeskSceneProps) {
  const { mode } = useMotion();
  // The pointer-light and parallax ref. `useLight` attaches its listeners only
  // in `full` motion; in `light` / `calm` the desk stays settled.
  const deskRef = useLight<HTMLDivElement>();

  return (
    <div
      ref={deskRef}
      data-desk
      data-desk-motion={mode}
      className={`${ceremony.desk} ${styles.desk}`}
    >
      {/* Candle light layer: a radial gradient above the desk, decoration. */}
      <div data-candle className={styles.candle} aria-hidden="true" />
      {/* Parallax plane: holds the content, in order, and tilts in full motion. */}
      <div data-desk-plane className={styles.plane}>{children}</div>
    </div>
  );
}
