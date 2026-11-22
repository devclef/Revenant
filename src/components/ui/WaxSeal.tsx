// Feature: 13-the-seal (U1.3, U2, U4, U10)
//
// WaxSeal: the orange wax seal on an envelope (design.md "1. Seal_Relief").
// The one prop that changes its look is `hash`, the letter's 64-character
// lowercase hex SHA-256 fingerprint.
//
// - Without a valid hash it draws the Blank_Signet: the same wax, rim ring,
//   inner disc, pressed ghost and two eyes for every caller. Nothing about a
//   letter shows, so a missing or bad hash never gives a placeholder relief
//   (U1.3, U5.1).
// - With a valid hash it also draws the relief layers from seal-relief, in
//   draw order (design "Tone and draw order"): wax, coarse rings, the rim
//   ring, coarse notches, the inner disc, fine ticks and dots, the ghost. The
//   relief is derived from the hash only, so the same hash always draws the
//   same seal and two different hashes draw different ones.
//
// The two halves are drawn twice, clipped by a left and a right polygon along a
// jagged seam, so the break and the crack overlays still work. At rest they sit
// together (R10.12). The seal is decoration, so it is `aria-hidden`; the "Break
// the seal" button is the accessible control.
//
// Neutrality (neutrality.md): every colour is an existing wax token. No colour
// carries meaning, and the relief names no party, nation or belief.
//
// Pure presentation with no state, so it needs no "use client".

import { useId, type CSSProperties, type ReactElement } from "react";

import styles from "./WaxSeal.module.css";
import {
  GHOST_PATH,
  INNER_DISC_RADIUS,
  RIM_RING,
  TONE_FILL,
  WAX_PATH,
  reliefArt,
  type ArtTone,
  type ReliefArt,
} from "./seal-relief/seal-art";
import { sealRelief } from "./seal-relief/relief";

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

/** The fill for a relief path, from its tone token and literal fallback. */
function toneFill(tone: ArtTone): CSSProperties {
  const { token, fallback } = TONE_FILL[tone];
  return { fill: `var(${token}, ${fallback})` };
}

/** The stroke for a relief ring, from its tone token and literal fallback. */
function toneStroke(tone: ArtTone): CSSProperties {
  const { token, fallback } = TONE_FILL[tone];
  return { stroke: `var(${token}, ${fallback})` };
}

/**
 * The seal artwork, drawn once per half and clipped to that half. `art` is
 * empty for the Blank_Signet, so the blank markup has no relief elements.
 */
function SealArt({ art }: { art: ReliefArt }): ReactElement {
  return (
    <>
      <path d={WAX_PATH} style={FILL_WAX} />
      {art.rings.map((ring, i) => (
        <circle
          key={`ring-${i}`}
          cx={ring.cx}
          cy={ring.cy}
          r={ring.r}
          fill="none"
          strokeWidth={ring.strokeWidth}
          style={toneStroke(ring.tone)}
        />
      ))}
      <circle
        cx={RIM_RING.cx}
        cy={RIM_RING.cy}
        r={RIM_RING.r}
        fill="none"
        strokeWidth={RIM_RING.strokeWidth}
        style={STROKE_RIM}
      />
      {art.notches === null ? null : (
        <path d={art.notches.d} style={toneFill(art.notches.tone)} />
      )}
      <circle cx={50} cy={50} r={INNER_DISC_RADIUS} style={FILL_INNER} />
      {art.fine.map((mark, i) => (
        <path key={`fine-${i}`} d={mark.d} style={toneFill(mark.tone)} />
      ))}
      <path d={GHOST_PATH} style={FILL_PRESS} />
      <ellipse cx={45.5} cy={51} rx={2.2} ry={3.2} style={FILL_EYE} />
      <ellipse cx={54.5} cy={51} rx={2.2} ry={3.2} style={FILL_EYE} />
    </>
  );
}

export type WaxSealProps = {
  /**
   * Deprecated and ignored. Callers outside the seal still pass it. The seal
   * now depends only on `hash`.
   */
  patternKey?: string;
  /**
   * The letter's SHA-256 fingerprint: 64 lowercase hex characters. Anything
   * else draws the Blank_Signet.
   */
  hash?: string;
  /** Rendered size in CSS pixels (square). Does not change the artwork. */
  size?: number;
  /** Optional extra class on the root <svg>. */
  className?: string;
};

/**
 * The orange wax seal. With no valid `hash` the markup is the same for every
 * call. With a valid `hash` the relief for that hash is drawn, and the root
 * carries `data-seal-hash` and `data-coarse`.
 */
export function WaxSeal({
  hash,
  size = 64,
  className,
}: WaxSealProps): ReactElement {
  // Each seal gets its own clip ids from useId, so two seals on one page never
  // share an id. React's id has characters that are awkward in url(#...), so
  // keep only letters, digits, underscores and hyphens.
  const leftId = clipId(useId(), "left");
  const rightId = clipId(useId(), "right");

  const relief = sealRelief(hash);
  const art = reliefArt(relief);
  const reliefData =
    relief.kind === "relief"
      ? {
          "data-seal-hash": relief.hash,
          "data-coarse": relief.coarse.signature,
        }
      : {};

  const rootClass = [styles.seal, className].filter(Boolean).join(" ");

  return (
    <svg
      className={rootClass}
      width={size}
      height={size}
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      aria-hidden="true"
      focusable="false"
      data-wax-seal=""
      {...reliefData}
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
        <SealArt art={art} />
      </g>
      <g className={styles.half} clipPath={`url(#${rightId})`}>
        <SealArt art={art} />
      </g>
    </svg>
  );
}
