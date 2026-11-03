"use client";

import { useCallback } from "react";
import type { Opened } from "./opening-machine";
import type { RecallRecordV1 } from "@/lib/recall";
import { RememberedAnswers } from "./RememberedAnswers";
import { InkLetter } from "@/components/ceremony/letter/InkLetter";
import { FiguresThenNow } from "./FiguresThenNow";
import { StagePanel } from "./StagePanel";
import { ThenNowSequence } from "@/components/ceremony/figures/ThenNowSequence";
import { Close } from "@/components/ceremony/close/Close";
import { SealBreak } from "@/components/ceremony/seal/SealBreak";
import type { SealController } from "@/components/ceremony/seal/useSealBreak";
import { IDLE } from "@/components/ceremony/seal/hold";
import { RecallScale } from "@/components/ceremony/recall/RecallScale";
import { useLocalView } from "@/components/ceremony/local-view";
import { REVEAL_COPY } from "./copy";
import styles from "./reveal.module.css";

/** The marks stage's scales are read-only, so they never send an edit. */
const NO_EDIT = () => undefined;

/**
 * Used when no controller is passed (static renders in the tests). The seal
 * shows intact and its controls do nothing. OpeningFlow always passes the real
 * controller from `useSealBreak`.
 */
const INERT_SEAL: SealController = {
  hold: IDLE,
  broken: false,
  progress: 0,
  press: () => undefined,
  breakNow: () => undefined,
  showAll: () => undefined,
  skip: () => undefined,
  connect: () => undefined,
};

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
 * Focus (R9.6, accessibility): `CeremonyRoot` moves focus to the newest Stage
 * heading whenever the Stage changes, so this component holds no focus code.
 * "Show everything" therefore lands focus on stage 3's heading.
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
  /**
   * The live letter's id. In live mode it seeds the wax seal's pattern and is
   * passed to `SealedLetter`; the persona path ignores it (spec 06, R18.2).
   */
  letterId?: string;
  /** The highest stage currently revealed (1, 2 or 3). */
  stage: 1 | 2 | 3;
  /** Dispatches `ADVANCE`, revealing the next hidden stage. */
  onAdvance: () => void;
  /** Dispatches `SHOW_ALL`, revealing every remaining stage at once. */
  onShowAll: () => void;
  /**
   * The Seal_Break controller from OpeningFlow's `useSealBreak` (called once
   * there). Stage 1's SealBreak reads and drives it. Optional: without it the
   * seal shows intact and its controls do nothing.
   */
  seal?: SealController;
  /**
   * `"persona"` (default) or `"live"`. Live letters use the live stage 2 line
   * and let a same-figure pair show a zero change (spec 06, R18.2).
   */
  variant?: "persona" | "live";
};

export function Reveal({
  opened,
  record,
  personaName,
  letterId,
  stage,
  onAdvance,
  onShowAll,
  seal,
  variant = "persona",
}: RevealProps) {
  // The local-view context lets stage 1's SealBreak report its `sealing` flag
  // up to CeremonyRoot, so `stageFor(state, local)` resolves `seal` while a
  // break is in progress and `marks` otherwise (design.md "Stage resolution").
  const { localView, setLocalView } = useLocalView();

  // Report the seal-break's in-progress flag up to the local view so the
  // Ceremony Stage reads `seal` while holding and settles back to `marks`.
  const onSealingChange = useCallback(
    (sealing: boolean) => {
      setLocalView({ sealing });
    },
    [setLocalView],
  );

  // One entry per sealed figure, in payload order. The stage 3 Steps are timed
  // by the number of entries only, never by their values (R10.5).
  const thenNowEntries = opened.payload.figures.map((figure, index) => ({
    key: `${figure.metric_id}-${index}`,
  }));

  // The marks stage shows each number answer on a read-only scale, with the Mark
  // at the recorded value. A question with no stored number shows no Mark. The
  // unit comes from the sealed metric; the answer comes from the stored record.
  const unitByMetricId = new Map<string, string>();
  for (const metric of opened.payload.metrics) {
    unitByMetricId.set(metric.id, metric.unit);
  }
  const answerByQuestionId = new Map(
    record.answers.map((answer) => [answer.question_id, answer] as const),
  );
  const recordedScales = opened.payload.recall_questions.flatMap((question) => {
    const unit =
      question.answer_type === "number"
        ? unitByMetricId.get(question.metric_id)
        : undefined;
    if (unit === undefined) return [];
    const answer = answerByQuestionId.get(question.id);
    const recordedValue =
      answer !== undefined && answer.kind === "number" ? Number(answer.value) : null;
    return [
      <RecallScale
        key={question.id}
        id={question.id}
        label={question.text}
        unitLabel={unit}
        value={recordedValue}
        noAnswer={recordedValue === null}
        onEdit={NO_EDIT}
        readOnly
        spokenPrefix={REVEAL_COPY.yourAnswer}
      />,
    ];
  });

  // Stage 2 still shows its own next control; "Show everything" sits beside it.
  const stage2HasHidden = stage === 2;

  return (
    <section className={styles.reveal}>
      <div className={`${styles.stage} ${styles.fade}`}>
        <StagePanel>
          <RememberedAnswers opened={opened} record={record} />
          {recordedScales}
          {stage === 1 ? (
            <SealBreak
              patternKey={variant === "live" ? (letterId ?? personaName) : personaName}
              seal={seal ?? INERT_SEAL}
              showAll
              onSealingChange={onSealingChange}
            />
          ) : null}
        </StagePanel>
      </div>

      {stage >= 2 ? (
        <div className={`${styles.stage} ${styles.fade}`}>
          <StagePanel>
            <InkLetter
              opened={opened}
              personaName={personaName}
              variant={variant}
              letterId={letterId}
            />
          </StagePanel>
        </div>
      ) : null}

      {stage >= 3 ? (
        <div className={`${styles.stage} ${styles.fade}`}>
          <ThenNowSequence entries={thenNowEntries}>
            <StagePanel>
              <FiguresThenNow
                opened={opened}
                record={record}
                allowSamePeriod={variant === "live"}
              />
            </StagePanel>
          </ThenNowSequence>
        </div>
      ) : null}

      {/* Close (R12.9) shows once the stage 3 Steps are done. The sequence
          reports `done` when its last Step settles or Skip ends it, so Close
          never appears while the then or now figures are still moving. */}
      {stage >= 3 && localView.step === "done" ? (
        <div className={`${styles.stage} ${styles.fade}`}>
          <Close />
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
