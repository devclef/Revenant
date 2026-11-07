import type { ReactNode } from "react";
import paper from "@/components/ui/paper.module.css";
import styles from "./reveal.module.css";

/**
 * A paper panel for one reveal stage (issue #119). The reveal sits on the
 * ceremony desk, whose text is cream. Stage text placed directly
 * on the desk is unreadable, so every stage's content goes inside this
 * paper panel. The panel sets its own text colour (`--ink`) in
 * `.paper`, so no stage text inherits the desk's cream ink (tone.md).
 *
 * Presentational only: no hooks, no clock, no state.
 */
export type StagePanelProps = {
  children: ReactNode;
};

export function StagePanel({ children }: StagePanelProps) {
  return (
    <div className={`${paper.paper} ${styles.stagePanel}`} data-paper="" data-stage-panel="">
      {children}
    </div>
  );
}
