import type { ElementType, ReactNode } from "react";
import styles from "./ParchmentSurface.module.css";

type ParchmentSurfaceProps = {
  children: ReactNode;
  /** Render as a different element (e.g. "section", "article"). Default "div". */
  as?: ElementType;
  /** Use the deeper parchment tone for nested or raised panels. */
  tone?: "paper" | "deep";
  className?: string;
};

/**
 * A paper/parchment panel wrapper: the envelope-on-a-mantelpiece surface the
 * rest of the UI sits on. Pure presentational server component — no client JS,
 * styled entirely from globals.css tokens via a co-located CSS module (served
 * as a 'self' stylesheet, so the strict CSP is satisfied).
 */
export function ParchmentSurface({
  children,
  as: Tag = "div",
  tone = "paper",
  className,
}: ParchmentSurfaceProps) {
  const toneClass = tone === "deep" ? styles.deep : styles.paper;
  const classes = [styles.surface, toneClass, className]
    .filter(Boolean)
    .join(" ");
  return <Tag className={classes}>{children}</Tag>;
}
