"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Opened } from "./opening-machine";
import type { RecallRecordV1 } from "@/lib/recall";
import { RememberedAnswers } from "./RememberedAnswers";
import { SealedLetter } from "./SealedLetter";
import { FiguresThenNow } from "./FiguresThenNow";
import { SealBreak } from "@/components/ceremony/seal/SealBreak";
import { useLocalView } from "@/components/ceremony/local-view";
import { REVEAL_COPY } from "./copy";
import styles from "./reveal.module.css";

/**
 * The staged reveal (design.md "Reveal", R9.1, R9.4). The reveal is shown only
 * after the encrypted recall record has been stored; the reducer enters the
 * `reveal` state only on `POST_OK`, always at stage 1. This component renders
 * the stages the current `stage` has reached and the controls that let the
 * judge move forward, one part at a time.
 *
 * - Stage 1 is the `marks` Stage (design.md "Seal_Break"): the existing
 *   `RememberedAnswers` as plain text — what the judge just remembered — above
 *   the unbroken wax seal, its instruction line and the "Break the seal"
 *   button, all owned by `SealBreak`. It holds nothing from inside the letter
 *   (R9.2, R9.3). Pressing and holding the seal for `SEAL_HOLD_MS`, or pressing
 *   the button, breaks the seal and sends `ADVANCE` exactly once (via
 *   `SealBreak`'s `onAdvance`), which reveals stage 2. `SealBreak` reports its
 *   `sealing` flag up through the local-view context, so the Ceremony Stage
 *   reads `seal` while a break is in progress and `marks` otherwise (design.md
 *   "Stage resolution").
 * - Stage 2 (`SealedLetter`) is shown once `stage >= 2`: what was written then.
 *   Its "See the numbers" button (`stage2Next`) dispatches `ADVANCE`.
 * - Stage 3 (`FiguresThenNow`) is shown once `stage >= 3`: the figures then and
 *   now. "Show everything" (`SHOW_ALL`) takes the stage straight to 3, so all
 *   three render at once; at stage 1 `SealBreak` renders the seal already split
 *   when "Show everything" is pressed.
 *
 * Each stage sits in a `${styles.stage} ${styles.fade}` container, so a newly
 * revealed stage fades in over 600 ms and instantly under reduced motion (the
 * CSS keyframe and the reduced-motion block live in reveal.module.css, R9.5).
 *
 * Focus (R9.6, accessibility): when a stage is newly revealed by forward
 * movement, focus moves to that stage's `<h2>` so a keyboard or screen-reader
 * user lands on the fresh content. The effect fires only on an increase in
 * `stage` (never on a re-render at the same stage), and only for the stage the
 * reveal just reached, so "Show everything" lands focus on the last stage it
 * opened.
 *
 * Pacing is driven only by the judge, never by a timer (R9.1): stage 1 is paced
 * by the seal break (hold or button), stage 2's `stage2Next` button dispatches
 * `ADVANCE`, and "Show everything" dispatches `SHOW_ALL`. The stage-2 controls
 * are shown only while a stage is still hidden (`stage === 2`) and disappear
 * once every stage is visible (R9.4). This component owns no stage state and
 * reads no clock; the stage lives in the reducer.
 *
 * Every string comes from copy.ts / the ceremony copy (R15.1).
 */

export type RevealProps = {
  /** The opened letter; its payload holds the sealed content. */
  opened: Opened;
  /** The stored recall record: what the judge remembered. */
  record: RecallRecordV1;
  /** The persona's display name, passed to `SealedLetter` for its demo label. */
  personaName: string;
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
  personaName,
  stage,
  onAdvance,
  onShowAll,
}: RevealProps) {
  // The local-view context lets stage 1's SealBreak report its `sealing` flag
  // up to CeremonyRoot, so `stageFor(state, local)` resolves `seal` while a
  // break is in progress and `marks` otherwise (design.md "Stage resolution").
  const { setLocalView } = useLocalView();

  // The containers for stages 2 and 3; focus moves to the heading inside the
  // stage the reveal just reached.
  const stage2Ref = useRef<HTMLDivElement>(null);
  const stage3Ref = useRef<HTMLDivElement>(null);

  // Track the previous stage so focus only moves on forward movement, not on a
  // re-render at the same stage.
  const prevStage = useRef<1 | 2 | 3>(stage);
  useEffect(() => {
    const previous = prevStage.current;
    prevStage.current = stage;
    if (stage <= previous) return;

    // Focus the heading of the furthest stage now revealed. "Show everything"
    // jumps straight to 3, so it lands on stage 3's heading.
    const container = stage >= 3 ? stage3Ref.current : stage2Ref.current;
    const heading = container?.querySelector<HTMLHeadingElement>("h2");
    heading?.focus();
  }, [stage]);

  // Report the seal-break's in-progress flag up to the local view so the
  // Ceremony Stage reads `seal` while holding and settles back to `marks`.
  const onSealingChange = useCallback(
    (sealing: boolean) => {
      setLocalView({ sealing });
    },
    [setLocalView],
  );

  // Stage 2 still shows its own next control; "Show everything" sits beside it.
  const stage2HasHidden = stage === 2;

  return (
    <section className={styles.reveal}>
      <div className={`${styles.stage} ${styles.fade}`}>
        <RememberedAnswers opened={opened} record={record} />
        {stage === 1 ? (
          <SealBreak
            patternKey={personaName}
            onAdvance={onAdvance}
            onShowAll={onShowAll}
            onSealingChange={onSealingChange}
          />
        ) : null}
      </div>

      {stage >= 2 ? (
        <div ref={stage2Ref} className={`${styles.stage} ${styles.fade}`}>
          <SealedLetter opened={opened} personaName={personaName} />
        </div>
      ) : null}

      {stage >= 3 ? (
        <div ref={stage3Ref} className={`${styles.stage} ${styles.fade}`}>
          <FiguresThenNow opened={opened} record={record} />
        </div>
      ) : null}

      {stage2HasHidden ? (
        <div className={styles.stageControls}>
          <button
            type="button"
            className={styles.button}
            onClick={onAdvance}
          >
            {REVEAL_COPY.stage2Next}
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
