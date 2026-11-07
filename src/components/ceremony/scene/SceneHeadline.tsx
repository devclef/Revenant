// Feature: 07-judge-journey, 09-demo-polish (F1, F2)
//
// The Scene headline (design.md "SceneShell, TopBar and the landing page",
// R3.18). The only h1 on the scene. It shows the Eyebrow above the Tagline from
// Brand_Copy. "Revenant doesn't." sits in one nowrap span, joined by a
// non-breaking space, and carries no Accent colour. `data-scene-ceiling` marks
// the element whose bottom sets the dust ceiling in the Soil_Canvas (R6.16).
//
// Every word comes from BRAND_COPY, so no text sits in the JSX.

import { BRAND_COPY } from "@/components/brand/copy";

import styles from "./scene.module.css";

/** The part of the Tagline kept together on one line. */
const KEPT_TOGETHER = "Revenant doesn't.";

const NBSP = "\u00a0";

/**
 * Splits the Tagline so that "Revenant doesn't." can sit in a nowrap span.
 * `before` is the text ahead of it, and `kept` is that phrase with a
 * non-breaking space between its two words. A tagline without the phrase is
 * returned whole in `before`.
 */
export function splitTagline(tagline: string): { before: string; kept: string } {
  const at = tagline.indexOf(KEPT_TOGETHER);
  if (at < 0) {
    return { before: tagline, kept: "" };
  }
  return {
    before: tagline.slice(0, at),
    kept: KEPT_TOGETHER.replace(" ", NBSP),
  };
}

export function SceneHeadline() {
  const { before, kept } = splitTagline(BRAND_COPY.tagline);
  return (
    <>
      <p className={styles.eyebrow} data-scene-eyebrow>
        {BRAND_COPY.eyebrow}
      </p>
      <h1 className={styles.headline} data-scene-ceiling>
        {before}
        {kept === "" ? null : <span className={styles.nowrap}>{kept}</span>}
      </h1>
    </>
  );
}
