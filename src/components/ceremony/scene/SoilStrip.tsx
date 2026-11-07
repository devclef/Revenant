// Feature: 07-judge-journey
//
// The Soil_Fallback (design.md "SceneBackdrop and the Soil", R6.1 to R6.3). A
// CSS strip that is always rendered. The Soil_Canvas, when it loads, draws over
// the same place. The strip has no text and no interaction, and it sits inside
// the aria-hidden backdrop.

import styles from "./scene.module.css";

export function SoilStrip() {
  return <div className={styles.soilStrip} data-soil data-soil-strip />;
}
