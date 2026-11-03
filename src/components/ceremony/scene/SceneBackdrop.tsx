// Feature: 07-judge-journey
//
// The backdrop (design.md "SceneBackdrop and the Soil", R6.9, R19.5). One
// aria-hidden container with pointer-events none, holding the light, the
// Soil_Fallback and the Soil_Canvas layer. Children (the Ghost) render after
// the strip, so they sit on top of it inside the same layer.
//
// Narrow pick-up lift (design.md "Narrow layout during `recall` and `marks`",
// R10.15): below 900 px, once the Ghost is handed, the layer moves up by the
// lift `y` over PICKUP_MOVE_MS. The layer is measured once, at the moment the
// Ghost becomes handed, so the lift is not fed back into its own measurement.
// Only `transform` changes (R21.4).

import { useEffect, useState, type ReactNode } from "react";

import { useStage } from "../stage-context";
import { ghostHanded } from "../stages";
import {
  isWideLayout,
  narrowPickUpLift,
  NO_PICKUP_LIFT,
  soilBottomPx,
  type PickUpBoxes,
  type PickUpLift,
} from "./layout";
import styles from "./scene.module.css";
import { SoilCanvasLoader } from "./SoilCanvasLoader";
import { SoilStrip } from "./SoilStrip";

/** Reads the four boxes the lift needs from the page. Null if one is missing. */
function readPickUpBoxes(doc: Document, width: number, height: number): PickUpBoxes | null {
  const ghost = doc.querySelector("[data-ghost-box]");
  const pit = doc.querySelector("[data-ghost-pit]");
  const bar = doc.querySelector("[data-topbar]");
  if (ghost === null || pit === null || bar === null) return null;
  return {
    ghostTop: ghost.getBoundingClientRect().top,
    pitBottom: pit.getBoundingClientRect().bottom,
    topBarBottom: bar.getBoundingClientRect().bottom,
    soilBottom: soilBottomPx(width, height),
  };
}

/**
 * Sets the top of the persona column's content so its headline starts under the
 * lifted Soil strip (`columnStart`, measured from the Top_Bar's bottom). The
 * column is in the flow and is not lifted, so its own top is read here. With
 * no lift, the column keeps its CSS padding.
 */
function applyColumnStart(column: HTMLElement | null, lift: PickUpLift, boxes: PickUpBoxes | null) {
  if (column === null) return;
  if (boxes === null || lift === NO_PICKUP_LIFT) {
    column.style.removeProperty("padding-top");
    return;
  }
  const columnTop = column.getBoundingClientRect().top;
  const padding = boxes.topBarBottom + lift.columnStart - columnTop;
  column.style.setProperty("padding-top", `${padding}px`);
}

export function SceneBackdrop({ children }: { children?: ReactNode }) {
  const handed = ghostHanded(useStage());
  const [lift, setLift] = useState<PickUpLift>(NO_PICKUP_LIFT);

  useEffect(() => {
    const column = document.querySelector<HTMLElement>("[data-persona-column]");
    if (!handed || isWideLayout(window.innerWidth)) {
      setLift(NO_PICKUP_LIFT);
      applyColumnStart(column, NO_PICKUP_LIFT, null);
      return;
    }
    const boxes = readPickUpBoxes(document, window.innerWidth, window.innerHeight);
    const next = narrowPickUpLift(boxes);
    setLift(next);
    applyColumnStart(column, next, boxes);
    // Measured once when the Ghost becomes handed. Later stages keep the lift.
  }, [handed]);

  return (
    <div
      className={styles.backdrop}
      aria-hidden="true"
      style={{ transform: `translateY(${lift.y}px)` }}
    >
      <div className={styles.light} />
      <SoilStrip />
      <SoilCanvasLoader />
      {children}
    </div>
  );
}
