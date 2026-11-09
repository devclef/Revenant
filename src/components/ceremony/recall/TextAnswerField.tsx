// Feature: spec 10 (own questions), C4.5 and C4.6: the field for a text
// question in the Recall_Pager.
//
// A textarea named by its question heading, with a live count of code points
// and the "No answer" control under it. Enter is not handled here, so the
// browser inserts a line break; the form submits only from its button.
//
// The field is controlled and keeps whatever the judge typed. The count and
// the invalid message come in as copy from the caller, so this component adds
// no string of its own except the "No answer" label it shares with the number
// field.

import { REVEAL_COPY } from "@/components/reveal/copy";
import { textCodePoints } from "./recall-field";

/** The number of rows the text answer textarea shows (C4.5). */
export const TEXT_ANSWER_ROWS = 4;

export type TextAnswerFieldProps = {
  /** The textarea's id. The count and the message derive their ids from it. */
  id: string;
  /** The id of the question heading, which names the textarea (C4.5). */
  headingId: string;
  /** The id of the "No answer" checkbox. */
  noAnswerId: string;
  /** The text in the field, as typed. */
  value: string;
  /** Whether "No answer" is ticked. A ticked field is disabled. */
  noAnswer: boolean;
  /** Whether to show the invalid message, after a submit attempt on invalid text. */
  invalid: boolean;
  /** The live count line. Receives the number of code points in the trimmed text. */
  countLabel: (count: number) => string;
  /** The invalid message (C4.6). */
  invalidText: string;
  onChange: (text: string) => void;
  onToggleNoAnswer: (noAnswer: boolean) => void;
};

export function TextAnswerField({
  id,
  headingId,
  noAnswerId,
  value,
  noAnswer,
  invalid,
  countLabel,
  invalidText,
  onChange,
  onToggleNoAnswer,
}: TextAnswerFieldProps) {
  const countId = `${id}-count`;
  const invalidId = `${id}-invalid`;
  const describedBy = invalid ? `${countId} ${invalidId}` : countId;

  return (
    <div>
      <textarea
        id={id}
        rows={TEXT_ANSWER_ROWS}
        value={value}
        disabled={noAnswer}
        data-stage-focus=""
        aria-invalid={invalid ? true : undefined}
        aria-labelledby={headingId}
        aria-describedby={describedBy}
        onChange={(event) => onChange(event.target.value)}
      />
      <p id={countId}>{countLabel(textCodePoints(value))}</p>
      {invalid ? <p id={invalidId}>{invalidText}</p> : null}
      <label htmlFor={noAnswerId}>
        <input
          id={noAnswerId}
          type="checkbox"
          checked={noAnswer}
          onChange={(event) => onToggleNoAnswer(event.target.checked)}
        />
        {REVEAL_COPY.noAnswer}
      </label>
    </div>
  );
}
