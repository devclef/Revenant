"use client";

import paper from "@/components/ui/paper.module.css";
import { RecallPager } from "@/components/ceremony/recall/RecallPager";
import type { Draft } from "@/lib/recall";
import type { Opened } from "./opening-machine";
import styles from "./reveal.module.css";

/**
 * The recall step (R8, product.md "Recall first"). Shown for the `recall`
 * state. A persona letter reaches it from `verifying` and a live letter from
 * `unlocking`, with no judge action in between (spec 10 C1). The judge answers,
 * from memory, what each tracked figure cost "then"; their answers are
 * encrypted and stored before the reveal. This
 * view never shows a sealed figure, a period, a source or any hint of which way
 * a figure moved (neutrality.md).
 *
 * Spec 07 (R11.1, R11.10) replaces spec 03 R8.1 and R8.4 here: the step shows
 * one question at a time through `RecallPager`, not a fieldset per question.
 * The pager keeps the same drafts, validation message and submit rules.
 *
 * This component builds no record and holds no state. It renders the pager with
 * the drafts it is given and passes every edit, toggle and submit back to the
 * reducer. All state lives in the reducer (and the pager's view-local index).
 */

export type RecallStepProps = {
  /** The opened letter; its payload holds the sealed questions and metrics. */
  opened: Opened;
  /** The judge's in-progress answers, keyed by question ID. */
  drafts: Readonly<Record<string, Draft>>;
  /** The question IDs that failed validation on the last submit (R8.4, R11.10). */
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
  /** True in `submit_failed`: shows the submit-failed message (R8.7, R11.12). */
  failed?: boolean;
  /**
   * The persona's written-as-of date (`YYYY-MM-DD`). Set only on a persona
   * letter, so the counter shows it (R11.5). Absent on a Live_Letter.
   */
  writtenAsOf?: string;
};

export function RecallStep({
  opened,
  drafts,
  invalid,
  submitting,
  onEdit,
  onToggleNoAnswer,
  onSubmit,
  failed = false,
  writtenAsOf,
}: RecallStepProps) {
  return (
    <section className={`${paper.paper} ${styles.recall}`} data-paper="">
      <RecallPager
        payload={opened.payload}
        drafts={drafts}
        invalid={invalid}
        submitting={submitting}
        failed={failed}
        writtenAsOf={writtenAsOf}
        onEdit={onEdit}
        onToggleNoAnswer={onToggleNoAnswer}
        onSubmit={onSubmit}
      />
    </section>
  );
}
