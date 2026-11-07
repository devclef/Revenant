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
import {
  LANDING_GHOST_PHONE_MAX_PX,
  PHONE_BELOW_PX,
} from "@/components/landing/constants";

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

/**
 * Where the Landing_Ghost and the light sit below PHONE_BELOW_PX (OD12 c, P1.1,
 * P2.1). The Ghost sits below the calls to action, directly above the Soil, so
 * its box touches no text or control. The light is centred on the Ghost's
 * horizontal centre. The stylesheet applies the same values
 * (`min(30svh, 190px)` on `.ghost` in landing.module.css).
 */
export const PHONE_GHOST_PLACEMENT = {
  /** The Ghost follows the calls to action. */
  after: "calls-to-action",
  /** The Ghost box is at most this share of the viewport height. */
  maxViewportHeightShare: 0.3,
  /** The Ghost box is at most this tall, in CSS pixels. */
  maxHeightPx: LANDING_GHOST_PHONE_MAX_PX,
  /** The light's centre is the Ghost's centre. */
  lightCentre: "ghost-centre",
} as const;

/**
 * The Landing_Ghost box height for a viewport of the given height, below
 * PHONE_BELOW_PX. It is the smaller of 30% of the viewport height and
 * LANDING_GHOST_PHONE_MAX_PX.
 */
export function phoneGhostHeightPx(viewportHeightPx: number): number {
  const share = viewportHeightPx * PHONE_GHOST_PLACEMENT.maxViewportHeightShare;
  return Math.min(share, PHONE_GHOST_PLACEMENT.maxHeightPx);
}

/** True when a viewport of this width uses the phone placement. */
export function usesPhoneGhostPlacement(viewportWidthPx: number): boolean {
  return viewportWidthPx < PHONE_BELOW_PX;
}
