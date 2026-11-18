// Feature: 14-write-desk (W7.4, W7.5). The two icons of a Question_Row: the
// pencil on the Edit control and the lock on the Lock_Line. Both are original
// inline SVG drawn with stroke="currentColor", so they take the text colour of
// the element around them and carry no image file. Both are decorative: the
// control or line that holds them supplies the words.

import type { ReactElement } from "react";

export type DeskIconProps = {
  className?: string;
};

const SVG_PROPS = {
  viewBox: "0 0 24 24",
  width: 14,
  height: 14,
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
} as const;

/** A pencil: the Edit control on a Question_Row. */
export function PencilIcon({ className }: DeskIconProps): ReactElement {
  return (
    <svg {...SVG_PROPS} className={className} data-icon="pencil">
      <path d="M4 20h4L19 9l-4-4L4 16v4z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  );
}

/** A padlock: the Lock_Line under each Question_Row input. */
export function LockIcon({ className }: DeskIconProps): ReactElement {
  return (
    <svg {...SVG_PROPS} className={className} data-icon="lock">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}
