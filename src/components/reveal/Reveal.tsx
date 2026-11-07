"use client";

import { useCallback, useContext, useEffect, useState } from "react";
import type { Opened } from "./opening-machine";
import { AnswerList, type AnswerListItem } from "./AnswerList";
import { PHONE_QUERY } from "@/components/ceremony/scene/TopBar";
import type { LetterKind } from "./FigureLine";
import type { RecallRecordV1 } from "@/lib/recall";
import { LetterBlock } from "@/components/ceremony/letter/LetterBlock";
import { SoundEnabledContext } from "@/components/ceremony/sound/SoundEnabledContext";
import { FiguresThenNow } from "./FiguresThenNow";
import { useFigures } from "./figures-api";
import { Fingerprint } from "./Fingerprint";
import { StagePanel } from "./StagePanel";
import { FiguresFadeUp } from "@/components/ceremony/figures/FiguresFadeUp";
import { Close, type CloseProps } from "@/components/ceremony/close/Close";
import { SealBreak } from "@/components/ceremony/seal/SealBreak";
import type { SealController } from "@/components/ceremony/seal/useSealBreak";
import { IDLE } from "@/components/ceremony/seal/hold";
import { RecordedScale } from "@/components/ceremony/recall/RecordedScale";
import { answerText } from "@/components/ceremony/recall/answer-text";
import { displayUnitFor } from "@/components/ceremony/recall/unit-ranges";
import { useLocalView } from "@/components/ceremony/local-view";
import { REVEAL_COPY } from "./copy";
import styles from "./reveal.module.css";

/**
 * True below 600 px (the Phone_Sizes, spec 09 P6). The server and the first
 * client render report false, so hydration never mismatches; the effect then
 * follows the viewport, the same way `TopBar` does (P5.1).
 */
function usePhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const query = window.matchMedia(PHONE_QUERY);
    const update = () => setPhone(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return phone;
}

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
 * - Stage 1 is the `marks` Stage (design.md "Seal_Break"): the marks column.
 *   It shows the "Your testimony" heading, each answer with the judge's
 *   value in the Accent (or "No answer"), the read-only recall scales, then the
 *   seal, its instruction line and the "Break the seal" and "Show everything"
 *   buttons, all owned by `SealBreak`, with the sound toggle and its note under
 *   them on the persona page. It holds nothing from inside the letter
 *   (R9.2, R9.3). Pressing and holding the seal for `SEAL_HOLD_MS`, or pressing
 *   the button, breaks the seal and sends `ADVANCE` exactly once (via
 *   `SealBreak`'s `onAdvance`), which reveals stage 2. `SealBreak` reports its
 *   `sealing` flag up through the local-view context, so the Ceremony Stage
 *   reads `seal` while a break is in progress and `marks` otherwise (design.md
 *   "Stage resolution").
 * - Stage 2 (`LetterBlock`, which wraps `SealedLetter`) is shown once
 *   `stage >= 2`: what was written then. Its "See the receipts" button
 *   (`stage2Next`) dispatches `ADVANCE`.
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
  /**
   * The kind of opened letter, passed straight to `FiguresThenNow` so each then
   * figure's label reads correctly (R13.1, R13.2). Default `"persona"` keeps
   * the persona path unchanged. OpeningFlow derives it: persona mode is
   * `"persona"`; live mode is `"live"` for a demo letter and `"real"`
   * otherwise.
   */
  letterKind?: LetterKind;
  /**
   * What the close shows (design.md "Close"). OpeningFlow passes it; it holds
   * only the persona key and the Demo_2_On boolean, never RP_ID. Without it no
   * close is rendered.
   */
  close?: CloseProps;
  /**
   * Forces the phone layout (true below 600 px) instead of reading the
   * viewport. Tests pass it, because static renders have no viewport. Omitted
   * in the app, where the viewport decides.
   */
  phone?: boolean;
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
  letterKind = "persona",
  close,
  phone,
}: RevealProps) {
  // The local-view context lets stage 1's SealBreak report its `sealing` flag
  // up to CeremonyRoot, so `stageFor(state, local)` resolves `seal` while a
  // break is in progress and `marks` otherwise (design.md "Stage resolution").
  const { localView, setLocalView } = useLocalView();

  // The phone layout (spec 09 P6, C3.4): below 600 px the marks Stage shows the
  // Answer_List instead of the recall scales, and from `figures` on the marks
  // card is not rendered at all. From 600 px up, from `figures` on, the marks
  // card collapses into a closed "Your testimony" disclosure.
  const detectedPhone = usePhone();
  const isPhone = phone ?? detectedPhone;

  // The Figures_API is read once per reveal (figures-api.ts). Stage 3 picks each
  // Now_Figure from this response, not from DEMO_FIGURES.
  const figures = useFigures();

  // "See the receipts" starts the figures fade-up. The fade runs in FiguresFadeUp.
  const onSeeNumbers = useCallback(() => {
    setLocalView({ figures: "running" });
    onAdvance();
  }, [setLocalView, onAdvance]);

  // "Show everything" settles the figures in the same render, with no fade.
  const onShowEverything = useCallback(() => {
    setLocalView({ figures: "settled" });
    onShowAll();
  }, [setLocalView, onShowAll]);

  // The persona page's sound toggle sits in the marks column (design.md "Sound
  // toggle placement"). CeremonyRoot renders its own toggle only in `region`
  // mode, which the live pages use. So the persona marks hold their own sound
  // state and pass it to the Seal_Break; live pages keep the inherited state.
  // The sound state comes from above: on the persona page the Top_Bar toggle
  // (SceneShell, through CeremonyRoot), on live pages CeremonyRoot's own toggle.
  // spec 09 C4.4: the persona marks column no longer holds a toggle.
  const soundOn = useContext(SoundEnabledContext);

  // Report the seal-break's in-progress flag up to the local view so the
  // Ceremony Stage reads `seal` while holding and settles back to `marks`.
  const onSealingChange = useCallback(
    (sealing: boolean) => {
      setLocalView({ sealing });
    },
    [setLocalView],
  );

  // The figures fade-up is timed by the number of sealed figures only, never by
  // their values (R14.7, R14.8).
  const figureCount = opened.payload.figures.length;

  // The marks stage shows each number answer as a recorded scale (R6): the Mark
  // at the recorded value, and nothing a judge can drag or press. A question with
  // no stored number shows no Mark. The unit comes from the sealed metric; the
  // answer comes from the stored record.
  const unitByMetricId = new Map<string, string>();
  const nameByMetricId = new Map<string, string>();
  for (const metric of opened.payload.metrics) {
    unitByMetricId.set(metric.id, metric.unit);
    nameByMetricId.set(metric.id, metric.display_name);
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
    const metricName =
      question.answer_type === "number"
        ? nameByMetricId.get(question.metric_id)
        : undefined;
    const name = metricName ?? unit;
    const answer = answerByQuestionId.get(question.id);
    const recordedValue =
      answer !== undefined && answer.kind === "number" ? answer.value : null;
    return [
      <RecordedScale
        key={question.id}
        id={question.id}
        name={name}
        label={question.text}
        unitLabel={unit}
        value={recordedValue}
      />,
    ];
  });

  // The Answer_List (spec 09 A9, P6.4) shows the same number questions as the
  // recall scales, with the metric name, the Answer_Text and the unit, or "No
  // answer". It replaces the scales on the phone.
  const answerItems: AnswerListItem[] = opened.payload.recall_questions.flatMap(
    (question) => {
      if (question.answer_type !== "number") return [];
      const unit = unitByMetricId.get(question.metric_id);
      if (unit === undefined) return [];
      const answer = answerByQuestionId.get(question.id);
      const markValue =
        answer !== undefined && answer.kind === "number" ? answer.value : undefined;
      return [
        {
          name: nameByMetricId.get(question.metric_id) ?? unit,
          markValue,
          unit: displayUnitFor(unit),
        },
      ];
    },
  );

  // Each sealed question with the judge's value in the Accent fill, or "No
  // answer". The unit comes from the sealed metric, never re-fetched (R8.2).
  const marksRows = opened.payload.recall_questions.map((question) => {
    const answer = answerByQuestionId.get(question.id);
    const unit =
      question.answer_type === "number"
        ? unitByMetricId.get(question.metric_id)
        : undefined;
    const unitText =
      unit === undefined
        ? undefined
        : REVEAL_COPY.unitLabel.replace("{unit}", displayUnitFor(unit));
    const hasNumber = answer !== undefined && answer.kind === "number";
    return (
      <div key={question.id} className={styles.marksRow}>
        <dt className={styles.marksQuestion}>
          {question.text}
          {unitText === undefined ? null : (
            <span className={styles.unit}> {unitText}</span>
          )}
        </dt>
        <dd className={styles.marksAnswer}>
          {hasNumber ? (
            <span className={styles.marksValue}>{answerText(answer.value)}</span>
          ) : (
            REVEAL_COPY.noAnswer
          )}
        </dd>
      </div>
    );
  });

  // Stage 2 still shows its own next control; "Show everything" sits beside it.
  const stage2HasHidden = stage === 2;

  // Show everything jumps from stage 1 straight to stage 3 (R12.8). The seal
  // stays on the split seal in that case, and the letter mounts still. Both are
  // read from the stage change itself, so a Skip or ADVANCE break still hides
  // the seal and unfolds the letter.
  const [lastStage, setLastStage] = useState(stage);
  const [jumpedToEnd, setJumpedToEnd] = useState(false);
  if (stage !== lastStage) {
    setLastStage(stage);
    setJumpedToEnd(stage === 3 && lastStage === 1);
  }
  const showSeal = stage === 1 || jumpedToEnd;

  // From `figures` on, the marks card is closed on the desk-side disclosure at
  // 600 px and wider, and not rendered on the phone (C3.4, P6.4).
  const testimonyCollapsed = stage >= 3 && !isPhone;
  const marksGone = stage >= 3 && isPhone;

  // The marks card's content: the phone shows the Answer_List; the wider layout
  // shows the marks rows and the recorded scales.
  const marksBody = isPhone ? (
    <AnswerList items={answerItems} />
  ) : (
    <>
      <dl className={styles.marksAnswers} data-fit="marks-answers">
        {marksRows}
      </dl>
      {recordedScales}
    </>
  );

  return (
    <section className={styles.reveal}>
      {marksGone ? null : (
        <div className={`${styles.stage} ${styles.fade}`}>
          <StagePanel>
            <SoundEnabledContext.Provider value={soundOn}>
              {testimonyCollapsed ? (
                <details
                  className={styles.testimony}
                  data-card="marks"
                  data-testimony=""
                >
                  <summary>{REVEAL_COPY.stage1Title}</summary>
                  {marksBody}
                </details>
              ) : (
                <div className={styles.marks} data-card="marks">
                  {isPhone ? <AnswerList items={answerItems} /> : null}
                  {showSeal ? (
                    <div className={styles.marksBreak} data-fit="break">
                      <SealBreak
                        patternKey={
                          variant === "live"
                            ? (letterId ?? personaName)
                            : personaName
                        }
                        seal={seal ?? INERT_SEAL}
                        showAll={stage === 1}
                        onSealingChange={onSealingChange}
                      />
                    </div>
                  ) : null}
                </div>
              )}
            </SoundEnabledContext.Provider>
          </StagePanel>
        </div>
      )}

      {stage >= 2 ? (
        <div className={styles.letterFigures}>
          <div
            className={`${styles.stage} ${styles.fade} ${styles.letterCol}`}
            data-letter-stage=""
          >
            <LetterBlock
              opened={opened}
              personaName={personaName}
              variant={variant}
              letterId={letterId}
              still={jumpedToEnd}
              collapsible={stage >= 3 && isPhone}
            />
            {/* The opening Fingerprint sits under the Letter_Block, on the desk
                surface, before "See the receipts" (design.md, R14.3). It shows
                the verified envelope hash from `Opened.envelopeHash`; the
                letter kind decides the demo label or the card sentence (R14.8).
                A failed check never reaches the Reveal, so this is always the
                passed state (R14.6). */}
            <Fingerprint
              envelopeHash={opened.envelopeHash}
              letterKind={letterKind}
            />
          </div>

          {stage >= 3 ? (
            <div
              className={`${styles.stage} ${styles.fade} ${styles.figuresCol}`}
              data-figures-panel=""
            >
              <FiguresFadeUp count={figureCount}>
                <FiguresThenNow
                  opened={opened}
                  record={record}
                  allowSamePeriod={variant === "live"}
                  letterKind={letterKind}
                  figures={figures}
                />
              </FiguresFadeUp>
            </div>
          ) : null}
        </div>
      ) : null}

      {/* Close (R12.9) shows once the figures have settled. FiguresFadeUp
          reports `settled` when its clock ends or Skip ends it, so Close never
          appears while the figures are still fading in. */}
      {stage >= 3 && localView.figures === "settled" && close !== undefined ? (
        <div className={`${styles.stage} ${styles.fade}`}>
          <Close {...close} />
        </div>
      ) : null}

      {stage2HasHidden ? (
        <div className={styles.stageControls}>
          <button
            type="button"
            className={styles.button}
            data-advance="figures"
            data-primary-control=""
            onClick={onSeeNumbers}
          >
            {REVEAL_COPY.stage2Next}
          </button>
          <button
            type="button"
            className={styles.button}
            onClick={onShowEverything}
          >
            {REVEAL_COPY.showAll}
          </button>
        </div>
      ) : null}
    </section>
  );
}
