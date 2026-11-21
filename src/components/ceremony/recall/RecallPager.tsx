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
import { NavRow } from "./NavRow";
import { RecallScale } from "./RecallScale";
import { TextAnswerField } from "./TextAnswerField";
import { WaxDisc } from "@/components/live/desk/WaxDisc";
import { formatWrittenOn } from "./written-on";
import { CEREMONY_COPY } from "../copy";
import {
  canAdvance,
  canAdvanceText,
  draftTextFor,
  initialField,
  pickReading,
  resolvedValue,
  setFromScale,
  typeText,
  type FieldState,
} from "./recall-field";
import { formatCalendarDate } from "@/components/ui/letter-date";
import { useKeepInVisualViewport } from "@/components/ui/use-keep-in-visual-viewport";
import { useCalmInForce } from "../motion";
import { REVEAL_COPY } from "@/components/reveal/copy";
import type { Draft } from "@/lib/recall";
import type { OpenedPayload } from "@/components/reveal/opened-payload";
import {
  firstInvalidIndex,
  isLastIndex,
  nextIndex,
  previousIndex,
  submitAction,
} from "./recall-pager";
import { displayUnitFor, rescaleNoteFor, scaleRangeFor } from "./unit-ranges";
import styles from "./RecallPager.module.css";

export type RecallPagerProps = {
  /** The sealed payload. Only its questions and metric units are read. */
  payload: Pick<OpenedPayload, "metrics" | "recall_questions">;
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
  /**
   * The sealing instant (ISO, UTC) and the zone to name its calendar day in, for a
   * live or real letter. Shows "you wrote this on {date}" in the counter. Ignored
   * when `writtenAsOf` is set, because a persona keeps its "as of" counter.
   */
  writtenOn?: { sealedAt: string; timeZone: string };
  /** Dispatches `EDIT_DRAFT` as the judge types, or moves the Recall_Scale Mark. */
  onEdit: (id: string, text: string) => void;
  /** Dispatches `TOGGLE_NO_ANSWER` for one question (R11.7). */
  onToggleNoAnswer: (id: string, noAnswer: boolean) => void;
  /** Dispatches a submit attempt on the last question. The reducer validates. */
  onSubmit: () => void;
  /** The index shown first. Clamped to the payload. Used by tests. */
  initialIndex?: number;
  /**
   * Each number question's Sample_Answer, by question ID (spec 10 C5.5). A
   * persona letter passes them; a Live_Letter passes none. While a field's draft
   * still equals its sample, the Sample_Note shows under the field.
   */
  samples?: Readonly<Record<string, string>>;
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
  writtenOn,
  onEdit,
  onToggleNoAnswer,
  onSubmit,
  initialIndex = 0,
  samples = {},
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
  // The text question whose submit was refused for its text (C4.6). The invalid
  // message shows on it until the judge pages away.
  const [rejectedId, setRejectedId] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  // The field group (the field and its Next or submit control). It stays inside
  // the visual viewport when the on-screen keyboard opens (spec 09 P9).
  const answerRef = useRef<HTMLDivElement>(null);
  useKeepInVisualViewport(answerRef, useCalmInForce());
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
    const field = answerRef.current?.querySelector<
      HTMLInputElement | HTMLTextAreaElement
    >("[data-stage-focus]");
    if (field && !field.disabled) {
      field.focus();
      return;
    }
    formRef.current
      ?.querySelector<HTMLInputElement>('input[type="checkbox"]')
      ?.focus();
  }, [focusRequest, index]);

  const question = questions[index];
  if (question === undefined) return null;

  function goTo(next: number) {
    setIndex(next);
    setRejectedId(null);
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
    // A text answer that is empty or too long is refused here, so the judge
    // sees the message and the question does not advance (C4.6).
    const current = drafts[question.id] ?? EMPTY_DRAFT;
    if (
      question.answer_type === "text" &&
      !submitting &&
      !canAdvanceText(current.text, current.noAnswer)
    ) {
      setRejectedId(question.id);
      return;
    }
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
  const textRejected =
    question.answer_type === "text" &&
    rejectedId === question.id &&
    !canAdvanceText(draft.text, draft.noAnswer);
  const showInvalid = isInvalid || textRejected;
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
  const sealedUnit =
    question.answer_type === "number"
      ? unitByMetricId.get(question.metric_id)
      : undefined;
  // The judge answers in the displayed unit (C8): per litre for a per-1,000-litre
  // figure. The stored answer is the typed value, so nothing is converted.
  const unit = sealedUnit === undefined ? undefined : displayUnitFor(sealedUnit);
  const unitText =
    unit === undefined ? undefined : fill(REVEAL_COPY.unitLabel, { unit });

  const headingId = `recall-${question.id}-title`;
  const inputId = `recall-${question.id}`;
  const unitId = `recall-${question.id}-unit`;
  const helpId = `recall-${question.id}-unit-help`;
  const readingsId = `recall-${question.id}-readings`;
  const unreadableId = `recall-${question.id}-unreadable`;
  const errorId = `recall-${question.id}-error`;
  const noAnswerId = `recall-${question.id}-no-answer`;
  const sampleNoteId = `recall-${question.id}-sample-note`;
  // The Sample_Note shows only while the field still holds its Sample_Answer
  // (C5.5). Any other text, or "No answer", hides it.
  const sampleAnswer = isNumber ? samples[question.id] : undefined;
  const showSampleNote =
    sampleAnswer !== undefined &&
    !draft.noAnswer &&
    draft.text === sampleAnswer;
  const rescaleNote =
    sealedUnit === undefined ? null : rescaleNoteFor(sealedUnit);

  const counterBase = fill(REVEAL_COPY.questionCounter, {
    n: index + 1,
    total,
  });
  // Spec 15, 11.4. An author question (text) shows the plain counter. A figure
  // question adds its date: "as of {date}" on a persona, "sealed on {date}" on
  // a live or real letter. The date is the sealing day (spec 14, T1.2), empty
  // when the sealing instant does not parse, and then the counter stays plain.
  const isFigure = question.answer_type === "number";
  const asOfText =
    !isFigure || writtenAsOf === undefined
      ? undefined
      : fill(REVEAL_COPY.questionCounterAsOf, {
          date: formatCalendarDate(writtenAsOf),
        });
  const writtenOnDay =
    writtenAsOf !== undefined || writtenOn === undefined
      ? ""
      : formatWrittenOn(writtenOn.sealedAt, writtenOn.timeZone);
  const writtenOnText =
    !isFigure || writtenOnDay === ""
      ? undefined
      : fill(REVEAL_COPY.questionCounterSealedOn, { date: writtenOnDay });
  // The attribute marks a live or real letter's counter, with or without the
  // date on it, so the layout check can find it on every question.
  const liveCounter = writtenAsOf === undefined && writtenOnDay !== "";

  // The intro sits on the first question only (R11.15). A persona letter names
  // its written-as-of date; a Live_Letter gets the hint alone.
  const intro = !isFirst
    ? null
    : writtenAsOf === undefined
      ? REVEAL_COPY.recallHint
      : fill(REVEAL_COPY.recallIntro, {
          date: formatCalendarDate(writtenAsOf),
        });

  // The line above an author question (spec 15, 11.1). It names the date the
  // letter was sealed, or the persona's written-as-of date. It is only for text
  // questions: a figure question carries no "you asked yourself" line.
  const askedLine =
    question.answer_type !== "text"
      ? undefined
      : writtenAsOf !== undefined
        ? fill(REVEAL_COPY.askedAsOf, {
            date: formatCalendarDate(writtenAsOf),
          })
        : writtenOnDay === ""
          ? undefined
          : fill(REVEAL_COPY.askedOn, { date: writtenOnDay });

  const submitLabel = submitting ? REVEAL_COPY.submitting : REVEAL_COPY.submit;

  const describedBy = [
    unitText === undefined ? null : unitId,
    rescaleNote === null ? null : helpId,
    reading === null ? null : readingsId,
    unreadable ? unreadableId : null,
    showSampleNote ? sampleNoteId : null,
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
      <p
        className={styles.counter}
        data-fit="counter"
        data-recall-counter={liveCounter ? "" : undefined}
      >
        {asOfText === undefined && writtenOnText === undefined ? (
          counterBase
        ) : (
          <>
            {counterBase}
            {REVEAL_COPY.questionCounterSeparator}
            <span className={styles.nowrap}>{asOfText ?? writtenOnText}</span>
          </>
        )}
      </p>

      <form
        noValidate
        onSubmit={handleSubmit}
        className={styles.form}
        ref={formRef}
      >
        {askedLine === undefined ? null : (
          <p className={styles.asked} data-asked-line="">
            {askedLine}
          </p>
        )}
        <div className={styles.qRow}>
          <WaxDisc n={index + 1} />
          <h2
            id={headingId}
            className={`${styles.qTitle} ${styles.qText}`}
            data-fit="question"
            data-stage-heading=""
          >
            <span data-user-content="">{question.text}</span>
          </h2>
        </div>

        <fieldset className={styles.fieldset} aria-labelledby={headingId}>
          <div className={styles.body}>
            {intro === null ? null : <p className={styles.intro}>{intro}</p>}

            {unitText === undefined ? null : (
              <span className={styles.unit} id={unitId}>
                {unitText}
              </span>
            )}

            {rescaleNote === null ? null : (
              <p id={helpId} className={styles.unitHelp}>
                {rescaleNote}
              </p>
            )}

            {isNumber ? (
              <div
                ref={answerRef}
                className={styles.answerRow}
                data-fit="answer"
                data-primary-control=""
              >
                <input
                  id={inputId}
                  className={styles.input}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={field === null ? draft.text : field.typed}
                  disabled={draft.noAnswer}
                  data-stage-focus=""
                  aria-invalid={isInvalid || unreadable}
                  aria-labelledby={headingId}
                  aria-describedby={
                    describedBy === "" ? undefined : describedBy
                  }
                  onChange={(event) =>
                    field === null
                      ? onEdit(question.id, event.target.value)
                      : applyField(
                          question.id,
                          typeText(field, event.target.value),
                        )
                  }
                />
              </div>
            ) : (
              <div
                ref={answerRef}
                className={styles.textGroup}
                data-fit="answer"
                data-primary-control=""
              >
                <TextAnswerField
                  id={inputId}
                  headingId={headingId}
                  noAnswerId={noAnswerId}
                  value={draft.text}
                  noAnswer={draft.noAnswer}
                  invalid={showInvalid}
                  countLabel={(count) => fill(REVEAL_COPY.textCount, { count })}
                  invalidText={REVEAL_COPY.textAnswerInvalid}
                  onChange={(text) => onEdit(question.id, text)}
                  onToggleNoAnswer={(noAnswer) =>
                    onToggleNoAnswer(question.id, noAnswer)
                  }
                />
                <NavRow
                  showPrevious={!isFirst}
                  onPrevious={() => goTo(previousIndex(index))}
                  mainLabel={isLast ? submitLabel : REVEAL_COPY.nextQuestion}
                  mainDisabled={submitting}
                  onMain={() => formRef.current?.requestSubmit()}
                />
              </div>
            )}

            {reading === null || readingLabels === null ? null : (
              <fieldset id={readingsId} className={styles.readings} data-fit="readings">
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

            {isNumber && isInvalid ? (
              <span id={errorId} role="alert" className={styles.fieldError}>
                {REVEAL_COPY.answerInvalid}
              </span>
            ) : null}

            {isNumber && showSampleNote ? (
              <p
                id={sampleNoteId}
                className={styles.sampleNote}
                data-sample-note=""
              >
                {REVEAL_COPY.sampleNote}
              </p>
            ) : null}

            {isNumber && unit !== undefined ? (
              <RecallScale
                id={question.id}
                label={question.text}
                unitLabel={unit}
                range={scaleRangeFor(unit)}
                value={markValue}
                text={resolved ?? undefined}
                valueHidden={resolved === null}
                noAnswer={draft.noAnswer}
                onEdit={(id, text) =>
                  applyField(id, setFromScale(fieldFor(id), text))
                }
                spokenPrefix={REVEAL_COPY.yourAnswer}
              />
            ) : null}

            {isNumber ? (
              <label className={styles.noAnswer} htmlFor={noAnswerId}>
                <input
                  id={noAnswerId}
                  type="checkbox"
                  checked={draft.noAnswer}
                  onChange={(event) =>
                    onToggleNoAnswer(question.id, event.target.checked)
                  }
                />
                {REVEAL_COPY.noAnswer}
              </label>
            ) : null}

            {isNumber ? (
              <NavRow
                showPrevious={!isFirst}
                onPrevious={() => goTo(previousIndex(index))}
                mainLabel={isLast ? submitLabel : REVEAL_COPY.nextQuestion}
                mainDisabled={submitting || !ready}
                onMain={() => formRef.current?.requestSubmit()}
              />
            ) : null}

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
