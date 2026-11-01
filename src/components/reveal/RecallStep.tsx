"use client";

import type { FormEvent } from "react";
import { ParchmentSurface } from "@/components/ui";
import type { Draft } from "@/lib/recall";
import type { Opened } from "./opening-machine";
import { REVEAL_COPY } from "./copy";
import styles from "./reveal.module.css";

/**
 * The recall step (R8, product.md "Recall first"). Shown for the `recall`
 * state, after the verification statement and BEFORE anything from inside the
 * letter is revealed. The judge answers, from memory, what each tracked figure
 * cost "then"; their answers are encrypted and stored before the reveal. This
 * view never shows a sealed figure, a period, a source or any hint of which way
 * a figure moved (neutrality.md).
 *
 * The form is a `<form noValidate>` so the browser's own validation never fires;
 * validation and the inline errors are driven entirely by the reducer's
 * `invalid` list (R8.4), which the effect runner fills from `buildRecallRecord`.
 * Each question is one `<fieldset>`:
 * - the `<legend>` is the sealed question text, verbatim (R2.9);
 * - a text input with `inputMode="decimal"` for the remembered number;
 * - the figure's unit shown beside the input (R8.2);
 * - a "No answer" checkbox (R8.3); when it is checked the number input is
 *   disabled, matching `buildRecallRecord`, which ignores the text for a
 *   "no answer" question;
 * - an inline error under the fieldset when the question is in `invalid`,
 *   wired with `aria-describedby`/`aria-invalid` so it is announced.
 *
 * The submit control is disabled while a record is being posted — the view is
 * rendered for both `submitting` and `submit_failed`, and `submitting` is true
 * in the first and false in the second, so a retry stays possible (R8.9, R8.7).
 *
 * Every string comes from copy.ts (R15.1). This component holds no state, reads
 * no clock, logs nothing and touches no storage: it renders the drafts it is
 * given and calls back on every edit, toggle and submit. All state lives in the
 * reducer.
 */

export type RecallStepProps = {
  /** The opened letter; its payload holds the sealed questions and metrics. */
  opened: Opened;
  /** The judge's in-progress answers, keyed by question ID. */
  drafts: Readonly<Record<string, Draft>>;
  /** The question IDs that failed validation on the last submit (R8.4). */
  invalid: readonly string[];
  /**
   * True while the encrypted record is being posted (the `submitting` state),
   * false in `submit_failed`. Disables the submit control (R8.9).
   */
  submitting: boolean;
  /** Dispatches `EDIT_DRAFT` as the judge types a number. */
  onEdit: (id: string, text: string) => void;
  /** Dispatches `TOGGLE_NO_ANSWER` as the judge toggles the checkbox. */
  onToggleNoAnswer: (id: string, noAnswer: boolean) => void;
  /** Dispatches a submit attempt. The reducer/effect runner validate. */
  onSubmit: () => void;
};

/** The empty draft used for a question the judge has not touched yet. */
const EMPTY_DRAFT: Draft = { text: "", noAnswer: false };

export function RecallStep({
  opened,
  drafts,
  invalid,
  submitting,
  onEdit,
  onToggleNoAnswer,
  onSubmit,
}: RecallStepProps) {
  const { payload } = opened;

  // Resolve each metric's unit once, so a number question can show the unit of
  // the figure it asks about (R8.2). The unit comes from the sealed metric
  // definition, never re-fetched.
  const unitByMetricId = new Map<string, string>();
  for (const metric of payload.metrics) {
    unitByMetricId.set(metric.id, metric.unit);
  }

  const invalidSet = new Set(invalid);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <ParchmentSurface as="section" className={styles.recall}>
      <h1>{REVEAL_COPY.recallTitle}</h1>
      <p className={styles.recallHint}>{REVEAL_COPY.recallHint}</p>

      <form noValidate onSubmit={handleSubmit}>
        {payload.recall_questions.map((question) => {
          const draft = drafts[question.id] ?? EMPTY_DRAFT;
          const isInvalid = invalidSet.has(question.id);
          const inputId = `recall-${question.id}`;
          const errorId = `recall-${question.id}-error`;
          const unit =
            question.answer_type === "number"
              ? unitByMetricId.get(question.metric_id)
              : undefined;
          const unitText =
            unit === undefined
              ? undefined
              : REVEAL_COPY.unitLabel.replace("{unit}", unit);

          return (
            <fieldset key={question.id} className={styles.fieldset}>
              <legend className={styles.legend}>{question.text}</legend>

              <div className={styles.inputRow}>
                <input
                  id={inputId}
                  className={styles.input}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={draft.text}
                  disabled={draft.noAnswer}
                  aria-invalid={isInvalid}
                  aria-describedby={isInvalid ? errorId : undefined}
                  onChange={(event) => onEdit(question.id, event.target.value)}
                />
                {unitText === undefined ? null : (
                  <span className={styles.unit}>{unitText}</span>
                )}
              </div>

              <label className={styles.noAnswer}>
                <input
                  type="checkbox"
                  checked={draft.noAnswer}
                  onChange={(event) =>
                    onToggleNoAnswer(question.id, event.target.checked)
                  }
                />
                {REVEAL_COPY.noAnswer}
              </label>

              {isInvalid ? (
                <span id={errorId} role="alert" className={styles.fieldError}>
                  {REVEAL_COPY.answerInvalid}
                </span>
              ) : null}
            </fieldset>
          );
        })}

        <button
          type="submit"
          className={styles.button}
          disabled={submitting}
        >
          {submitting ? REVEAL_COPY.submitting : REVEAL_COPY.submit}
        </button>
      </form>
    </ParchmentSurface>
  );
}
