"use client";

import { useEffect, useState } from "react";

import { DemoLabel } from "@/components/demo/DemoLabel";

import type { PickableSeries } from "./catalogue-list";
import { MAX_FIGURES } from "./constants";
import { LIVE_COPY } from "./copy";
import { FigurePicker } from "./FigurePicker";
import { countCodePoints, validateWrite, type WriteProblem } from "./form";
import styles from "./live.module.css";
import type { SealState } from "./seal-machine";
import { StepStatus } from "./StepStatus";

/** The letter text and chosen figures the form holds, lifted to the page. */
export interface WriteDraft {
  text: string;
  metricIds: string[];
}

export interface WriteFormProps {
  /** The figures the visitor can pick from. */
  series: readonly PickableSeries[];
  /** The current sealing state, from useSealFlow in the page. */
  state: SealState;
  /** True once useCryptoModule() has loaded the crypto module (R15.3). */
  cryptoLoaded: boolean;
  /** The Create_Press: starts the first passkey prompt. */
  onCreatePress: () => void;
  /** The Confirm_Press: starts the second prompt and the seal. */
  onConfirmPress: () => void;
  /** Reports the current letter text and chosen figures to the page. */
  onDraftChange: (draft: WriteDraft) => void;
}

/** The message shown for each write problem that the form renders. */
export const PROBLEM_COPY: Partial<Record<WriteProblem, string>> = {
  letter_empty: LIVE_COPY.letterEmpty,
  letter_too_long: LIVE_COPY.letterTooLong,
  figures_none: LIVE_COPY.figuresNone,
  warning_unticked: LIVE_COPY.warningUnticked,
};

/**
 * The write step of the live Seal_Page. Holds the form state (letter text,
 * chosen figures, warning checkbox) as React state and reports the draft up to
 * the page. Nothing here reaches the network: typing and picking only update
 * local state (R12.7); the two presses are the page's flow handlers.
 *
 * The create button is disabled until the crypto module has loaded (R15.3) and
 * until the write input is valid. In the `write` state it is labelled "Create
 * your passkey"; once the passkey is created it becomes "Confirm your passkey"
 * (R15.10). The step line below it is a `role="status"` region (StepStatus).
 */
export function WriteForm({
  series,
  state,
  cryptoLoaded,
  onCreatePress,
  onConfirmPress,
  onDraftChange,
}: WriteFormProps) {
  const [text, setText] = useState("");
  const [metricIds, setMetricIds] = useState<string[]>([]);
  const [warningTicked, setWarningTicked] = useState(false);

  // Report the draft to the page, so Confirm_Press reads the text on screen.
  useEffect(() => {
    onDraftChange({ text, metricIds });
  }, [text, metricIds, onDraftChange]);

  const letterCount = countCodePoints(text);
  const problems = validateWrite({ text, metricIds, warningTicked });
  const atLimit = metricIds.length >= MAX_FIGURES;

  /** The message for a problem, or "" when validateWrite does not report it. */
  function problemText(problem: WriteProblem): string {
    return problems.includes(problem) ? (PROBLEM_COPY[problem] ?? "") : "";
  }
  const letterProblem =
    problemText("letter_empty") || problemText("letter_too_long");

  function toggleFigure(metricId: string): void {
    setMetricIds((current) => {
      if (current.includes(metricId)) {
        return current.filter((id) => id !== metricId);
      }
      if (current.length >= MAX_FIGURES) return current;
      return [...current, metricId];
    });
  }

  // In `created` the button confirms the passkey; everywhere else it creates
  // one. Create is blocked while the write input is invalid; Confirm is not,
  // because the input was already valid when the passkey was created.
  const inCreated = state.tag === "created";
  const buttonLabel = inCreated
    ? LIVE_COPY.confirmButton
    : LIVE_COPY.createButton;
  const buttonDisabled = inCreated
    ? !cryptoLoaded
    : !cryptoLoaded || problems.length > 0;
  const onButtonPress = inCreated ? onConfirmPress : onCreatePress;

  return (
    <form
      className={styles.panel}
      aria-labelledby="live-seal-heading"
      onSubmit={(event) => event.preventDefault()}
    >
      <DemoLabel />
      <h1 id="live-seal-heading" className={styles.heading}>
        {LIVE_COPY.heading}
      </h1>
      <p className={styles.intro}>{LIVE_COPY.intro}</p>

      <div className={styles.field}>
        <label htmlFor="live-letter" className={styles.label}>
          {LIVE_COPY.letterLabel}
        </label>
        <p className={styles.hint}>{LIVE_COPY.letterHint}</p>
        <textarea
          id="live-letter"
          className={styles.textarea}
          rows={10}
          value={text}
          aria-describedby="live-letter-count live-letter-problem"
          onChange={(event) => setText(event.target.value)}
        />
        <p id="live-letter-count" className={styles.count}>
          {LIVE_COPY.letterCount.replace("{count}", String(letterCount))}
        </p>
        <p id="live-letter-problem" className={styles.problem}>
          {letterProblem}
        </p>
      </div>

      <FigurePicker
        series={series}
        selected={metricIds}
        atLimit={atLimit}
        onToggle={toggleFigure}
      />
      <p id="live-figures-problem" className={styles.problem}>
        {problemText("figures_none")}
      </p>

      <div className={styles.explain}>
        <p>{LIVE_COPY.passkeySteps}</p>
        <p>{LIVE_COPY.crossDevice}</p>
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
            onChange={(event) => setWarningTicked(event.target.checked)}
          />
          <span>{LIVE_COPY.warningLabel}</span>
        </label>
        <p id="live-warning-problem" className={styles.problem}>
          {problemText("warning_unticked")}
        </p>
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primary}
          disabled={buttonDisabled}
          onClick={onButtonPress}
        >
          {buttonLabel}
        </button>
        <StepStatus state={state} />
      </div>
    </form>
  );
}
