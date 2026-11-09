// Feature: 07-judge-journey
//
// The backdrop (design.md "SceneBackdrop and the Soil", R6.9, R19.5). One
// aria-hidden container with pointer-events none, holding the light, the
// Soil_Fallback and the Soil_Canvas layer. Children (the Ghost) render after
// the strip, so they sit on top of it inside the same layer.
//
// Placement of the handed stages (design.md "Narrow layout during `recall` and
// `marks`", R10.15): below 900 px the recall, marks and seal cards are pinned
// below the Soil strip by CSS (scene.module.css), the same rule the
// pinned stages use, so the backdrop no longer translates as a whole and the card
// never lands on the strip (issue #166). At or above 900 px the column is
// width-capped and reserves the lower band in CSS. The Ghost pose (risen vs
// handed) is still set per Stage in Ghost.tsx; only the big layer lift is gone.

import { useEffect, type CSSProperties, type ReactNode } from "react";

import { REVEAL_DIM_MS, REVEAL_DIM_OPACITY } from "../constants";
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

/** The dim values as CSS variables, from constants.ts (design.md "The dissolve on break"). */
const DIM_VARS = {
  "--reveal-dim-opacity": String(REVEAL_DIM_OPACITY),
  "--reveal-dim-ms": `${REVEAL_DIM_MS}ms`,
} as CSSProperties;

export type SceneBackdropProps = {
  children?: ReactNode;
  /** True once the reveal stages show: the light and the Soil dim (R12.7). */
  dimmed?: boolean;
  /**
   * True only for the render of a full-motion break, so the dim eases over
   * REVEAL_DIM_MS. Show everything, Skip and Calm dim at once with no motion.
   */
  animateDim?: boolean;
};

export function SceneBackdrop({
  children,
  dimmed = false,
  animateDim = false,
}: SceneBackdropProps) {
  // The Stage still drives the Ghost pose (risen vs handed) in Ghost.tsx, but
  // the backdrop no longer translates as a whole. Below 900 px the handed
  // stages (recall, marks, seal) are placed by CSS: scene.module.css pins their
  // region below the Soil strip, the same proven rule the pinned stages use, so
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
    <>
      <div
        className={styles.backdrop}
        aria-hidden="true"
        data-dimmed={dimmed ? "true" : undefined}
        data-dim-animated={dimmed && animateDim ? "true" : undefined}
        style={DIM_VARS}
      >
        <div className={styles.light} />
        <SoilStrip />
        <SoilCanvasLoader />
      </div>
      {children === undefined || children === null ? null : (
        // The Ghost layer (spec 07 A11, issue #253). It is a sibling of the
        // backdrop, not a child, because the backdrop's z-index 0 stacking
        // context would keep the Ghost under the Stage cards. This layer sits
        // above the cards and below the Top_Bar. It passes pointer events
        // through, as the backdrop did.
        <div className={styles.ghostLayer} aria-hidden="true" data-ghost-layer>
          {children}
        </div>
      )}
    </>
  );
}
