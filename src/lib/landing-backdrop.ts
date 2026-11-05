"use client";

// Feature: 07-judge-journey
//
// Client boundary for the landing backdrop. SceneBackdrop uses hooks and an
// effect, so the server page `/` cannot render it directly. This wrapper is the
// only client module the landing page imports. It renders SceneBackdrop and
// passes its children through, so the server-rendered Landing_Ghost is in the
// server HTML (R9.15). It imports nothing from crypto, the opening flow, the
// API or the database. Soil_Canvas still loads only through the dynamic import
// in SoilCanvasLoader.

import { createElement, type ReactNode } from "react";

import { SceneBackdrop } from "@/components/ceremony/scene/SceneBackdrop";

/**
 * The landing page's noscript style (R9.4 to R9.7). With scripts disabled the
 * Ghost stands risen and does not rise or bob. The rise and the Idle_Bob run
 * only under `[data-ceremony-motion="full"]` and `prefers-reduced-motion:
 * no-preference` (scene.module.css), so Calm and reduced motion already stop
 * them on the next frame. This rule covers the no-JS case, where that
 * attribute is never set. Constant; no user data.
 */
export const LANDING_NOSCRIPT_STYLE =
  "[data-ghost-rise],[data-ghost-bob]{animation:none}";

export function LandingBackdrop({ children }: { children?: ReactNode }) {
  return createElement(SceneBackdrop, null, children);
}
