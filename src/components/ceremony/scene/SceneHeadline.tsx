// Feature: 07-judge-journey, 09-demo-polish (F7, C1)
//
// The Scene headline (design.md "SceneShell, TopBar and the landing page",
// R3.18, and spec 09 F7). The only h1 on the persona page and on `/demo`. It
// shows one line of text from the caller: `personaHeading` on a persona page,
// `demoHeading` on `/demo`. It carries no Tagline and no Eyebrow.
//
// The landing page keeps its Tagline. `splitTagline` still lives here, so the
// landing hero can keep "Revenant doesn't." on one line (F2.3).
//
// `data-scene-ceiling` marks the element whose bottom sets the dust ceiling in
// the Soil_Canvas (R6.16).

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

export type SceneHeadlineProps = {
  /** The headline text, already filled in (for example "Maya's letter"). */
  text: string;
};

export function SceneHeadline({ text }: SceneHeadlineProps) {
  return (
    <h1 className={styles.headline} data-scene-ceiling data-scene-headline>
      {text}
    </h1>
  );
}
