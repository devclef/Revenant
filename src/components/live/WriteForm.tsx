"use client";

import { useLayoutEffect, useRef } from "react";

import { DemoLabel } from "@/components/demo/DemoLabel";

import type { PickableSeries } from "./catalogue-list";
import { AuthorQuestions } from "./AuthorQuestions";
import { questionRowProblem } from "./author-questions";
import { LETTER_FIELD_ROWS } from "./constants";
import { LIVE_COPY, REAL_COPY } from "./copy";
import { FigurePicker, type FigureDetail } from "./FigurePicker";
import {
  countCodePoints,
  figureLimit,
  validateWrite,
  type WriteMode,
  type WriteProblem,
} from "./form";
import styles from "./live.module.css";
import { letterFieldHeightPx } from "./phone";
import { PromptStarters } from "./PromptStarters";
import { type PrfHint } from "./prf-hint";
import { RealDatePicker } from "./RealDatePicker";
import { INITIAL_TOUCHED, showsFieldMessage, type TouchedState } from "./touched";
import type { SealState } from "./seal-machine";
import { StepStatus } from "./StepStatus";

/**
 * Which part of the write flow a WriteForm renders (spec 09, D2). `all` is the
 * whole form, as on the page before the Live_Stepper. The other three render
 * one step each inside the stepper, with that step's Next or Back control.
 */
export type WriteSection = "all" | "write" | "figures" | "seal";

export interface WriteFormProps {
  /** The figures the visitor can pick from. */
  series: readonly PickableSeries[];
  /**
   * The state of the figures request (issue #202). Only `ready` shows the
   * picker and allows sealing. Defaults to `ready` so callers with a list
   * already in hand need not pass it.
   */
  figuresStatus?: "loading" | "ready" | "failed";
  /** The current sealing state, from useSealFlow in the page. */
  state: SealState;
  /** True once useCryptoModule() has loaded the crypto module (R15.3). */
  cryptoLoaded: boolean;
  /** The letter text, held by the page (controlled). */
  text: string;
  /** The chosen figure IDs, held by the page (controlled). */
  metricIds: string[];
  /** The PRF_Hint from usePrfHint in the page. `missing` shows a note; it blocks nothing. */
  prfHint?: PrfHint;
  /** Whether the warning box is ticked, held by the page (controlled). */
  warningTicked: boolean;
  /** Whether the backup key card box is ticked, held by the page (controlled). */
  backupCardTicked: boolean;
  /**
   * Which fields the judge has changed or left, and whether they tried to seal
   * (spec 09, A4.4). A validation message shows only when its field is touched
   * or the seal was attempted. Held by the page. Defaults to nothing touched,
   * so no message shows on first load.
   */
  touched?: TouchedState;
  /** Records that the judge changed or left `field` (see touched.ts). */
  onTouch?: (field: string) => void;
  /** Records that the judge pressed the create or confirm button while it could not act. */
  onAttempt?: () => void;
  /** The visitor typed in the letter. */
  onTextChange: (text: string) => void;
  /**
   * The Author_Question rows, in order (spec 10, C2). Held by the page. Defaults
   * to no rows, so callers without questions need not pass it.
   */
  questions?: readonly string[];
  /** The visitor typed in question row `index`. */
  onQuestionChange?: (index: number, text: string) => void;
  /** The visitor added an empty question row. */
  onQuestionAdd?: () => void;
  /** The visitor removed question row `index`. */
  onQuestionRemove?: (index: number) => void;
  /** The visitor pressed a Question_Starter. */
  onQuestionStarter?: (text: string) => void;
  /** The visitor picked or unpicked a figure. */
  onToggleFigure: (metricId: string) => void;
  /** The visitor ticked or unticked the warning box. */
  onWarningChange: (ticked: boolean) => void;
  /** The visitor ticked or unticked the backup key card box. */
  onBackupCardChange: (ticked: boolean) => void;
  /**
   * Which part to render. Defaults to `all`, the whole form. The stepper passes
   * `write`, `figures` or `seal` (spec 09, D2).
   */
  section?: WriteSection;
  /** Section mode: moves to the next step once this step is valid. */
  onNext?: () => void;
  /** Section mode: moves back one step. Omit where Back is not offered. */
  onBack?: () => void;
  /**
   * Value and source per metric id, from the figures response. Passed to the
   * picker, which shows nothing extra for a figure with no entry.
   */
  figureDetails?: ReadonlyMap<string, FigureDetail>;
  /**
   * Starts the backup-key path. Shown as the first option, beside the passkey
   * press, only when prfHint is `missing`. Omit it and no backup option shows.
   */
  onBackupStart?: () => void;
  /** The Create_Press: starts the first passkey prompt. */
  onCreatePress: () => void;
  /** The Confirm_Press: starts the second prompt and the seal. */
  onConfirmPress: () => void;
  /**
   * Real_Letter mode only (`/seal`). The opening date picker and the test
   * notice. Absent in demo mode, which shows neither.
   */
  realDate?: {
    value: string | null;
    min: string;
    timeZoneFallback: boolean;
    onChange: (date: string | null) => void;
  };
}

/** Field names used with `touched` and `onTouch`. */
export const TOUCH_FIELDS = {
  letter: "letter",
  questions: "questions",
  figures: "figures",
  warning: "warning",
  date: "date",
} as const;

/** The message shown for each write problem that the form renders. */
export const PROBLEM_COPY: Partial<Record<WriteProblem, string>> = {
  letter_empty: LIVE_COPY.letterEmpty,
  letter_too_long: LIVE_COPY.letterTooLong,
  figures_none: LIVE_COPY.figuresNone,
  warning_unticked: LIVE_COPY.warningUnticked,
};

/**
 * Whether the create/confirm button may be pressed in this state. `write` needs
 * valid input; `created` needs nothing more; every other state is mid-flow or
 * terminal, so the button stays disabled.
 */
export function buttonLive(
  state: SealState,
  problems: readonly WriteProblem[],
): boolean {
  if (state.tag === "created") return true;
  if (state.tag === "write") return problems.length === 0;
  return false;
}

/**
 * The write step of the live Seal_Page. Holds the form state (letter text,
 * chosen figures, warning checkbox) as React state and reports the draft up to
 * the page. Nothing here reaches the network: typing and picking only update
 * local state (R12.7); the two presses are the page's flow handlers.
 *
 * The create button is disabled until the crypto module has loaded (R15.3) and
 * until the write input is valid. In the `write` state it is labelled "Press
 * the seal with your passkey"; once the passkey is created it becomes "Confirm
 * your passkey" (R15.10). The step line below it is a `role="status"` region
 * (StepStatus).
 *
 * In section mode (spec 09, D2) only the fields of that step render, with the
 * step's Next and Back. The stepper supplies the heading, so the form drops
 * its own heading and the Demo label.
 */
export function WriteForm({
  series,
  figuresStatus = "ready",
  state,
  cryptoLoaded,
  text,
  metricIds,
  prfHint = "none",
  figureDetails,
  onBackupStart,
  warningTicked,
  backupCardTicked,
  touched = INITIAL_TOUCHED,
  onTouch = () => {},
  onAttempt = () => {},
  onTextChange,
  onToggleFigure,
  onWarningChange,
  onBackupCardChange,
  section = "all",
  onNext,
  onBack,
  onCreatePress,
  onConfirmPress,
  realDate,
  questions = [],
  onQuestionChange = () => {},
  onQuestionAdd = () => {},
  onQuestionRemove = () => {},
  onQuestionStarter = () => {},
}: WriteFormProps) {
  const letterCount = countCodePoints(text);
  const letterRef = useRef<HTMLTextAreaElement>(null);
  const limit = figureLimit(series.length);
  // A real letter (`/seal`) is the one that carries the date picker (spec 08).
  const mode: WriteMode = realDate === undefined ? "demo" : "real";
  const problems = validateWrite({
    text,
    metricIds,
    warningTicked,
    backupCardTicked,
    maxFigures: limit,
    questions,
    mode,
  });
  const atLimit = metricIds.length >= limit;
  const all = section === "all";
  /** True when this part of the form renders in the current section. */
  const shows = (part: WriteSection) => all || section === part;

  // Grow the letter field with its text, up to half the visual viewport (P9).
  // Past the cap the field scrolls inside itself.
  useLayoutEffect(() => {
    const field = letterRef.current;
    if (field === null) return;
    field.style.height = "auto";
    const viewportHeight =
      window.visualViewport?.height ?? window.innerHeight;
    field.style.height = `${letterFieldHeightPx(field.scrollHeight, viewportHeight)}px`;
  }, [text, section]);

  /** The message for a problem, or "" when validateWrite does not report it. */
  function problemText(problem: WriteProblem): string {
    return problems.includes(problem) ? (PROBLEM_COPY[problem] ?? "") : "";
  }
  /** A field's message shows only once the judge has touched it or tried to seal. */
  function shownFor(field: string, text: string): string {
    return showsFieldMessage(touched, field) ? text : "";
  }
  const letterProblem = shownFor(
    TOUCH_FIELDS.letter,
    problemText("letter_empty") || problemText("letter_too_long"),
  );
  const figuresProblem = shownFor(
    TOUCH_FIELDS.figures,
    problemText("figures_none"),
  );
  const warningProblem = shownFor(
    TOUCH_FIELDS.warning,
    problemText("warning_unticked"),
  );
  // A row over 200 code points names its own message, and only once the rows
  // were touched or a seal was attempted. The text stays as typed (C2.3).
  const tooLongIndices = showsFieldMessage(touched, TOUCH_FIELDS.questions)
    ? questions.flatMap((row, index) =>
        questionRowProblem(row) !== null ? [index] : [],
      )
    : [];
  const questionsValid = !problems.includes("question_too_long");
  const dateMissing =
    realDate !== undefined && realDate.value === null && state.tag === "write";
  const dateProblem = shownFor(
    TOUCH_FIELDS.date,
    dateMissing ? REAL_COPY.dateMissing : "",
  );

  // In `created` the button confirms the passkey; everywhere else it creates
  // one. The button is only live in `write` (Create, blocked while the input is
  // invalid) and `created` (Confirm, not blocked by the input, which was valid
  // when the passkey was created). In every other state it is disabled.
  const inCreated = state.tag === "created";
  const buttonLabel = inCreated
    ? LIVE_COPY.confirmButton
    : LIVE_COPY.createButton;
  // Hard blocks (crypto not loaded, figures not ready, mid-flow state) use the
  // disabled attribute. Input problems use aria-disabled, so a press still
  // registers as an attempt and the messages then show (spec 09, A4.4).
  const formReady =
    cryptoLoaded &&
    figuresStatus === "ready" &&
    (state.tag === "write" || inCreated);
  const inputBlocked =
    formReady && !inCreated && (!buttonLive(state, problems) || dateMissing);
  const onButtonPress = inCreated ? onConfirmPress : onCreatePress;
  function handleButtonPress() {
    if (inputBlocked) {
      onAttempt();
      return;
    }
    onButtonPress();
  }

  // Section mode: Next checks only this step's own input. A failed check shows
  // the step's messages and moves nothing.
  const letterValid = !problems.some(
    (problem) => problem === "letter_empty" || problem === "letter_too_long",
  );
  const figuresValid =
    figuresStatus === "ready" && !problems.includes("figures_none");
  function pressNext(valid: boolean, field: string) {
    if (!valid) {
      onTouch(field);
      onAttempt();
      return;
    }
    onNext?.();
  }

  const pressButton = (
    <button
      type="button"
      className={styles.primary}
      disabled={!formReady}
      aria-disabled={inputBlocked ? true : undefined}
      onClick={handleButtonPress}
    >
      {buttonLabel}
    </button>
  );

  // The backup option comes first, beside the passkey press (D6.1). It only
  // starts the backup path. Whether a backup key is required is still decided
  // by the PRF_Check when the letter is sealed (R15.9).
  const backupButton =
    prfHint === "missing" && onBackupStart !== undefined ? (
      <button
        type="button"
        className={styles.secondary}
        onClick={onBackupStart}
      >
        {LIVE_COPY.fallbackButton}
      </button>
    ) : null;

  const body = (
    <>
      {all && realDate === undefined ? <DemoLabel /> : null}
      {all ? (
        <h1 id="live-seal-heading" className={styles.heading}>
          {LIVE_COPY.heading}
        </h1>
      ) : null}
      {shows("write") ? (
        <p className={styles.intro}>
          {realDate === undefined ? LIVE_COPY.intro : REAL_COPY.intro}
        </p>
      ) : null}

      {shows("write") ? (
        <div className={styles.field}>
          <label htmlFor="live-letter" className={styles.label}>
            {LIVE_COPY.letterLabel}
          </label>
          <p className={styles.hint}>{LIVE_COPY.letterHint}</p>
          <textarea
            id="live-letter"
            ref={letterRef}
            className={styles.textarea}
            rows={LETTER_FIELD_ROWS}
            value={text}
            aria-describedby="live-letter-count live-letter-problem"
            onChange={(event) => {
              onTouch(TOUCH_FIELDS.letter);
              onTextChange(event.target.value);
            }}
            onBlur={() => onTouch(TOUCH_FIELDS.letter)}
          />
          <PromptStarters
            fieldRef={letterRef}
            onInsert={(next) => {
              onTouch(TOUCH_FIELDS.letter);
              onTextChange(next);
            }}
          />
          <p id="live-letter-count" className={styles.count}>
            {LIVE_COPY.letterCount.replace("{count}", String(letterCount))}
          </p>
          <p id="live-letter-problem" className={styles.problem}>
            {letterProblem}
          </p>
        </div>
      ) : null}

      {shows("write") ? (
        <AuthorQuestions
          questions={questions}
          tooLongIndices={tooLongIndices}
          onAdd={() => {
            onTouch(TOUCH_FIELDS.questions);
            onQuestionAdd();
          }}
          onChange={(index, next) => {
            onTouch(TOUCH_FIELDS.questions);
            onQuestionChange(index, next);
          }}
          onRemove={(index) => {
            onTouch(TOUCH_FIELDS.questions);
            onQuestionRemove(index);
          }}
          onStarter={(next) => {
            onTouch(TOUCH_FIELDS.questions);
            onQuestionStarter(next);
          }}
        />
      ) : null}

      {all && realDate !== undefined ? (
        <>
          <p className={styles.explain}>{REAL_COPY.testNotice}</p>
          <RealDatePicker
            value={realDate.value}
            min={realDate.min}
            timeZoneFallback={realDate.timeZoneFallback}
            problem={dateProblem}
            onChange={(date) => {
              onTouch(TOUCH_FIELDS.date);
              realDate.onChange(date);
            }}
            onTouch={() => onTouch(TOUCH_FIELDS.date)}
          />
        </>
      ) : null}

      {shows("figures") ? (
        <>
          {figuresStatus === "ready" ? (
            <FigurePicker
              series={series}
              selected={metricIds}
              atLimit={atLimit}
              details={figureDetails}
              mode={mode}
              onToggle={(metricId) => {
                onTouch(TOUCH_FIELDS.figures);
                onToggleFigure(metricId);
              }}
            />
          ) : (
            <p className={styles.hint} role="status">
              {figuresStatus === "failed"
                ? LIVE_COPY.figuresLoadFailed
                : LIVE_COPY.figuresLoading}
            </p>
          )}
          <p id="live-figures-problem" className={styles.problem}>
            {figuresProblem}
          </p>
        </>
      ) : null}

      {shows("seal") && prfHint === "missing" ? (
        <p className={styles.hint} role="status">
          {LIVE_COPY.prfHint}
        </p>
      ) : null}

      {shows("seal") ? (
        <div className={styles.sealStep}>
        <div className={styles.explain}>
          <p>{LIVE_COPY.passkeySteps}</p>
          <details className={styles.more}>
            <summary className={styles.moreSummary}>
              {LIVE_COPY.crossDeviceSummary}
            </summary>
            <p>{LIVE_COPY.crossDevice}</p>
          </details>
        </div>

        <div className={styles.warning}>
          <p>{LIVE_COPY.warning}</p>
          <label className={styles.warningLabel}>
            <input
              id="live-warning"
              type="checkbox"
              className={styles.checkbox}
              checked={warningTicked}
              aria-describedby="live-warning-problem"
              onChange={(event) => {
                onTouch(TOUCH_FIELDS.warning);
                onWarningChange(event.target.checked);
              }}
            />
            <span>{LIVE_COPY.warningLabel}</span>
          </label>
          <p id="live-warning-problem" className={styles.problem}>
            {warningProblem}
          </p>
        </div>

        <div className={styles.warning}>
          <label className={styles.warningLabel}>
            <input
              id="live-backup-card"
              type="checkbox"
              className={styles.checkbox}
              checked={backupCardTicked}
              aria-describedby="live-backup-card-hint"
              onChange={(event) => {
                onTouch(TOUCH_FIELDS.warning);
                onBackupCardChange(event.target.checked);
              }}
            />
            <span>{LIVE_COPY.backupCardOption}</span>
          </label>
          <p id="live-backup-card-hint" className={styles.hint}>
            {LIVE_COPY.backupCardOptionHint}
          </p>
        </div>
        </div>
      ) : null}

      {all ? (
        <div className={styles.actions}>
          {backupButton}
          {pressButton}
          <StepStatus state={state} />
        </div>
      ) : null}

      {section === "write" ? (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            onClick={() =>
              pressNext(
                letterValid && questionsValid,
                letterValid ? TOUCH_FIELDS.questions : TOUCH_FIELDS.letter,
              )
            }
          >
            {LIVE_COPY.nextButton}
          </button>
        </div>
      ) : null}

      {section === "figures" ? (
        <div className={styles.actions}>
          {onBack ? (
            <button type="button" className={styles.secondary} onClick={onBack}>
              {LIVE_COPY.backButton}
            </button>
          ) : null}
          <button
            type="button"
            className={styles.primary}
            onClick={() => pressNext(figuresValid, TOUCH_FIELDS.figures)}
          >
            {LIVE_COPY.nextButton}
          </button>
        </div>
      ) : null}

      {section === "seal" ? (
        <div className={styles.actions}>
          {onBack ? (
            <button type="button" className={styles.secondary} onClick={onBack}>
              {LIVE_COPY.backButton}
            </button>
          ) : null}
          {backupButton}
          {pressButton}
          <StepStatus state={state} />
        </div>
      ) : null}
    </>
  );

  if (all) {
    return (
      <form
        data-card="live-write"
        className={styles.panel}
        aria-labelledby="live-seal-heading"
        onSubmit={(event) => event.preventDefault()}
      >
        {body}
      </form>
    );
  }
  return (
    <div data-card={`live-step-${section}`} className={styles.panel}>
      {body}
    </div>
  );
}
