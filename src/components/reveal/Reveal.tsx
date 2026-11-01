"use client";

import type { Opened } from "./opening-machine";
import type { RecallRecordV1 } from "@/lib/recall";
import { RememberedAnswers } from "./RememberedAnswers";
import { REVEAL_COPY } from "./copy";
import styles from "./reveal.module.css";

/**
 * The staged reveal (design.md "Reveal", R9.1, R9.4). The reveal is shown only
 * after the encrypted recall record has been stored; the reducer enters the
 * `reveal` state only on `POST_OK`, always at stage 1. This component renders
 * the stages the current `stage` has reached and the controls that let the
 * judge move forward, one part at a time.
 *
 * - Stage 1 (`RememberedAnswers`) is always shown: it is what the judge just
 *   remembered, and holds nothing from inside the letter (R9.2, R9.3).
 * - Stage 2 (the sealed letter) and stage 3 (the figures then and now) are
 *   filled in by a later task; for now they render nothing.
 *
 * Pacing is driven only by the judge, never by a timer (R9.1): the next-stage
 * button dispatches `ADVANCE` and the "Show everything" control dispatches
 * `SHOW_ALL`. Both are shown only while a stage is still hidden (`stage < 3`),
 * and both disappear once every stage is visible (R9.4). This component owns no
 * state and reads no clock; the stage lives in the reducer.
 *
 * Every string comes from copy.ts (R15.1).
 */

export type RevealProps = {
  /** The opened letter; its payload holds the sealed content. */
  opened: Opened;
  /** The stored recall record: what the judge remembered. */
  record: RecallRecordV1;
  /** The highest stage currently revealed (1, 2 or 3). */
  stage: 1 | 2 | 3;
  /** Dispatches `ADVANCE`, revealing the next hidden stage. */
  onAdvance: () => void;
  /** Dispatches `SHOW_ALL`, revealing every remaining stage at once. */
  onShowAll: () => void;
};

export function Reveal({
  opened,
  record,
  stage,
  onAdvance,
  onShowAll,
}: RevealProps) {
  // A stage is still hidden while the current stage is below 3. Stages 2 and 3
  // render nothing until a later task fills them, but the controls that reach
  // them are wired now so the pacing is in place.
  const hasHiddenStage = stage < 3;

  return (
    <section className={styles.reveal}>
      <div className={`${styles.stage} ${styles.fade}`}>
        <RememberedAnswers opened={opened} record={record} />
      </div>

      {/* Stage 2 (the sealed letter) is added by a later task. */}
      {stage >= 2 ? <div className={`${styles.stage} ${styles.fade}`} /> : null}

      {/* Stage 3 (the figures then and now) is added by a later task. */}
      {stage >= 3 ? <div className={`${styles.stage} ${styles.fade}`} /> : null}

      {hasHiddenStage ? (
        <div className={styles.stageControls}>
          <button
            type="button"
            className={styles.button}
            onClick={onAdvance}
          >
            {REVEAL_COPY.stage1Next}
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={onShowAll}
          >
            {REVEAL_COPY.showAll}
          </button>
        </div>
      ) : null}
    </section>
  );
}
