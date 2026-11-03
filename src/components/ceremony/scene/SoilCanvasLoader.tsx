"use client";

// Feature: 07-judge-journey
//
// The Soil_Canvas loader (design.md "SceneBackdrop and the Soil", R6.1, R6.12).
// It renders the empty layer the canvas is appended to, and in an effect after
// mount it loads the canvas in full motion only. Calm and light render no
// canvas and never import the module. Turning motion off removes the canvas.
// The Soil_Fallback strip is rendered by SceneBackdrop, not here.

import { useEffect, useRef } from "react";

import styles from "./scene.module.css";
import { useMotion } from "../motion";
import { parseTranslateY, startSoilCanvas, type SoilCanvasHandle } from "./soil-canvas-start";
import type { CeilingInputs } from "./soil-canvas";

/** Reads the Top_Bar and headline bounds, and the backdrop's lift. */
function readCeilingInputs(container: HTMLElement): CeilingInputs {
  const doc = container.ownerDocument;
  const bar = doc.querySelector("[data-topbar]");
  const headline = doc.querySelector("[data-scene-ceiling]");
  const headlineRect = headline === null ? null : headline.getBoundingClientRect();
  const backdrop = container.parentElement;
  const transform = backdrop === null ? "none" : window.getComputedStyle(backdrop).transform;
  return {
    barBottom: bar === null ? 0 : bar.getBoundingClientRect().bottom,
    headlineBottom: headlineRect === null || headlineRect.height === 0 ? null : headlineRect.bottom,
    translateY: parseTranslateY(transform),
  };
}

export function SoilCanvasLoader() {
  const { mode } = useMotion();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (container === null || mode !== "full") {
      return;
    }
    let cancelled = false;
    let handle: SoilCanvasHandle | null = null;
    void startSoilCanvas({
      mode: "full",
      container,
      readCeiling: () => readCeilingInputs(container),
      load: () => import("./soil-canvas"),
    }).then((started) => {
      if (cancelled) {
        started?.destroy();
        return;
      }
      handle = started;
    });
    return () => {
      cancelled = true;
      handle?.destroy();
      handle = null;
    };
  }, [mode]);

  return <div ref={ref} className={styles.soilLayer} data-soil-layer />;
}
