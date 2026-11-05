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

export function LandingBackdrop({ children }: { children?: ReactNode }) {
  return createElement(SceneBackdrop, null, children);
}
