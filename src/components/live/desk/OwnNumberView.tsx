"use client";

import { useId } from "react";

import { KeepGroup } from "@/components/ui/KeepGroup";

import {
  selfReportedFieldKey,
  selfReportedRowProblems,
  visibleSelfReportedProblems,
} from "../form";
import { LIVE_COPY, SELF_REPORTED_FIELD_NAMES } from "../copy";
import { showsFieldMessage, type TouchedState } from "../touched";
import {
  ownNumberMissing,
  type OwnNumberField,
  type SelfReportedRow,
} from "../write-draft";

import { formatDatedDay } from "./sheet-date";
import { DESK_COPY } from "./copy";
import styles from "./panel.module.css";

export interface OwnNumberViewProps {
  /** The one own number row, as typed. Its period is not shown (W12.3). */
  row: SelfReportedRow;
  /**
   * The sealing day, YYYY-MM-DD. Shown in the "Dated" line and used for the
   * period rule. Empty before the visitor's local day is known, so the line is
   * left blank on the server.
   */
  sealingDay: string;
  /** Which fields the visitor has touched, and whether a seal was attempted. */
  touched: TouchedState;
  /** Records that the visitor changed or left a field (keyed as touched.ts). */
  onTouch: (key: string) => void;
  /** The visitor typed in one field. The text is kept as typed. */
  onChange: (field: OwnNumberField, text: string) => void;
}

/** The four typed fields, used for the blank and touched checks (W12.4). */
const FIELDS: readonly OwnNumberField[] = ["name", "value", "unit", "region"];

/** The label and placeholder of each field, from the desk copy (W12.1). */
const LABEL: Record<OwnNumberField, string> = {
  name: DESK_COPY.ownName,
  value: DESK_COPY.ownAmount,
  unit: DESK_COPY.ownUnit,
  region: DESK_COPY.ownWhere,
};

const PLACEHOLDER: Partial<Record<OwnNumberField, string>> = {
  name: DESK_COPY.ownNamePlaceholder,
  region: DESK_COPY.ownWherePlaceholder,
};

/** The message for a field problem key from form.ts (the same text as the Write step). */
const PROBLEM_TEXT: Record<string, string> = {
  selfReportedTextLength: LIVE_COPY.selfReportedTextLength,
  selfReportedValue: LIVE_COPY.selfReportedValue,
};

/**
 * The Own_Number_View (spec 14, W12): four labelled inputs for one own number,
 * the sealing day, and the self-reported line. There is no add, remove or
 * limit control, and no decorative rule on the fields (W12.5, W12.6). Each
 * change goes to the parent, which dispatches OWN_NUMBER_CHANGED.
 */
export function OwnNumberView({
  row,
  sealingDay,
  touched,
  onTouch,
  onChange,
}: OwnNumberViewProps) {
  const baseId = useId();
  const problems = visibleSelfReportedProblems(
    selfReportedRowProblems(row, sealingDay),
    touched,
    0,
  );
  const missing = ownNumberMissing(row);
  const blank = missing.length === FIELDS.length;
  const anyShown = FIELDS.some((field) =>
    showsFieldMessage(touched, selfReportedFieldKey(0, field)),
  );
  const missingText =
    anyShown && !blank && missing.length > 0
      ? DESK_COPY.ownMissing.replace(
          "{fields}",
          missing.map((field) => SELF_REPORTED_FIELD_NAMES[field]).join(", "),
        )
      : "";

  return (
    <div className={styles.own} data-own-number="">
      {renderField("name")}
      <div className={styles.ownPair}>
        {renderField("value")}
        {renderField("unit")}
      </div>
      {renderField("region")}
      <p className={styles.ownNote}>
        {sealingDay === ""
          ? ""
          : DESK_COPY.dated.replace("{date}", formatDatedDay(sealingDay))}
      </p>
      <p className={styles.ownNote}>{DESK_COPY.ownMarked}</p>
      {missingText !== "" ? (
        <p className={styles.problem}>{missingText}</p>
      ) : null}
    </div>
  );

  function renderField(field: OwnNumberField) {
    const inputId = `${baseId}-${field}`;
    const problemId = `${inputId}-problem`;
    const problemKey = problems[field];
    const message =
      problemKey === undefined || row[field].trim() === ""
        ? ""
        : (PROBLEM_TEXT[problemKey] ?? "");
    return (
      <KeepGroup as="div" key={field} className={styles.ownField}>
        <label htmlFor={inputId} className={styles.ownLabel}>
          {LABEL[field]}
        </label>
        <input
          id={inputId}
          type="text"
          className={styles.ownInput}
          value={row[field]}
          placeholder={PLACEHOLDER[field]}
          aria-invalid={message !== "" ? "true" : undefined}
          aria-describedby={message !== "" ? problemId : undefined}
          onChange={(event) => {
            onTouch(selfReportedFieldKey(0, field));
            onChange(field, event.target.value);
          }}
          onBlur={() => onTouch(selfReportedFieldKey(0, field))}
          data-user-content=""
        />
        {message !== "" ? (
          <p id={problemId} className={styles.problem}>
            {message}
          </p>
        ) : null}
      </KeepGroup>
    );
  }
}
