"use client";

/**
 * The Recall_Pager (design.md "Recall_Pager", spec 07 R11). It shows one recall
 * question at a time, in payload order, with the question text and its unit.
 * It shows no figure value, period, source or hint (R11.1).
 *
 * The pager's only state is `index`, the view-local position in the payload
 * (R11.8). Paging sends no Flow event. Drafts change only through `onEdit`
 * (typing or the Recall_Scale) and `onToggleNoAnswer` (the "No answer" control).
 * The pager never builds a Recall_Record; the effect runner does that from the
 * final drafts, so the record does not depend on the visit order (R11.9).
 *
 * The pager is one `<form noValidate>`, so the browser's own validation never
 * fires. Enter in the field and the submit control both submit the form, and
 * the form decides with `submitAction`: advance on a question that is not the
 * last, call `onSubmit` on the last, and do nothing while a post is in flight.
 *
 * Every string comes from the copy modules (R24). This component holds no
 * state beyond `index` and the focus request; the reducer owns everything else.
 */

import { useEffect, useRef, useState, type FormEvent } from "react";
import { RecallScale } from "./RecallScale";
import { CEREMONY_COPY } from "../copy";
import { formatParsedValue } from "./parse-number";
import {
  canAdvance,
  draftTextFor,
  initialField,
  pickReading,
  resolvedValue,
  setFromScale,
  typeText,
  type FieldState,
} from "./recall-field";
import { formatCalendarDate } from "@/components/demo/dates";
import { REVEAL_COPY } from "@/components/reveal/copy";
import type { Draft } from "@/lib/recall";
import type { PayloadV1 } from "@/lib/seal-format";
import {
  firstInvalidIndex,
  isLastIndex,
  nextIndex,
  previousIndex,
  submitAction,
} from "./recall-pager";
import { unitHelperFor } from "./unit-ranges";
import styles from "./RecallPager.module.css";

export type RecallPagerProps = {
  /** The sealed payload. Only its questions and metric units are read. */
  payload: Pick<PayloadV1, "metrics" | "recall_questions">;
  /** The judge's in-progress answers, keyed by question ID. */
  drafts: Readonly<Record<string, Draft>>;
  /** The question IDs that failed validation on the last submit (R11.10). */
  invalid: readonly string[];
  /** True while the encrypted record is being posted. Disables submit and Enter (R11.11). */
  submitting: boolean;
  /** True after a failed post. Shows the submit-failed message (R11.12). */
  failed?: boolean;
  /** The persona's written-as-of date (`YYYY-MM-DD`). Absent on a Live_Letter (R11.5). */
  writtenAsOf?: string;
  /** Dispatches `EDIT_DRAFT` as the judge types, or moves the Recall_Scale Mark. */
  onEdit: (id: string, text: string) => void;
  /** Dispatches `TOGGLE_NO_ANSWER` for one question (R11.7). */
  onToggleNoAnswer: (id: string, noAnswer: boolean) => void;
  /** Dispatches a submit attempt on the last question. The reducer validates. */
  onSubmit: () => void;
  /** The index shown first. Clamped to the payload. Used by tests. */
  initialIndex?: number;
};

/** The empty draft used for a question the judge has not touched yet. */
const EMPTY_DRAFT: Draft = { text: "", noAnswer: false };

/** Fill `{name}` placeholders in a copy string. */
function fill(template: string, values: Record<string, string | number>): string {
  let text = template;
  for (const [name, value] of Object.entries(values)) {
    text = text.split(`{${name}}`).join(String(value));
  }
  return text;
}

export function RecallPager({
  payload,
  drafts,
  invalid,
  submitting,
  failed = false,
  writtenAsOf,
  onEdit,
  onToggleNoAnswer,
  onSubmit,
  initialIndex = 0,
}: RecallPagerProps) {
  const questions = payload.recall_questions;
  const total = questions.length;

  const [index, setIndex] = useState(() =>
    total === 0 ? 0 : Math.min(Math.max(initialIndex, 0), total - 1),
  );
  // The number field's state per question (recall-field.ts). Each one starts
  // from the draft the first time the judge reaches it, then keeps what was
  // typed through Previous and Next.
  const [fields, setFields] = useState<Record<string, FieldState>>({});
  // Bumped on every paging action and invalid submit. The focus effect reads it,
  // so a view-local move focuses the shown field without a Flow event.
  const [focusRequest, setFocusRequest] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const checkboxRef = useRef<HTMLInputElement>(null);
  // Set by a submit on the last question. The next change to `invalid` answers
  // it: the pager jumps to the first invalid question in payload order (R11.10).
  const pendingCheck = useRef(false);

  useEffect(() => {
    if (!pendingCheck.current) return;
    pendingCheck.current = false;
    const target = firstInvalidIndex(
      questions.map((question) => question.id),
      invalid,
    );
    if (target < 0) return;
    setIndex(target);
    setFocusRequest((request) => request + 1);
  }, [invalid, questions]);

  useEffect(() => {
    if (focusRequest === 0) return;
    const field = inputRef.current;
    if (field !== null && !field.disabled) {
      field.focus();
      return;
    }
    checkboxRef.current?.focus();
  }, [focusRequest, index]);

  const question = questions[index];
  if (question === undefined) return null;

  function goTo(next: number) {
    setIndex(next);
    setFocusRequest((request) => request + 1);
  }

  function fieldFor(id: string): FieldState {
    const existing = fields[id];
    if (existing !== undefined) return existing;
    return initialField(drafts[id] ?? EMPTY_DRAFT);
  }

  // A number question is ready when its field resolves to a value, or the
  // judge ticked "no answer" (R32.13). Other questions are always ready.
  function isReady(target: (typeof questions)[number]): boolean {
    if (target.answer_type !== "number") return true;
    return canAdvance(fieldFor(target.id), drafts[target.id]?.noAnswer ?? false);
  }

  // Store the field, and send the draft only when its canonical text changed.
  // An ambiguous, unreadable or empty field sends "" (R32.5, R32.7).
  function applyField(id: string, next: FieldState) {
    setFields((previous) => ({ ...previous, [id]: next }));
    const text = draftTextFor(next);
    if (text !== (drafts[id] ?? EMPTY_DRAFT).text) onEdit(id, text);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const action = submitAction(index, total, submitting, isReady(question));
    if (action === "ignore") return;
    if (action === "advance") {
      goTo(nextIndex(index, total));
      return;
    }
    pendingCheck.current = true;
    onSubmit();
  }

  // Resolve each metric's unit, so a number question shows the unit of the
  // figure it asks about (R11.1). The unit comes from the sealed definition.
  const unitByMetricId = new Map<string, string>();
  for (const metric of payload.metrics) {
    unitByMetricId.set(metric.id, metric.unit);
  }

  const draft = drafts[question.id] ?? EMPTY_DRAFT;
  const isInvalid = invalid.includes(question.id);
  const isNumber = question.answer_type === "number";
  const field = isNumber ? fieldFor(question.id) : null;
  const ready = isReady(question);
  const resolved = field === null ? null : resolvedValue(field);
  const reading =
    field !== null && field.parse.kind === "ambiguous" ? field.parse : null;
  const unreadable =
    field !== null &&
    field.parse.kind === "rejected" &&
    field.parse.reason !== "empty";
  // The Mark follows the field's value. An ambiguous field with no pick keeps
  // the Mark where it was (R32.5).
  const markValue =
    field === null || draft.noAnswer || field.mark === null
      ? null
      : Number(field.mark);
  const isLast = isLastIndex(index, total);
  const isFirst = index === 0;
  const unit =
    question.answer_type === "number"
      ? unitByMetricId.get(question.metric_id)
      : undefined;
  const unitText =
    unit === undefined ? undefined : fill(REVEAL_COPY.unitLabel, { unit });

  const headingId = `recall-${question.id}-title`;
  const inputId = `recall-${question.id}`;
  const unitId = `recall-${question.id}-unit`;
  const helpId = `recall-${question.id}-unit-help`;
  const parsedId = `recall-${question.id}-parsed`;
  const readingsId = `recall-${question.id}-readings`;
  const unreadableId = `recall-${question.id}-unreadable`;
  const errorId = `recall-${question.id}-error`;
  const noAnswerId = `recall-${question.id}-no-answer`;
  const unitHelp = unit === undefined ? null : unitHelperFor(unit);

  const counterBase = fill(REVEAL_COPY.questionCounter, {
    n: index + 1,
    total,
  });
  const asOfText =
    writtenAsOf === undefined
      ? undefined
      : fill(REVEAL_COPY.questionCounterAsOf, {
          date: formatCalendarDate(writtenAsOf),
        });

  // The intro sits on the first question only (R11.15). A persona letter names
  // its written-as-of date; a Live_Letter gets the hint alone.
  const intro = !isFirst
    ? null
    : writtenAsOf === undefined
      ? REVEAL_COPY.recallHint
      : fill(REVEAL_COPY.recallIntro, {
          date: formatCalendarDate(writtenAsOf),
        });

  const submitLabel = submitting ? REVEAL_COPY.submitting : REVEAL_COPY.submit;

  const describedBy = [
    unitText === undefined ? null : unitId,
    unitHelp === null ? null : helpId,
    resolved === null ? null : parsedId,
    reading === null ? null : readingsId,
    unreadable ? unreadableId : null,
    isInvalid ? errorId : null,
  ]
    .filter((id): id is string => id !== null)
    .join(" ");

  // The two readings, decimal first. Each label is written in words, with the
  // judge's own digits (R32.4). "000" is left out of the grouping reading.
  const readingLabels =
    reading === null
      ? null
      : {
          decimal: fill(CEREMONY_COPY.readingDecimal, {
            head: reading.head,
            tail: reading.tail,
          }),
          grouping: fill(CEREMONY_COPY.readingGrouping, {
            head: reading.head,
            rest: reading.tail.replace(/^0+/, ""),
          }).replace(/\s+$/, ""),
        };

  return (
    <>
      <p className={styles.counter} data-fit="counter">
        {asOfText === undefined ? (
          counterBase
        ) : (
          <>
            {counterBase}
            {REVEAL_COPY.questionCounterSeparator}
            <span className={styles.nowrap}>{asOfText}</span>
          </>
        )}
      </p>

      <form noValidate onSubmit={handleSubmit} className={styles.form}>
        <h2 id={headingId} className={styles.qTitle} data-fit="question">
          {question.text}
        </h2>

        <fieldset className={styles.fieldset} aria-labelledby={headingId}>
          <div className={styles.body}>
            {intro === null ? null : <p className={styles.intro}>{intro}</p>}

            {unitText === undefined ? null : (
              <span className={styles.unit} id={unitId}>
                {unitText}
              </span>
            )}

            {unitHelp === null ? null : (
              <p id={helpId} className={styles.unitHelp}>
                {unitHelp}
              </p>
            )}

            <div className={styles.answerRow} data-fit="answer">
              <input
                ref={inputRef}
                id={inputId}
                className={styles.input}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={field === null ? draft.text : field.typed}
                disabled={draft.noAnswer}
                data-stage-focus=""
                aria-invalid={isInvalid || unreadable}
                aria-describedby={describedBy === "" ? undefined : describedBy}
                onChange={(event) =>
                  field === null
                    ? onEdit(question.id, event.target.value)
                    : applyField(
                        question.id,
                        typeText(field, event.target.value),
                      )
                }
              />
              <button
                type="submit"
                className={styles.cta}
                data-fit="advance"
                disabled={submitting || !ready}
              >
                {isLast ? submitLabel : REVEAL_COPY.nextQuestion}
              </button>
            </div>

            {resolved === null ? null : (
              <p id={parsedId} className={styles.parsed} aria-live="polite">
                {fill(CEREMONY_COPY.parsedValue, {
                  value: formatParsedValue(resolved),
                })}
              </p>
            )}

            {reading === null || readingLabels === null ? null : (
              <fieldset id={readingsId} className={styles.readings}>
                <legend>{CEREMONY_COPY.readingLegend}</legend>
                <label className={styles.readingOption}>
                  <input
                    type="radio"
                    name={`recall-${question.id}-reading`}
                    value="decimal"
                    checked={field?.pick === "decimal"}
                    onChange={() =>
                      field !== null &&
                      applyField(question.id, pickReading(field, "decimal"))
                    }
                  />
                  {readingLabels.decimal}
                </label>
                <label className={styles.readingOption}>
                  <input
                    type="radio"
                    name={`recall-${question.id}-reading`}
                    value="grouping"
                    checked={field?.pick === "grouping"}
                    onChange={() =>
                      field !== null &&
                      applyField(question.id, pickReading(field, "grouping"))
                    }
                  />
                  {readingLabels.grouping}
                </label>
              </fieldset>
            )}

            {unreadable ? (
              <p id={unreadableId} className={styles.fieldError}>
                {CEREMONY_COPY.numberUnreadable}
              </p>
            ) : null}

            {isInvalid ? (
              <span id={errorId} role="alert" className={styles.fieldError}>
                {REVEAL_COPY.answerInvalid}
              </span>
            ) : null}

            {isFirst ? null : (
              <div className={styles.row}>
                <button
                  type="button"
                  className={styles.link}
                  onClick={() => goTo(previousIndex(index))}
                >
                  {REVEAL_COPY.previousQuestion}
                </button>
              </div>
            )}

            {isNumber && unit !== undefined ? (
              <RecallScale
                id={question.id}
                label={question.text}
                unitLabel={unit}
                value={markValue}
                noAnswer={draft.noAnswer}
                onEdit={(id, text) =>
                  applyField(id, setFromScale(fieldFor(id), text))
                }
                spokenPrefix={REVEAL_COPY.yourAnswer}
              />
            ) : null}

            <label className={styles.noAnswer} htmlFor={noAnswerId}>
              <input
                ref={checkboxRef}
                id={noAnswerId}
                type="checkbox"
                checked={draft.noAnswer}
                onChange={(event) =>
                  onToggleNoAnswer(question.id, event.target.checked)
                }
              />
              {REVEAL_COPY.noAnswer}
            </label>

            {failed ? (
              <p role="alert" className={styles.fieldError}>
                {REVEAL_COPY.submitFailed}
              </p>
            ) : null}
          </div>
        </fieldset>
      </form>
    </>
  );
}
