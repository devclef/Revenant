// Feature: 13-the-seal (U1.4, U10.5)
//
// The fixed art of the seal, and the tones the relief layers use. Pure data:
// no markup, no state, no trig, so the seal's geometry is the same wherever it
// is drawn. WaxSeal.tsx still has its own copy of the wax outline until the
// hash prop task moves it here.
//
// Tones use the wax tokens that already exist (U1.4, U10.5). No colour is new:
//   - rings: --wax-press
//   - notches: --wax-eye
//   - fine marks: --wax-rim
// Every token has the same literal fallback that WaxSeal.tsx uses.

import type { SealRelief } from "./relief";

/** The irregular wax blob, in the 100-unit drawing space. */
export const WAX_PATH =
  "M50 4 C74 3 96 22 96 40 C97 56 95 70 85 84 C76 94 60 98 44 97 " +
  "C30 96 18 92 14 84 C6 72 3 62 4 52 C4 36 8 28 11 22 C22 10 34 5 50 4 Z";

/** The existing rim ring. The notches sit on it (radius 31.5 to 34.5). */
export const RIM_RING = { cx: 50, cy: 50, r: 33, strokeWidth: 3 } as const;

/** The inner disc. Nothing from the relief is drawn over the Signet centre. */
export const INNER_DISC_RADIUS = 27;

export type ArtTone = "press" | "eye" | "rim";

/** Token and literal fallback for each tone. */
export const TONE_FILL: Record<ArtTone, { token: string; fallback: string }> = {
  press: { token: "--wax-press", fallback: "#c4560a" },
  eye: { token: "--wax-eye", fallback: "#ff8d3a" },
  rim: { token: "--wax-rim", fallback: "#d4600c" },
};

export type ArtCircle = {
  cx: number;
  cy: number;
  r: number;
  strokeWidth: number;
  tone: "press";
};

export type ArtPath = { d: string; tone: ArtTone };

/**
 * The relief layers in draw order, back to front, for a valid relief: rings,
 * then notches, then the fine ticks and dots. A blank relief returns no layers.
 */
export type ReliefArt = {
  rings: readonly ArtCircle[];
  notches: ArtPath | null;
  fine: readonly ArtPath[];
};

export const EMPTY_RELIEF_ART: ReliefArt = {
  rings: [],
  notches: null,
  fine: [],
};

export function reliefArt(relief: SealRelief): ReliefArt {
  if (relief.kind === "blank" || relief.coarse === null)
    return EMPTY_RELIEF_ART;
  return {
    rings: relief.coarse.rings.map((ring) => ({
      cx: 50,
      cy: 50,
      r: ring.radius,
      strokeWidth: ring.width,
      tone: "press",
    })),
    notches: { d: relief.coarse.notchPath, tone: "eye" },
    fine: [
      { d: relief.tickPath, tone: "rim" },
      { d: relief.dotPath, tone: "rim" },
    ],
  };
}
