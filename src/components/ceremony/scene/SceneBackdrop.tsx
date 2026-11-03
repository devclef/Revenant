// Feature: 07-judge-journey
//
// The backdrop (design.md "SceneBackdrop and the Soil", R6.9, R19.5). One
// aria-hidden container with pointer-events none, holding the light, the
// Soil_Fallback and the Soil_Canvas layer. Children (the Ghost, from task 3)
// render after the strip, so they sit on top of it inside the same layer.

import type { ReactNode } from "react";

import styles from "./scene.module.css";
import { SoilCanvasLoader } from "./SoilCanvasLoader";
import { SoilStrip } from "./SoilStrip";

export function SceneBackdrop({ children }: { children?: ReactNode }) {
  return (
    <div className={styles.backdrop} aria-hidden="true">
      <div className={styles.light} />
      <SoilStrip />
      <SoilCanvasLoader />
      {children}
    </div>
  );
}
