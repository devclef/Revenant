// Feature: 07-judge-journey
//
// The backdrop (design.md "SceneBackdrop and the Soil", R6.9, R19.5). One
// aria-hidden container with pointer-events none, holding the light, the
// Soil_Fallback and the Soil_Canvas layer. Children (the Ghost) render after
// the strip, so they sit on top of it inside the same layer.
//
// Placement of the handed stages (design.md "Narrow layout during `recall` and
// `marks`", R10.15): below 900 px the recall, marks and seal cards are pinned
// below the Soil strip by CSS (scene.module.css), the same rule the intact
// stage uses, so the backdrop no longer translates as a whole and the card
// never lands on the strip (issue #166). At or above 900 px the column is
// width-capped and reserves the lower band in CSS. The Ghost pose (risen vs
// handed) is still set per Stage in Ghost.tsx; only the big layer lift is gone.

import { useEffect, type ReactNode } from "react";

import { useStage } from "../stage-context";
import { ghostHanded } from "../stages";
import styles from "./scene.module.css";
import { SoilCanvasLoader } from "./SoilCanvasLoader";
import { SoilStrip } from "./SoilStrip";

/**
 * Clears any inline `padding-top` a previous build's narrow lift may have left
 * on the persona column, so the CSS layout is the single source of truth for
 * every Stage. A fresh mount has none; this only matters across a live edit.
 */
function clearColumnPadding(column: HTMLElement | null) {
  if (column === null) return;
  column.style.removeProperty("padding-top");
}

export function SceneBackdrop({ children }: { children?: ReactNode }) {
  // The Stage still drives the Ghost pose (risen vs handed) in Ghost.tsx, but
  // the backdrop no longer translates as a whole. Below 900 px the handed
  // stages (recall, marks, seal) are placed by CSS: scene.module.css pins their
  // region below the Soil strip, the same proven rule the intact stage uses, so
  // the card clears the strip (F1, F2) and the risen Ghost (G1) with no
  // measure-once JS. Earlier the narrow lift placed the card by a live
  // measurement that landed it on the Soil strip at 360x640 (issue #166). The
  // desktop (>=900 px) layout caps the column width and reserves the lower band
  // in CSS and never lifted, so nothing here changes it.
  const handed = ghostHanded(useStage());

  useEffect(() => {
    // Clear any padding a previous build's lift may have left on the column, so
    // the CSS layout is the single source of truth for every Stage.
    const column = document.querySelector<HTMLElement>("[data-persona-column]");
    clearColumnPadding(column);
  }, [handed]);

  return (
    <div className={styles.backdrop} aria-hidden="true">
      <div className={styles.light} />
      <SoilStrip />
      <SoilCanvasLoader />
      {children}
    </div>
  );
}
