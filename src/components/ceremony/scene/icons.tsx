// Feature: 09-demo-polish (Group P, P5.2, OD13 a)
//
// The two icons of the Compact_Top_Bar: motion (Calm) and Skip. Both are
// original inline SVG drawn with stroke="currentColor", so they take the
// surface's text colour (--text) and carry no image file. Each is decorative:
// the button that holds it has the accessible name and the title.
// ASSETS.md has a row for this file (assets.test.ts checks it).

import type { ReactElement } from "react";

export type IconProps = {
  /** Adds a slash through the icon. Used by the motion icon when motion is off. */
  off?: boolean;
  className?: string;
};

const SVG_PROPS = {
  viewBox: "0 0 24 24",
  width: 24,
  height: 24,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
} as const;

/** Motion: a wave. With `off`, a slash runs through it. */
export function MotionIcon({ off = false, className }: IconProps): ReactElement {
  return (
    <svg {...SVG_PROPS} className={className} data-icon="motion">
      <path d="M3 12c2.2-3 4.4-3 6.6 0s4.4 3 6.6 0 2.2-2.4 3.2-1.6" />
      {off ? <path d="M4 4l16 16" /> : null}
    </svg>
  );
}

/** Sound: a speaker with sound waves. With `off`, the waves become a cross. */
export function SoundIcon({ off = false, className }: IconProps): ReactElement {
  return (
    <svg {...SVG_PROPS} className={className} data-icon="sound">
      <path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4z" />
      {off ? (
        <path d="M16 9.5l5 5M21 9.5l-5 5" />
      ) : (
        <path d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18.5 6.5a7.5 7.5 0 0 1 0 11" />
      )}
    </svg>
  );
}

/** Skip: two forward triangles. */
export function SkipIcon({ className }: IconProps): ReactElement {
  return (
    <svg {...SVG_PROPS} className={className} data-icon="skip">
      <path d="M4 6.5v11l7-5.5z" />
      <path d="M13 6.5v11l7-5.5z" />
    </svg>
  );
}
