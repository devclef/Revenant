// Feature: 07-judge-journey
//
// The Scene headline (design.md "SceneShell, TopBar and the landing page",
// R3.18). The only h1 on the scene. "the receipts." sits in one nowrap span,
// with "receipts." in the Accent colour. `data-scene-ceiling` marks the element
// whose bottom sets the dust ceiling in the Soil_Canvas (R6.16).
//
// Every word comes from SCENE_COPY, so no text sits in the JSX.

import { SCENE_COPY } from "./copy";
import styles from "./scene.module.css";

/**
 * Splits the lead into the words before the Accent and the article that joins
 * the Accent inside the nowrap span. "Your past self returns with the" becomes
 * { before: "Your past self returns with", article: "the" }.
 */
export function splitHeadlineLead(lead: string): { before: string; article: string } {
  const match = lead.match(/^(.*) (\S+)$/);
  if (match === null) {
    return { before: lead, article: "" };
  }
  return { before: match[1], article: match[2] };
}

export function SceneHeadline() {
  const { before, article } = splitHeadlineLead(SCENE_COPY.headlineLead);
  return (
    <h1 className={styles.headline} data-scene-ceiling>
      {before}
      {" "}
      <span className={styles.nowrap}>
        {article}
        {" "}
        <span className={styles.accent}>{SCENE_COPY.headlineAccent}</span>
      </span>
    </h1>
  );
}
