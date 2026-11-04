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
import {
  parseTranslateY,
  soilCanvasMayLoad,
  startSoilCanvas,
  type SoilCanvasHandle,
} from "./soil-canvas-start";
import type { CeilingInputs } from "./soil-canvas";

/**
 * The lowest bottom of the text the dust must stay below: the headline, or the
 * index intro note (`data-dust-ceiling`), whichever sits lower. Null when
 * neither shows.
 */
function textBottom(doc: Document): number | null {
  let bottom: number | null = null;
  for (const el of doc.querySelectorAll("[data-scene-ceiling], [data-dust-ceiling]")) {
    const rect = el.getBoundingClientRect();
    if (rect.height === 0) continue;
    bottom = bottom === null ? rect.bottom : Math.max(bottom, rect.bottom);
  }
  return bottom;
}

/** Reads the Top_Bar and text bounds, and the backdrop's lift. */
function readCeilingInputs(container: HTMLElement): CeilingInputs {
  const doc = container.ownerDocument;
  const bar = doc.querySelector("[data-topbar]");
  const backdrop = container.parentElement;
  const transform = backdrop === null ? "none" : window.getComputedStyle(backdrop).transform;
  return {
    barBottom: bar === null ? 0 : bar.getBoundingClientRect().bottom,
    headlineBottom: textBottom(doc),
    translateY: parseTranslateY(transform),
  };
}

export function SoilCanvasLoader() {
  const { mode, ready } = useMotion();
  const ref = useRef<HTMLDivElement>(null);

  // Waits for `ready`: on the first commit the mode is still the server's
  // `full`, and a light or calm device must not request the chunk then.
  useEffect(() => {
    const container = ref.current;
    if (container === null || !soilCanvasMayLoad({ mode, ready })) {
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
  }, [mode, ready]);

  return <div ref={ref} className={styles.soilLayer} data-soil-layer />;
}
