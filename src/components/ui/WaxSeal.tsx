// Feature: 07-judge-journey
//
// WaxSeal: the one orange wax seal on the Envelope's back (design.md "The wax
// seal", R10.10, R10.11, R10.12). It replaces spec 05's per-persona seal
// pattern. Every letter gets the same seal: an irregular round blob with a
// ring, an inner disc and a pressed ghost silhouette, drawn in code.
//
// Neutrality (neutrality.md, R10.11): the seal carries no religious, national
// or political symbol. It is one colour, one shape and one ghost, whatever the
// persona or the figures. It takes no props that could vary its look, so the
// markup cannot depend on a letter.
//
// The two halves are drawn twice, clipped by a left and a right polygon along a
// jagged seam. At rest they sit together (R10.12). The seal is decoration, so it
// is `aria-hidden`; the "Break the seal" button is the accessible control.
//
// Pure presentation with no state, so it needs no "use client".

import { useId, type CSSProperties, type ReactElement } from "react";

import styles from "./WaxSeal.module.css";

/** A clip id unique to one seal and one half, safe inside url(#...). */
function clipId(reactId: string, half: "left" | "right"): string {
  return `wax-seal-${reactId.replace(/[^A-Za-z0-9_-]/g, "")}-${half}`;
}

/**
 * Replaces each seal's per-instance clip ids with a fixed placeholder, so
 * tests can compare seal markup from different render trees. Not used by the
 * page itself.
 */
export function normaliseWaxSealIds(html: string): string {
  return html.replace(/wax-seal-[A-Za-z0-9_-]*-(left|right)/g, "wax-seal-$1");
}

/** The seal is drawn in a fixed 100 x 100 user space and scaled to `size`. */
const VIEWBOX = 100;

/** The irregular wax blob, filled with the wax colour. */
const WAX_PATH =
  "M50 4 C74 3 96 22 96 40 C97 56 95 70 85 84 C76 94 60 98 44 97 " +
  "C30 96 18 92 14 84 C6 72 3 62 4 52 C4 36 8 28 11 22 C22 10 34 5 50 4 Z";

/** The pressed ghost: a head arc, straight sides and a zigzag hem. */
const GHOST_PATH =
  "M38 50 A12 12 0 0 1 62 50 L63 70 L59 66 L55 71 L51 66 L47 71 L43 66 " +
  "L39 71 L37 66 Z";

/** The left half: everything left of the jagged seam (x about 44 to 50). */
const LEFT_HALF = "0,0 46,0 44,24 50,48 45,74 49,100 0,100";
/** The right half: everything right of the same seam. */
const RIGHT_HALF = "46,0 100,0 100,100 49,100 45,74 50,48 44,24";

/** Every colour comes from a token, with a literal fallback. No colour carries meaning. */
const FILL_WAX: CSSProperties = { fill: "var(--wax, #ff7b1c)" };
const STROKE_RIM: CSSProperties = { stroke: "var(--wax-rim, #d4600c)" };
const FILL_INNER: CSSProperties = { fill: "var(--wax-inner, #f26f12)" };
const FILL_PRESS: CSSProperties = { fill: "var(--wax-press, #c4560a)" };
const FILL_EYE: CSSProperties = { fill: "var(--wax-eye, #ff8d3a)" };

/** The seal artwork, drawn once per half and clipped to that half. */
function SealArt(): ReactElement {
  return (
    <>
      <path d={WAX_PATH} style={FILL_WAX} />
      <circle
        cx={50}
        cy={50}
        r={33}
        fill="none"
        strokeWidth={3}
        style={STROKE_RIM}
      />
      <circle cx={50} cy={50} r={27} style={FILL_INNER} />
      <path d={GHOST_PATH} style={FILL_PRESS} />
      <ellipse cx={45.5} cy={51} rx={2.2} ry={3.2} style={FILL_EYE} />
      <ellipse cx={54.5} cy={51} rx={2.2} ry={3.2} style={FILL_EYE} />
    </>
  );
}

export type WaxSealProps = {
  /**
   * Deprecated and ignored. The seal is the same for every persona (R10.10).
   * Kept only so the callers outside this ticket still compile; their own
   * tasks remove it.
   */
  patternKey?: string;
  /** Rendered size in CSS pixels (square). Does not change the markup. */
  size?: number;
  /** Optional extra class on the root <svg>. */
  className?: string;
};

/**
 * The single orange wax seal. The markup is the same for every call: nothing
 * in it depends on a persona, a letter or a figure.
 */
export function WaxSeal({ size = 64, className }: WaxSealProps): ReactElement {
  // Each seal gets its own clip ids from useId, so two seals on one page never
  // share an id. React's id has characters that are awkward in url(#...), so
  // keep only letters, digits, underscores and hyphens.
  const leftId = clipId(useId(), "left");
  const rightId = clipId(useId(), "right");

  const rootClass = [styles.seal, className].filter(Boolean).join(" ");

  return (
    <svg
      className={rootClass}
      width={size}
      height={size}
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={leftId}>
          <polygon points={LEFT_HALF} />
        </clipPath>
        <clipPath id={rightId}>
          <polygon points={RIGHT_HALF} />
        </clipPath>
      </defs>
      <g className={styles.half} clipPath={`url(#${leftId})`}>
        <SealArt />
      </g>
      <g className={styles.half} clipPath={`url(#${rightId})`}>
        <SealArt />
      </g>
    </svg>
  );
}
