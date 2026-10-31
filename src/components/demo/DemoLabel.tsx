import { DEMO_COPY } from "./copy";
import styles from "./DemoLabel.module.css";

/**
 * The small "Demo" badge shown before the heading on every demo page (R6.5).
 *
 * Pure presentational server component: no "use client", no state, no data
 * access. Its text comes from copy.ts, so the demo pages hold no inline
 * literals (R15.1). Styling is co-located in DemoLabel.module.css and uses
 * only globals.css ink tokens -- no judgement colour, text clears WCAG 2.2 AA.
 */
export function DemoLabel() {
  return <span className={styles.badge}>{DEMO_COPY.demoLabel}</span>;
}
