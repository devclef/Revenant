"use client";

import { useCallback, useContext, useEffect, useState } from "react";
import type { Opened, TestimonyEntry } from "./opening-machine";
import { AnswerList, type AnswerListItem } from "./AnswerList";
import { PHONE_QUERY } from "@/components/ceremony/scene/TopBar";
import type { LetterKind } from "./FigureLine";
import type { RecallRecordV1, RecallRecordV2 } from "@/lib/recall";
import { SoundEnabledContext } from "@/components/ceremony/sound/SoundEnabledContext";
import { FiguresThenNow, SelfReportedOnly } from "./FiguresThenNow";
import { useFigures, type FiguresState } from "./figures-api";
import type { FiguresResponseV1 } from "@/lib/figures";
import { QuestionPair } from "./QuestionPair";
import { LetterPaper } from "./LetterPaper";
import { FigureReceipt } from "./FigureReceipt";
import { SealLine } from "./SealLine";
import { EndCard } from "./EndCard";
import { sealedAnswerOf, sealedLabelOf, testimonyTextOf } from "./receipts";
import { formatCalendarDate, formatLetterDate, browserTimeZone } from "@/components/ui/letter-date";
import { TamperControl } from "./tamper/TamperControl";
import type { TamperSource } from "./tamper/tamper-run";
import { Close, type CloseProps } from "@/components/ceremony/close/Close";
import { SealBreak } from "@/components/ceremony/seal/SealBreak";
import { sealPlacement } from "@/components/ceremony/seal/seal-placement";
import type { SealController } from "@/components/ceremony/seal/useSealBreak";
import { IDLE } from "@/components/ceremony/seal/hold";
import { RecordedScale } from "@/components/ceremony/recall/RecordedScale";
import { answerText } from "@/components/ceremony/recall/answer-text";
import { displayUnitFor } from "@/components/ceremony/recall/unit-ranges";
import { useLocalView } from "@/components/ceremony/local-view";
import { REVEAL_COPY } from "./copy";
import { useViewportWidth } from "./viewport-width";
import styles from "./reveal.module.css";
import receiptsStyles from "./receipts.module.css";
import buttons from "@/components/ui/buttons.module.css";

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
 * shows as whole and its controls do nothing. OpeningFlow always passes the real
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
  /**
   * The stored recall record: what the judge remembered. Null on the
   * Text_Persona walk, which stores no record (spec 11 P1.5); its testimony
   * comes from `testimony` instead.
   */
  record: RecallRecordV1 | RecallRecordV2 | null;
  /**
   * The Text_Persona's testimony, one entry per question in order, shown with
   * the Fictional_Label (spec 11 P1.7). Present only on that walk.
   */
  testimony?: readonly TestimonyEntry[];
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
   * seal shows as whole and its controls do nothing.
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
   * The persona's "now" figures, built on the server (spec 15 R4.4). When set,
   * the reveal reads these instead of GET /api/figures. Absent for a Live_Letter
   * or Real_Letter, which keep the request.
   */
  personaNow?: FiguresResponseV1;
  /**
   * Forces the phone layout (true below 600 px) instead of reading the
   * viewport. Tests pass it, because static renders have no viewport. Omitted
   * in the app, where the viewport decides.
   */
  phone?: boolean;
  /**
   * The held Envelope's slot in the Ghost (spec 09 C5.1). OpeningFlow passes
   * it once the Envelope is mounted. At the Desktop_Sizes and the Wide_Size the
   * stage 1 seal is drawn on it, so the Content_Column keeps only the button and
   * the Skip_Link. Omitted or null, the seal stays in the Content_Column.
   */
  heldSlot?: HTMLElement | null;
  /**
   * The marks layer, a sibling of the Ghost layer (spec 10 C6.3). With
   * `heldSlot`, the stage 1 Seal_Group's controls are drawn here, outside the
   * aria-hidden Ghost. Omitted or null, the Seal_Group stays where it was.
   */
  marksSlot?: HTMLElement | null;
  /**
   * The Tamper_Control's source (spec 13, A2.7). OpeningFlow passes
   * `flow.tamperSource`. Used only for a persona letter's Read step; a live or
   * real letter never renders the control. Omitted, no control is rendered.
   */
  tamperSource?: () => TamperSource | null;
};

/**
 * The reveal body, given the figures state. `figures` is null when the letter
 * has no official figures: nothing is fetched and no "The receipts" stage is
 * drawn. A letter whose only figures are self-reported still has its figures
 * stage, which shows just "Your own numbers" (spec L5.1).
 */
type RevealBodyProps = RevealProps & { figures: FiguresState | null };

/**
 * Picks the reveal body. The Figures_API is read only when the letter has
 * sealed official figures (spec 10 C8.6, spec L5.1): a letter with none, or
 * with only self-reported figures, never calls `useFigures()`. Official figure
 * count is fixed by the sealed payload, so the choice never changes within one
 * reveal.
 */
export function Reveal(props: RevealProps) {
  const hasOfficialFigures = props.opened.payload.figures.some(
    (figure) => figure.kind !== "self-reported",
  );
  if (!hasOfficialFigures) {
    return <RevealBody {...props} figures={null} />;
  }
  if (props.personaNow !== undefined) {
    // The persona's now figures come from the server: no request is made.
    const figures: FiguresState = { status: "ready", figures: props.personaNow };
    return <RevealBody {...props} figures={figures} />;
  }
  return <RevealWithFigures {...props} />;
}

function RevealWithFigures(props: RevealProps) {
  // The Figures_API is read once per reveal (figures-api.ts). Stage 3 picks each
  // Now_Figure from this response, not from DEMO_FIGURES.
  const figures = useFigures();
  return <RevealBody {...props} figures={figures} />;
}

function RevealBody({
  opened,
  record,
  testimony,
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
  heldSlot = null,
  marksSlot = null,
  figures,
  tamperSource,
}: RevealBodyProps) {
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

  // Where the stage 1 seal is drawn (spec 09 C5.1, C5.2). At the Desktop_Sizes
  // and the Wide_Size it goes on the held Envelope; otherwise it stays here.
  const viewportWidth = useViewportWidth();
  const sealOnEnvelope = sealPlacement({ viewportWidth, slotReady: heldSlot !== null });
  const envelopeSlot = sealOnEnvelope === "envelope" && !isPhone ? heldSlot : null;

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
    (record?.answers ?? []).map((answer) => [answer.question_id, answer] as const),
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

  // The Answer_List (spec 09 A9, P6.4; spec 10 C6.10) shows the recall answers,
  // Author_Questions first (text), then the number questions with the metric
  // name, the Answer_Text and the unit, or "No answer". Text items come from the
  // sealed `text` questions in payload order (C9.3: the receipts lead with them).
  // Text items come from the sealed `text` questions in payload order (C9.3:
  // the receipts lead with them). On the Text_Persona walk they come from her
  // testimony instead, each labelled with the Fictional_Label (spec 11 P1.7).
  const textItems: AnswerListItem[] =
    testimony !== undefined
      ? testimony.map((entry) => ({
          kind: "text" as const,
          question: entry.question,
          answer: entry.answer,
          label: REVEAL_COPY.personaAnswerLabel,
        }))
      : opened.payload.recall_questions.flatMap((question) => {
          if (question.answer_type !== "text") return [];
          const answer = answerByQuestionId.get(question.id);
          return [
            {
              kind: "text" as const,
              question: question.text,
              answer:
                answer !== undefined && answer.kind === "text" ? answer.value : null,
            },
          ];
        });
  const numberItems: AnswerListItem[] = opened.payload.recall_questions.flatMap(
    (question) => {
      if (question.answer_type !== "number") return [];
      const unit = unitByMetricId.get(question.metric_id);
      if (unit === undefined) return [];
      const answer = answerByQuestionId.get(question.id);
      const markValue =
        answer !== undefined && answer.kind === "number" ? answer.value : undefined;
      return [
        {
          kind: "number" as const,
          name: nameByMetricId.get(question.metric_id) ?? unit,
          markValue,
          unit: displayUnitFor(unit),
          sample: false,
        },
      ];
    },
  );
  const answerItems: AnswerListItem[] = [...textItems, ...numberItems];

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
  // With no figures, stage 2 is the last view: no next control is offered.
  const stage2HasHidden = stage === 2 && figureCount > 0;

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

  // The marks column (the testimony list and the seal break) belongs to stage 1.
  // From the letter stage on, the receipts column replaces it (spec 15 R12.2).
  // The marks stay only on the show-everything path, where the seal stays split.
  const showMarks = stage === 1 || jumpedToEnd;

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

  // Once the Close shows, the figures no longer hold the Stage's primary
  // control: the Close is the last Stage and its own view sets the first viewport.
  // A letter with no figures has no figures stage, so its Close shows at stage 2.
  const closeShown =
    (figureCount === 0
      ? stage >= 2
      : stage >= 3 && localView.figures === "settled") && close !== undefined;

  const marksBlock = (
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
                {/* Stage 1 sits on the dark with no paper panel (spec 10 C6.7):
                    the "Your testimony" heading, then the Answer_List at every
                    Evidence_Size (C6.10), then the Seal_Group. */}
                <h2 className={styles.marksHeading}>
                  {testimony !== undefined
                    ? REVEAL_COPY.personaTestimonyTitle
                    : REVEAL_COPY.stage1Title}
                </h2>
                <AnswerList items={answerItems} />
                {showSeal ? (
                  <div className={styles.marksBreak} data-fit="break">
                    <SealBreak
                      patternKey={
                        variant === "live"
                          ? (letterId ?? personaName)
                          : personaName
                      }
                      envelopeHash={opened.envelopeHash}
                      seal={seal ?? INERT_SEAL}
                      showAll={stage === 1}
                      hasFigures={figureCount > 0}
                      onSealingChange={onSealingChange}
                      envelopeSlot={envelopeSlot}
                      marksSlot={marksSlot}
                    />
                  </div>
                ) : null}
              </div>
            )}
          </SoundEnabledContext.Provider>
  );

  // The receipts column (spec 15 R12.2): one scrolling column. Each author
  // question as written, then the reader's testimony beside the sealed answer
  // (no comment on the difference), then the letter, then the figures, the seal
  // line and the end card. Every string comes from copy.ts.
  const isPersona = letterKind === "persona";
  const sealedDate = formatLetterDate(opened.header.sealedAt, {
    kind: "iana",
    timeZone: browserTimeZone(),
  });
  // A persona's answers are dated "as of" the letter's written date. A live
  // letter's answers are dated by the sealing day, in the reader's time zone.
  const wroteDate = isPersona
    ? opened.payload.written_as_of === undefined
      ? ""
      : formatCalendarDate(opened.payload.written_as_of)
    : sealedDate;

  const textQuestions = opened.payload.recall_questions.filter(
    (question) => question.answer_type === "text",
  );
  // The pairs need the stored record, or the persona walk's testimony.
  const showQuestions =
    textQuestions.length > 0 && (testimony !== undefined || record !== null);
  const questionPairs = textQuestions.map((question, index) => (
    <QuestionPair
      key={question.id}
      question={question.text}
      questionLabel={
        isPersona
          ? REVEAL_COPY.receiptsAsWrittenPersona
          : REVEAL_COPY.receiptsAsWritten
      }
      testimony={
        testimony !== undefined
          ? (testimony[index]?.answer ?? REVEAL_COPY.noAnswer)
          : testimonyTextOf(record, question.id)
      }
      testimonyLabel={
        isPersona
          ? REVEAL_COPY.receiptsRememberedPersona
          : REVEAL_COPY.receiptsRemembered
      }
      sealedAnswer={sealedAnswerOf(question)}
      sealedLabel={sealedLabelOf(isPersona, wroteDate)}
      noSealedAnswer={REVEAL_COPY.noSealedAnswer}
      userContent={!isPersona}
    />
  ));
  const questionsTitle = isPersona
    ? REVEAL_COPY.receiptsQuestionsTitlePersona
    : REVEAL_COPY.receiptsQuestionsTitle;

  // The seal line and the end card close the column: after the figures with
  // figures (stage 3), or after the letter with none (stage 2).
  const sealEndShown = figureCount === 0 ? stage >= 2 : stage >= 3;

  // At stage 3 with figures, the letter folds after them (spec 15 R12.2): the
  // figures come straight after the question pairs, and the letter sits in a
  // closed disclosure after the figures. Without figures, or before stage 3,
  // the letter keeps its place after the question pairs.
  const foldLetter = stage === 3 && figureCount > 0;
  const letterStage = (
    <div
      className={`${styles.stage} ${styles.fade} ${styles.letterCol}`}
      data-letter-stage=""
    >
      {/* The letter in full, as it was sealed. The fingerprint moved to
          the seal line after the figures (R12.6). A folded letter mounts
          still: its disclosure is closed, so nothing unfolds under it. */}
      <LetterPaper
        opened={opened}
        personaName={personaName}
        variant={variant}
        letterId={letterId}
        still={jumpedToEnd || foldLetter}
        collapsible={foldLetter}
        letterKind={letterKind}
      />
    </div>
  );

  return (
    <section className={styles.reveal}>
      {showMarks && !marksGone ? (
        <div className={`${styles.stage} ${styles.fade}`}>
          {/* Stage 1 renders no paper panel (spec 10 C6.7): the testimony
              heading, the Answer_List and the Seal_Group sit on the dark in the
              .marksOnDesk tokens. */}
          <div className={styles.marksOnDesk}>{marksBlock}</div>
        </div>
      ) : null}

      {stage >= 2 ? (
        <div className={receiptsStyles.receipts} data-receipts="">
          {showQuestions ? (
            <section
              className={receiptsStyles.questions}
              data-author-testimony=""
            >
              <h2
                tabIndex={-1}
                className={receiptsStyles.questionsHeading}
                data-author-testimony-heading=""
              >
                {questionsTitle}
              </h2>
              {questionPairs}
            </section>
          ) : null}

          {foldLetter ? null : letterStage}

          {stage >= 3 && figures !== null && record !== null ? (
            <FigureReceipt count={figureCount}>
              <FiguresThenNow
                opened={opened}
                record={record}
                allowSamePeriod={variant === "live"}
                letterKind={letterKind}
                figures={figures}
                primaryCard={!closeShown}
              />
            </FigureReceipt>
          ) : null}
          {stage >= 3 && figures === null && figureCount > 0 ? (
            <FigureReceipt count={figureCount}>
              <SelfReportedOnly payload={opened.payload} />
            </FigureReceipt>
          ) : null}

          {foldLetter ? letterStage : null}

          {sealEndShown ? (
            <div className={`${styles.stage} ${styles.fade}`}>
              <SealLine
                envelopeHash={opened.envelopeHash}
                letterKind={letterKind}
                tamper={
                  isPersona && tamperSource !== undefined ? (
                    <TamperControl getSource={tamperSource} />
                  ) : undefined
                }
              />
              {/* Close (R12.9) shows once the figures have settled. FiguresFadeUp
                  reports `settled` when its clock ends or Skip ends it, so Close
                  never appears while the figures are still fading in. */}
              <EndCard>
                {closeShown ? (
                  <Close
                    {...close}
                    {...(close?.kind === "persona"
                      ? { hasFigures: figureCount > 0 }
                      : {})}
                    {...(close?.kind === "live"
                      ? {
                          hasFigures: opened.payload.figures.some(
                            (figure) => figure.kind !== "self-reported",
                          ),
                        }
                      : {})}
                  />
                ) : null}
              </EndCard>
            </div>
          ) : null}
        </div>
      ) : null}

      {stage2HasHidden ? (
        <div className={styles.stageControls}>
          <button
            type="button"
            className={buttons.primary}
            data-advance="figures"
            data-primary-control=""
            onClick={onSeeNumbers}
          >
            {REVEAL_COPY.stage2Next}
          </button>
          <button
            type="button"
            className={styles.outlineButton}
            onClick={onShowEverything}
          >
            {REVEAL_COPY.showAll}
          </button>
        </div>
      ) : null}
    </section>
  );
}
