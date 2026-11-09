"use client";

import { useId } from "react";

import { SELF_REPORTED_MAX } from "./constants";
import { LIVE_COPY } from "./copy";
import {
  SELF_REPORTED_FIELDS,
  selfReportedFieldKey,
  selfReportedRowProblems,
  visibleSelfReportedProblems,
} from "./form";
import styles from "./live.module.css";
import type { TouchedState } from "./touched";
import type { SelfReportedField, SelfReportedRow } from "./write-draft";

export interface SelfReportedRowsProps {
  /** The rows as typed, 0 to SELF_REPORTED_MAX of them, in order. */
  rows: readonly SelfReportedRow[];
  /** The sealing day, YYYY-MM-DD. A period may not be later than it. */
  sealingDay: string;
  /** Which fields the judge has touched, and whether they tried to seal. */
  touched: TouchedState;
  /** Records that the judge changed or left `field` of row `index`. */
  onTouch: (field: string) => void;
  /** Adds an empty row. Only offered while fewer than the maximum exist. */
  onAdd: () => void;
  /** The judge typed in one field of row `index`. The text is kept as typed. */
  onChange: (index: number, field: SelfReportedField, text: string) => void;
  /** Removes row `index`. */
  onRemove: (index: number) => void;
}

/** The label for each field, in the order the form shows them. */
const FIELD_LABEL: Record<SelfReportedField, string> = {
  name: LIVE_COPY.selfReportedNameLabel,
  value: LIVE_COPY.selfReportedValueLabel,
  unit: LIVE_COPY.selfReportedUnitLabel,
  region: LIVE_COPY.selfReportedRegionLabel,
  period: LIVE_COPY.selfReportedPeriodLabel,
};

/** The message for a field problem key from form.ts, taken from LIVE_COPY. */
const PROBLEM_TEXT: Record<string, string> = {
  selfReportedTextLength: LIVE_COPY.selfReportedTextLength,
  selfReportedValue: LIVE_COPY.selfReportedValue,
  selfReportedPeriod: LIVE_COPY.selfReportedPeriod,
};

/** Replaces `{n}` in a copy string with a number. */
const withNumber = (template: string, n: number): string =>
  template.replace("{n}", String(n));

/**
 * The "Your own numbers" group on the Write step (spec 08 later-tasks, R26.1).
 * Each row has five labelled text fields: name, value, unit, region and period.
 * Every field keeps exactly what the judge typed. A message shows under a field
 * only once that field was touched or a seal was attempted (touched.ts).
 *
 * Every input carries data-user-content, so the row is marked as the judge's
 * own text. Nothing here reads or compares the values beyond the rules.
 */
export function SelfReportedRows({
  rows,
  sealingDay,
  touched,
  onTouch,
  onAdd,
  onChange,
  onRemove,
}: SelfReportedRowsProps) {
  const baseId = useId();
  const canAdd = rows.length < SELF_REPORTED_MAX;

  return (
    <fieldset className={styles.field}>
      <legend className={styles.legend}>{LIVE_COPY.selfReportedTitle}</legend>
      <p className={styles.hint}>{LIVE_COPY.selfReportedHint}</p>

      {rows.map((row, index) => {
        const n = index + 1;
        const shown = visibleSelfReportedProblems(
          selfReportedRowProblems(row, sealingDay),
          touched,
          index,
        );
        return (
          <div key={index} className={styles.selfRow}>
            <div className={styles.questionHead}>
              <p className={styles.label}>
                {withNumber(LIVE_COPY.selfReportedRowLabel, n)}
              </p>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => onRemove(index)}
              >
                {withNumber(LIVE_COPY.selfReportedRemove, n)}
              </button>
            </div>
            <div className={styles.selfFields}>
              {SELF_REPORTED_FIELDS.map((field) => {
                const inputId = `${baseId}-${index}-${field}`;
                const problemId = `${inputId}-problem`;
                const problem = shown[field];
                const message =
                  problem === undefined ? "" : PROBLEM_TEXT[problem];
                return (
                  <div key={field} className={styles.selfField}>
                    <label htmlFor={inputId} className={styles.label}>
                      {FIELD_LABEL[field]}
                    </label>
                    <input
                      id={inputId}
                      type="text"
                      className={styles.textarea}
                      data-user-content=""
                      value={row[field]}
                      aria-describedby={message ? problemId : undefined}
                      aria-invalid={message ? true : undefined}
                      onChange={(event) => {
                        const key = selfReportedFieldKey(index, field);
                        onTouch(key);
                        onChange(index, field, event.target.value);
                      }}
                      onBlur={() =>
                        onTouch(selfReportedFieldKey(index, field))
                      }
                    />
                    <p id={problemId} className={styles.problem}>
                      {message}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {canAdd ? (
        <div className={styles.actions}>
          <button type="button" className={styles.secondary} onClick={onAdd}>
            {LIVE_COPY.selfReportedAdd}
          </button>
        </div>
      ) : (
        <p className={styles.hint}>{LIVE_COPY.selfReportedLimit}</p>
      )}
    </fieldset>
  );
}
