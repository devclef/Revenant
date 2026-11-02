"use client";

import { useState } from "react";

import { DemoLabel } from "@/components/demo/DemoLabel";

import type { PickableSeries } from "./catalogue-list";
import { MAX_FIGURES } from "./constants";
import { LIVE_COPY } from "./copy";
import { FigurePicker } from "./FigurePicker";
import { countCodePoints, validateWrite, type WriteProblem } from "./form";
import styles from "./live.module.css";

export interface WriteFormProps {
  /** The figures the visitor can pick from. */
  series: readonly PickableSeries[];
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
 * chosen figures, warning checkbox) as React state. Nothing here reaches the
 * network: typing and picking only update local state (R12.7).
 *
 * In this step the "Create your passkey" button is disabled and shows the
 * not-yet status line. The next step enables it.
 */
export function WriteForm({ series }: WriteFormProps) {
  const [text, setText] = useState("");
  const [metricIds, setMetricIds] = useState<string[]>([]);
  const [warningTicked, setWarningTicked] = useState(false);

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
        <button type="submit" className={styles.primary} disabled>
          {LIVE_COPY.createButton}
        </button>
        <p role="status" className={styles.status}>
          {LIVE_COPY.notYet}
        </p>
      </div>
    </form>
  );
}
