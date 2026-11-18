"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { LIVE_COPY } from "../copy";
import { envelopeChecklist } from "./checklist";
import { FoldButton } from "./FoldButton";
import { InTheEnvelopeCard } from "./InTheEnvelopeCard";
import styles from "./panel.module.css";
import { writeCheck, type WriteCheckInput } from "./write-check";

export interface EnvelopePanelProps {
  /** The draft the checklist, the small seal and the Fold_Button all read. */
  checkInput: WriteCheckInput;
  /** True after a failed fold, until the Write_Check passes (W13.3). */
  failed: boolean;
  /** Runs the Write_Check and moves on when it passes. */
  onFold: () => void;
  /** Shows the Rehearsal_Line under the Fold_Button. Set only on /demo/live. */
  rehearsal?: boolean;
  /** The receipt card (ReceiptPanel), the only way to add a receipt (W10.2). */
  receipts: ReactNode;
  /** Extra class for the column, from the desk's layout (flex and width). */
  className?: string;
}

/** The gap between the Top_Bar and the sticky panel, plus the margin (W1.3). */
const STICKY_MARGIN_PX = 32;

/**
 * The Envelope_Panel (spec 14, W1.3 and W1.6, W9, W13): a column with the
 * In_The_Envelope_Card, the receipts, the Fold_Button and the Rehearsal_Line.
 *
 * It is sticky only while it fits under the Top_Bar and shares a line with the
 * Letter_Sheet. Otherwise it scrolls with the page, so the Fold_Button can
 * always be reached. The sticky state is set on `data-sticky`, so the CSS only
 * applies `position: sticky` when the measurement allows it.
 */
export function EnvelopePanel({
  checkInput,
  failed,
  onFold,
  rehearsal = false,
  receipts,
  className,
}: EnvelopePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [sticky, setSticky] = useState(false);

  // The checklist counts the own number's row. Task 6 makes it one row, so
  // until then the first row stands for it.
  const checklist = envelopeChecklist({
    text: checkInput.text,
    questions: checkInput.questions,
    metricIds: checkInput.metricIds,
    ownNumber: checkInput.selfReported[0] ?? null,
  });
  const ready = writeCheck(checkInput).ok;

  useEffect(() => {
    const panel = panelRef.current;
    if (panel === null) return;
    // The sheet is the element just before the panel in the desk row.
    const sheet = panel.previousElementSibling as HTMLElement | null;

    const update = () => {
      const topBar = document.querySelector<HTMLElement>("[data-topbar]");
      const topBarBottom = topBar?.getBoundingClientRect().bottom ?? 0;
      const fits =
        panel.offsetHeight <=
        window.innerHeight - topBarBottom - STICKY_MARGIN_PX;
      const sameLine = sheet !== null && panel.offsetTop === sheet.offsetTop;
      setSticky(fits && sameLine);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(panel);
    if (sheet !== null) observer.observe(sheet);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  return (
    <div
      ref={panelRef}
      className={className ? `${styles.panel} ${className}` : styles.panel}
      data-envelope-panel=""
      data-sticky={sticky ? "" : undefined}
    >
      <InTheEnvelopeCard checklist={checklist} ready={ready} />
      {receipts}
      <FoldButton onFold={onFold} failed={failed} />
      {rehearsal ? (
        <p className={styles.rehearsal} data-live-rehearsal="">
          {LIVE_COPY.rehearsalLine}
        </p>
      ) : null}
    </div>
  );
}
