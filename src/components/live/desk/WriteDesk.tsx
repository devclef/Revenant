"use client";

import type { ReactNode, RefObject } from "react";

import { LIVE_COPY } from "../copy";
import type { OccasionId } from "../occasions";

import { DESK_COPY } from "./copy";
import styles from "./desk.module.css";
import { LetterSheet } from "./LetterSheet";
import { OccasionPills } from "./OccasionPills";
import { StepHeader } from "./StepHeader";

export interface WriteDeskProps {
  /** The Occasion last chosen. "A blank page" at first (W3.2). */
  chosenOccasion: OccasionId;
  onChooseOccasion: (id: OccasionId) => void;
  /** The Letter_Field placeholder, shown only while the letter is empty. */
  placeholder: string;
  /** The letter text. */
  text: string;
  /** The letter problem line, or "" when there is none (W5.5). */
  letterProblem: string;
  onLetterChange: (value: string) => void;
  onLetterBlur: () => void;
  letterRef: RefObject<HTMLTextAreaElement | null>;
  /** The author questions. They sit inside the Letter_Sheet under the field. */
  authorQuestions: ReactNode;
  /** The receipts disclosure and its problem line, in the panel column. */
  receipts: ReactNode;
  /** The "Add a receipt" and "Next" row, in the panel column. */
  actions: ReactNode;
  /** Content after the action row, inside the panel (the rehearsal line). */
  footer?: ReactNode;
}

/**
 * The Write desk (spec 14, W1 and W2): the step header, the Occasion pills,
 * then a wrapping row. The Letter_Sheet sits on the left and the panel on the
 * right. Below 992 px of content width the panel drops under the sheet (W1.4).
 *
 * This is the interim panel: the receipts and the action row stay where they
 * were until the Envelope_Panel replaces them. The panel is a paper surface,
 * so its text keeps the paper ink. The desk itself sets the light text.
 */
export function WriteDesk({
  chosenOccasion,
  onChooseOccasion,
  placeholder,
  text,
  letterProblem,
  onLetterChange,
  onLetterBlur,
  letterRef,
  authorQuestions,
  receipts,
  actions,
  footer,
}: WriteDeskProps) {
  return (
    <div className={styles.container} data-write-desk="">
      <StepHeader
        headingId="live-write-heading"
        eyebrow={LIVE_COPY.liveHeading}
        heading={DESK_COPY.heading}
        intro={DESK_COPY.intro}
      />
      <OccasionPills chosen={chosenOccasion} onChoose={onChooseOccasion} />
      <div className={styles.row}>
        <div className={styles.sheetColumn}>
          <LetterSheet
            value={text}
            placeholder={placeholder}
            problem={letterProblem}
            onChange={onLetterChange}
            onBlur={onLetterBlur}
            fieldRef={letterRef}
          >
            {authorQuestions}
          </LetterSheet>
        </div>
        <div className={styles.panelColumn}>
          {receipts}
          {actions}
          {footer}
        </div>
      </div>
    </div>
  );
}
