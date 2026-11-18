"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import { LIVE_COPY } from "../copy";
import type { OccasionId } from "../occasions";

import { DESK_COPY } from "./copy";
import { EnvelopePanel } from "./EnvelopePanel";
import styles from "./desk.module.css";
import { LetterSheet } from "./LetterSheet";
import { OccasionPills } from "./OccasionPills";
import { ReceiptPanel, type ReceiptPanelProps } from "./ReceiptPanel";
import type { ReceiptView } from "./ReceiptToggle";
import { StepHeader } from "./StepHeader";
import {
  writeCheck,
  type FoldTarget,
  type WriteCheckInput,
} from "./write-check";

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
  /** The receipt card's data: series, figures, own number and touch state. */
  receipt: Omit<ReceiptPanelProps, "view" | "onViewChange">;
  /** The draft the Write_Check and the Envelope_Panel read (W9, W13). */
  check: WriteCheckInput;
  /** Shows the Rehearsal_Line under the Fold_Button. Set only on /demo/live. */
  rehearsal?: boolean;
  /** The Write_Check passed and the Fold_Button was pressed: move to Seal. */
  onFoldPass: () => void;
  /**
   * The Write_Check failed: mark every write field touched and count the
   * attempt, so each field shows its own message.
   */
  onFoldFail: () => void;
}

/** A failed fold: where focus goes, and a counter so each fold moves it again. */
interface FoldFailure {
  target: FoldTarget | null;
  nonce: number;
}

/** The first own-number control that holds `field`, or the first one at all. */
function ownNumberInput(
  root: HTMLElement,
  field: string,
): HTMLInputElement | null {
  const inputs = root.querySelectorAll<HTMLInputElement>(
    "input[data-user-content]",
  );
  const matching = Array.from(inputs).find((input) =>
    input.id.endsWith(`-${field}`),
  );
  return matching ?? inputs[0] ?? null;
}

/** Finds the DOM control for a fold target, in page order. */
function targetElement(
  root: HTMLElement,
  target: FoldTarget,
  letter: HTMLTextAreaElement | null,
): HTMLElement | null {
  switch (target.kind) {
    case "letter":
      return letter;
    case "question":
      return (
        root.querySelectorAll<HTMLTextAreaElement>("[data-question-row] textarea")[
          target.index
        ] ?? null
      );
    case "write_own":
      return (
        Array.from(root.querySelectorAll<HTMLButtonElement>("button")).find(
          (button) => button.textContent?.trim() === DESK_COPY.writeOwn,
        ) ?? null
      );
    case "own_number":
      return ownNumberInput(root, target.field);
  }
}

/**
 * The Write desk (spec 14, W1, W2 and W13): the step header, the Occasion
 * pills, then a wrapping row. The Letter_Sheet sits on the left and the
 * Envelope_Panel on the right. Below 992 px of content width the panel drops
 * under the sheet (W1.4).
 *
 * The Fold_Button runs the Write_Check. A pass moves to the Seal step. A fail
 * marks the fields, and focus moves to the first failing field in page order.
 * A failed fold that points at an own-number field switches the Receipt_Toggle
 * to the own view first, and opens the phone `details` if it is closed (W13.3).
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
  receipt,
  check,
  rehearsal = false,
  onFoldPass,
  onFoldFail,
}: WriteDeskProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [failure, setFailure] = useState<FoldFailure | null>(null);
  const [view, setView] = useState<ReceiptView>("public");
  const writeResult = writeCheck(check);

  // The failed-fold line goes away once the Write_Check passes (W13.3).
  useEffect(() => {
    if (writeResult.ok) setFailure(null);
  }, [writeResult.ok]);

  // Runs after the touched messages render, so focus lands on a visible field.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (failure === null || failure.target === null || root === null) return;
    const element = targetElement(root, failure.target, letterRef.current);
    if (element === null) return;
    // On the phone the card is a closed `details`, so open it before focusing.
    const details = element.closest("details");
    if (details !== null) details.open = true;
    element.focus();
  }, [failure, letterRef]);

  function fold() {
    const result = writeCheck(check);
    if (result.ok) {
      onFoldPass();
      return;
    }
    // The own view is switched in the same update, so the field is shown when
    // the layout effect focuses it.
    if (result.first?.kind === "own_number") setView("own");
    setFailure((previous) => ({
      target: result.first,
      nonce: (previous?.nonce ?? 0) + 1,
    }));
    onFoldFail();
  }

  return (
    <div
      ref={rootRef}
      className={styles.container}
      data-write-desk=""
    >
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
        <EnvelopePanel
          className={styles.panelColumn}
          checkInput={check}
          failed={failure !== null}
          onFold={fold}
          rehearsal={rehearsal}
          receipts={
            <ReceiptPanel {...receipt} view={view} onViewChange={setView} />
          }
        />
      </div>
    </div>
  );
}
