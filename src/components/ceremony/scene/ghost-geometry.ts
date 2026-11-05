// Feature: 07-judge-journey
//
// The Ghost's drawing geometry (design.md "The Ghost"). Plain constants only:
// no React, no DOM, so both the server-rendered Ghost and the eye follow can
// read the same values. The drawing is this repository's own, recorded in
// ASSETS.md.

/** The Ghost's SVG viewBox width, in user units. */
export const VIEWBOX_WIDTH = 200;

/** The Ghost's SVG viewBox height, in user units. */
export const VIEWBOX_HEIGHT = 240;

/** The Ghost's SVG viewBox, as the attribute value. */
export const VIEWBOX = `0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`;

/** The hem's zigzag, drawn after the head and body (design.md "The Ghost"). */
export const BODY_PATH =
  "M34 104 A66 66 0 0 1 166 104 " +
  "C170 150 176 190 176 228 " +
  "L163 212 L150 230 L137 212 L124 230 L111 212 L100 230 " +
  "L89 212 L76 230 L63 212 L50 230 L37 212 L24 228 " +
  "C24 190 30 150 34 104 Z";

/** The two folds on the body, drawn as an open path. */
export const FOLDS_PATH = "M58 150 L56 222 M142 150 L144 222";

/** Each eye is an ellipse with these radii, in user units. */
export const EYE_RADII = { rx: 11, ry: 16 } as const;

/** The two eye centres, in user units. Both eyes sit at y = 92. */
export const EYE_CENTRES = [
  { cx: 78, cy: 92 },
  { cx: 122, cy: 92 },
] as const;

/**
 * The midpoint of the eye centres, (100, 92) in SVG units. The eye follow
 * measures the pointer from here.
 */
export const EYE_CENTRE_SVG = { x: 100, y: 92 } as const;

/** The eyes' offset in SVG user units (the Ghost's 200 x 240 viewBox). */
export type EyeOffset = { dx: number; dy: number };
