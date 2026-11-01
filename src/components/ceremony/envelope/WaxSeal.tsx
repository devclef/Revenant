// Feature: 05-reveal-ceremony
//
// WaxSeal: a standalone inline-SVG wax disc for the envelope flap (design.md
// "Envelope and seal", R8.4, R10.1). It is pure and presentational: given a
// `patternKey` it draws one wax disc whose rim style, centre glyph and rotation
// come only from `sealPattern(key)`. The same key always gives the same markup,
// on the server and the client alike (Property 4, Property 21).
//
// Neutrality (R10.1): every seal is filled with the single --seal-wax token,
// whatever the key. No colour here depends on a value or a direction. The
// pattern is decoration only and reads nothing but the key — no letter text, no
// figure, no metric, no unit.
//
// It draws no crack overlay itself; cracks belong to the seal/ task. WaxSeal is
// a self-contained disc that the Envelope places on its flap. Being pure
// presentational, it needs no "use client".

import type { ReactElement, ReactNode } from "react";

import { sealPattern } from "./seal-pattern";
import styles from "./WaxSeal.module.css";

/**
 * The wax disc is drawn in a fixed, square 100×100 user space and scaled to the
 * caller's `size`. Every coordinate below is in this space, so the markup never
 * depends on the rendered pixel size.
 */
const VIEWBOX = 100;
const CENTER = VIEWBOX / 2;
const DISC_RADIUS = 46;

/**
 * Eight rim styles, indexed 0..7 (RIM_COUNT). Each is a fully-formed SVG
 * fragment drawn inside the disc, concentric with it, and is the same for every
 * seal that lands on that rim index. The rim is the pressed border just inside
 * the wax edge: plain, double, beaded, notched, and so on. Nothing here is
 * computed from data.
 */
const RIM_STYLES: readonly ReactNode[] = [
  // 0 — plain ring
  <circle key="r0" cx={CENTER} cy={CENTER} r={38} />,
  // 1 — double ring
  <g key="r1">
    <circle cx={CENTER} cy={CENTER} r={39} />
    <circle cx={CENTER} cy={CENTER} r={33} />
  </g>,
  // 2 — beaded ring: twelve small pressed dots around the rim
  <g key="r2">
    {Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      return (
        <circle
          key={i}
          cx={CENTER + Math.cos(a) * 37}
          cy={CENTER + Math.sin(a) * 37}
          r={2.4}
          stroke="none"
          fill="var(--seal-rim, #5c1713)"
        />
      );
    })}
  </g>,
  // 3 — notched ring: short radial ticks
  <g key="r3">
    <circle cx={CENTER} cy={CENTER} r={38} />
    {Array.from({ length: 16 }, (_, i) => {
      const a = (i / 16) * Math.PI * 2;
      return (
        <line
          key={i}
          x1={CENTER + Math.cos(a) * 34}
          y1={CENTER + Math.sin(a) * 34}
          x2={CENTER + Math.cos(a) * 40}
          y2={CENTER + Math.sin(a) * 40}
        />
      );
    })}
  </g>,
  // 4 — rope ring: a dashed circle reads as a twisted cord
  <circle
    key="r4"
    cx={CENTER}
    cy={CENTER}
    r={38}
    strokeDasharray="4 3"
  />,
  // 5 — twin thin rings close together
  <g key="r5">
    <circle cx={CENTER} cy={CENTER} r={40} strokeWidth={1.5} />
    <circle cx={CENTER} cy={CENTER} r={37} strokeWidth={1.5} />
  </g>,
  // 6 — scalloped rim: eight small arcs read as a pressed scallop
  <g key="r6">
    {Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return (
        <circle
          key={i}
          cx={CENTER + Math.cos(a) * 38}
          cy={CENTER + Math.sin(a) * 38}
          r={4}
        />
      );
    })}
  </g>,
  // 7 — thick single band
  <circle key="r7" cx={CENTER} cy={CENTER} r={37} strokeWidth={4} />,
];

/**
 * Twelve centre glyphs, indexed 0..11 (GLYPH_COUNT): rings, dots, leaves and
 * simple geometric marks drawn in this repo. Each is drawn at the disc centre
 * and is the same for every seal on that glyph index. Decorative only. No star,
 * cross or crescent shapes: those carry religious or political meaning, so the
 * glyph list must not use them (issue #119).
 */
export const GLYPHS: readonly ReactNode[] = [
  // 0 — small ring
  <circle key="g0" cx={CENTER} cy={CENTER} r={10} />,
  // 1 — ring with a dot
  <g key="g1">
    <circle cx={CENTER} cy={CENTER} r={11} />
    <circle cx={CENTER} cy={CENTER} r={2.5} stroke="none" fill="var(--seal-rim, #5c1713)" />
  </g>,
  // 2 — four dots around a centre dot
  <g key="g2" stroke="none" fill="var(--seal-rim, #5c1713)">
    <circle cx={CENTER} cy={CENTER - 9} r={2.4} />
    <circle cx={CENTER + 9} cy={CENTER} r={2.4} />
    <circle cx={CENTER} cy={CENTER + 9} r={2.4} />
    <circle cx={CENTER - 9} cy={CENTER} r={2.4} />
    <circle cx={CENTER} cy={CENTER} r={2.4} />
  </g>,
  // 3 — five dots on a ring
  <g key="g3" stroke="none" fill="var(--seal-rim, #5c1713)">
    {Array.from({ length: 5 }, (_, i) => {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      return (
        <circle
          key={i}
          cx={CENTER + Math.cos(a) * 11}
          cy={CENTER + Math.sin(a) * 11}
          r={2.4}
        />
      );
    })}
  </g>,
  // 4 — six dots on a ring
  <g key="g4" stroke="none" fill="var(--seal-rim, #5c1713)">
    {Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2;
      return (
        <circle
          key={i}
          cx={CENTER + Math.cos(a) * 11}
          cy={CENTER + Math.sin(a) * 11}
          r={2.4}
        />
      );
    })}
  </g>,
  // 5 — single leaf
  <path
    key="g5"
    d="M50 38 C58 44 58 56 50 62 C42 56 42 44 50 38 Z M50 40 L50 60"
  />,
  // 6 — two leaves, mirrored
  <path
    key="g6"
    d="M50 50 C44 44 44 38 50 36 C56 38 56 44 50 50 Z M50 50 C56 56 56 62 50 64 C44 62 44 56 50 50 Z"
  />,
  // 7 — three-leaf sprig
  <path
    key="g7"
    d="M50 50 C44 46 44 40 50 38 C56 40 56 46 50 50 Z M50 50 C52 57 48 62 44 62 C44 57 46 52 50 50 Z M50 50 C48 57 52 62 56 62 C56 57 54 52 50 50 Z"
  />,
  // 8 — concentric rings
  <g key="g8">
    <circle cx={CENTER} cy={CENTER} r={12} />
    <circle cx={CENTER} cy={CENTER} r={6} />
  </g>,
  // 9 — eight dots on a ring
  <g key="g9" stroke="none" fill="var(--seal-rim, #5c1713)">
    {Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2;
      return (
        <circle
          key={i}
          cx={CENTER + Math.cos(a) * 12}
          cy={CENTER + Math.sin(a) * 12}
          r={2}
        />
      );
    })}
  </g>,
  // 10 — diamond
  <path key="g10" d="M50 37 L62 50 L50 63 L38 50 Z" />,
  // 11 — ring with a small leaf
  <g key="g11">
    <circle cx={CENTER} cy={CENTER} r={11} />
    <path d="M50 42 C54 45 54 55 50 58 C46 55 46 45 50 42 Z" />
  </g>,
];

/**
 * A short shape name for each centre glyph, in GLYPHS order. The glyph test
 * scans this list and fails on any star, cross or crescent name. Keep the two
 * lists the same length and in the same order.
 */
export const GLYPH_SHAPES: readonly string[] = [
  "ring",
  "ring with a dot",
  "four dots around a centre dot",
  "dots on a ring of five",
  "dots on a ring of six",
  "leaf",
  "two leaves",
  "three-leaf sprig",
  "concentric rings",
  "eight dots on a ring",
  "diamond",
  "ring with a leaf",
];

export type WaxSealProps = {
  /** The persona key that seeds the decorative pattern. Only input to the look. */
  patternKey: string;
  /** Rendered size in CSS pixels (square). Does not change the markup's shape. */
  size?: number;
  /** Optional extra class on the root <svg>. */
  className?: string;
};

/**
 * A single wax seal disc, seeded only by `patternKey`.
 *
 * The disc is filled with --seal-wax (one colour for every key). The rim style,
 * centre glyph and rotation are picked by sealPattern(patternKey). The whole
 * seal is rotated by the pattern's rotation; the disc itself is radially
 * symmetric, so rotation only turns the rim and glyph. Markup is identical
 * across renders for a given key and depends on no letter content.
 */
export function WaxSeal({
  patternKey,
  size = 64,
  className,
}: WaxSealProps): ReactElement {
  const { rim, glyph, rotationDeg } = sealPattern(patternKey);

  // The .seal class carries the --seal-wax / --seal-rim tokens. Joined in a
  // fixed order so the markup stays identical across renders for a given key.
  const rootClass = [styles.seal, className].filter(Boolean).join(" ");

  return (
    <svg
      className={rootClass}
      width={size}
      height={size}
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      role="img"
      aria-label="A wax seal."
      focusable="false"
    >
      {/* The wax disc: one colour for every key (R10.1). */}
      <circle
        cx={CENTER}
        cy={CENTER}
        r={DISC_RADIUS}
        fill="var(--seal-wax, #7a1f1a)"
        stroke="none"
      />
      {/* Rim and glyph, turned together by the seeded rotation. The disc is
          symmetric, so rotation never changes the silhouette. The pressed marks
          are drawn in the darker rim ink; none of this carries meaning. */}
      <g
        transform={`rotate(${rotationDeg} ${CENTER} ${CENTER})`}
        fill="none"
        stroke="var(--seal-rim, #5c1713)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {RIM_STYLES[rim]}
        {GLYPHS[glyph]}
      </g>
    </svg>
  );
}
