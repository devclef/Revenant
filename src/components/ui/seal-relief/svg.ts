// Feature: 13-the-seal (U4.3)
//
// sealSvgGroup: the seal as a static SVG `<g>` for the letter card image. It
// draws the same layers, in the same order and tones, as `SealArt` in
// WaxSeal.tsx, so a card and a page seal for one hash show the same relief.
//
// Literal colours only: every token in WaxSeal falls back to its literal value
// here. No CSS variables, no `<clipPath>`, no animation and no raster, so the
// group still renders when pasted into a saved SVG file. The seal is drawn once.
// WaxSeal's two clipped halves sit together at rest, so one copy looks the same.
//
// The relief depends only on `hash`. A missing or bad hash draws the blank
// signet, the same as WaxSeal does. This module is pure and browser-safe.

import {
  GHOST_PATH,
  INNER_DISC_RADIUS,
  RIM_RING,
  TONE_FILL,
  WAX_PATH,
  reliefArt,
  type ArtTone,
} from "./seal-art";
import { sealRelief } from "./relief";

/** Literal colours, the same as the token fallbacks in WaxSeal. */
const FILL_WAX = "#ff7b1c";
const STROKE_RIM = "#d4600c";
const FILL_INNER = "#f26f12";
const FILL_PRESS = "#c4560a";
const FILL_EYE = "#ff8d3a";

/** The literal colour for a relief tone, taken from the shared tone table. */
function toneColour(tone: ArtTone): string {
  return TONE_FILL[tone].fallback;
}

/** Rounds to 3 decimals so the markup stays short and stable. */
function n(value: number): string {
  return String(Math.round(value * 1000) / 1000);
}

/**
 * The seal as one `<g>`, with its top left corner at (x, y) and `size` user
 * units across. The seal is drawn in a 100 x 100 space and scaled to `size`.
 */
export function sealSvgGroup(
  hash: unknown,
  x: number,
  y: number,
  size: number,
): string {
  const art = reliefArt(sealRelief(hash));
  const scale = size / 100;

  const parts: string[] = [
    `<g transform="translate(${n(x)} ${n(y)}) scale(${n(scale)})">`,
    `<path d="${WAX_PATH}" fill="${FILL_WAX}"/>`,
  ];

  for (const ring of art.rings) {
    parts.push(
      `<circle cx="${ring.cx}" cy="${ring.cy}" r="${ring.r}" fill="none" ` +
        `stroke="${toneColour(ring.tone)}" stroke-width="${ring.strokeWidth}"/>`,
    );
  }

  parts.push(
    `<circle cx="${RIM_RING.cx}" cy="${RIM_RING.cy}" r="${RIM_RING.r}" fill="none" ` +
      `stroke="${STROKE_RIM}" stroke-width="${RIM_RING.strokeWidth}"/>`,
  );

  if (art.notches !== null) {
    parts.push(
      `<path d="${art.notches.d}" fill="${toneColour(art.notches.tone)}"/>`,
    );
  }

  parts.push(
    `<circle cx="50" cy="50" r="${INNER_DISC_RADIUS}" fill="${FILL_INNER}"/>`,
  );

  for (const mark of art.fine) {
    parts.push(`<path d="${mark.d}" fill="${toneColour(mark.tone)}"/>`);
  }

  parts.push(
    `<path d="${GHOST_PATH}" fill="${FILL_PRESS}"/>`,
    `<ellipse cx="45.5" cy="51" rx="2.2" ry="3.2" fill="${FILL_EYE}"/>`,
    `<ellipse cx="54.5" cy="51" rx="2.2" ry="3.2" fill="${FILL_EYE}"/>`,
    `</g>`,
  );

  return parts.join("");
}
