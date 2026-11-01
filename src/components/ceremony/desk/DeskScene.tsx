"use client";

// Feature: 05-reveal-ceremony
//
// The desk scene base (design.md "Desk" and "Final state first", R13.1,
// R13.4-R13.7). `DeskScene` is the dark desk the persona page sits on: a CSS
// surface with a candle light layer and a parallax plane that holds the page's
// content. It replaces `PageShell` on `/demo/personas/[key]`.
//
// Final state first: the very first render (server, and the first client
// render) is the settled desk, with no decorative start-state applied. Full
// motion — the pointer-driven light and the parallax tilt — is wired up in a
// layout effect after mount (task 20 adds `useLight` and the parallax), only
// when the motion mode is `full`. In `calm` or `light` the desk stays settled.
//
// Accessibility: the candle light layer and the parallax plane are decoration,
// so they are `aria-hidden`; a screen reader hears only the children. The desk
// container itself adds no inline text — every word comes from a child or from
// `copy.ts` (R15.1).
//
// No `Math.random` and no `Date.now` in render (Property 21 / the ceremony
// source scan): the server and client render the same markup. Imports no
// `@/lib/crypto`.
//
// NOTE: this is the task-1 scene base. Task 20 fleshes out the CSS gradients
// (DeskScene.module.css), the candle flicker and the pointer parallax; its
// public surface — the `DeskScene` component taking `children` — is fixed here
// so dependants and this file's test compile against the final shape.

import { useMotion } from "../motion";
import type { ReactNode } from "react";

export type DeskSceneProps = {
  /** The page content that rests on the desk, in source order. */
  children: ReactNode;
};

/**
 * The dark desk. Renders a container (marked `data-desk`), a decorative candle
 * light layer and a parallax plane that carries the children. The decorative
 * layers are `aria-hidden`; the children are read as normal content.
 */
export function DeskScene({ children }: DeskSceneProps) {
  // The mode is read so the full-motion client path can wire pointer light and
  // parallax after mount (task 20). On the server and the first client render
  // it is `full` and the final state, so the markup is identical either way.
  const { mode } = useMotion();

  return (
    <div data-desk data-desk-motion={mode}>
      {/* Candle light layer: a radial gradient above the desk, decoration. */}
      <div data-candle aria-hidden="true" />
      {/* Parallax plane: holds the content and tilts in full motion. */}
      <div data-desk-plane>{children}</div>
    </div>
  );
}
