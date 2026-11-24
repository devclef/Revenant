"use client";

import { useEffect, useId, useState } from "react";

import { PHONE_QUERY } from "@/components/ceremony/scene/TopBar";

import type { PickableSeries } from "../catalogue-list";
import { LIVE_COPY } from "../copy";
import type { FigureDetail } from "../FigurePicker";
import type { TouchedState } from "../touched";
import type { OwnNumberField, SelfReportedRow } from "../write-draft";

import { DESK_COPY } from "./copy";
import { FigureRows } from "./FigureRows";
import { OwnNumberView } from "./OwnNumberView";
import { ReceiptToggle, type ReceiptView } from "./ReceiptToggle";
import styles from "./panel.module.css";

/** The state of the figures list the public view shows. */
export type FiguresStatus = "ready" | "loading" | "failed";

export interface ReceiptPanelProps {
  /** The series the public view offers, in catalogue order. */
  series: readonly PickableSeries[];
  /** The figures list state. Loading and failed show a status line instead. */
  figuresStatus?: FiguresStatus;
  /** Metric ids the visitor has chosen. */
  selected: readonly string[];
  /** Called with the metric id of a row the visitor pressed. */
  onToggleFigure: (metricId: string) => void;
  /** Value and source per metric id, for the rows and the Details control. */
  details?: ReadonlyMap<string, FigureDetail>;
  /** The own number row, as typed. */
  ownNumber: SelfReportedRow;
  /** The sealing day, YYYY-MM-DD. Empty until the visitor's local day is known. */
  sealingDay: string;
  /** Which own number fields the visitor has touched, and whether a seal was tried. */
  touched: TouchedState;
  /** Records that the visitor changed or left an own number field. */
  onTouch: (key: string) => void;
  /** The visitor typed in one own number field. */
  onOwnNumberChange: (field: OwnNumberField, text: string) => void;
  /** The view shown. The desk owns it so a failed fold can switch it (W13.3). */
  view: ReceiptView;
  /** Called with the view the visitor picked. */
  onViewChange: (view: ReceiptView) => void;
  /** Real mode (the `/seal` letter), passed on to the figure rows. */
  real?: boolean;
}

/**
 * True below PHONE_QUERY, after the first client render (spec 14, W10.2). The
 * server and the first client render report false, so the wide markup is what
 * the server sends and hydration never mismatches. The switch to the phone
 * `details` happens after mount.
 */
function usePhone(): boolean {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      typeof window.matchMedia !== "function"
    ) {
      return;
    }
    const query = window.matchMedia(PHONE_QUERY);
    const update = () => setPhone(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return phone;
}

/**
 * The "Tuck in a receipt" card (spec 14, W10 to W12). Below 600 px it is a
 * closed native `details` whose summary names it. Wider, it is a section with
 * the heading and the optional label. Both views stay mounted and only one is
 * shown, so a figure chosen and an own number typed in either view both stay
 * for sealing (W10.6). The public view is the figure rows; the own view is
 * the Own_Number_View.
 */
export function ReceiptPanel({
  series,
  figuresStatus = "ready",
  selected,
  onToggleFigure,
  details,
  ownNumber,
  sealingDay,
  touched,
  onTouch,
  onOwnNumberChange,
  view,
  onViewChange,
  real = false,
}: ReceiptPanelProps) {
  const headingId = useId();
  const phone = usePhone();

  const publicView =
    figuresStatus === "loading" ? (
      <p className={styles.receiptStatus} role="status">
        {LIVE_COPY.receiptsLoading}
      </p>
    ) : figuresStatus === "failed" ? (
      <p className={styles.receiptStatus} role="status">
        {LIVE_COPY.receiptsUnavailable}
      </p>
    ) : (
      <FigureRows
        series={series}
        selected={selected}
        onToggle={onToggleFigure}
        details={details}
        real={real}
      />
    );

  const body = (
    <>
      <p className={styles.receiptIntro}>{DESK_COPY.receiptIntro}</p>
      <ReceiptToggle view={view} onChange={onViewChange} />
      <div hidden={view !== "public"} data-receipt-view="public">
        {publicView}
      </div>
      <div hidden={view !== "own"} data-receipt-view="own">
        <OwnNumberView
          row={ownNumber}
          sealingDay={sealingDay}
          touched={touched}
          onTouch={onTouch}
          onChange={onOwnNumberChange}
        />
      </div>
    </>
  );

  if (phone) {
    return (
      <details className={styles.card} data-receipt-panel="">
        <summary className={styles.receiptSummary}>
          {DESK_COPY.receiptSummaryPhone}
        </summary>
        {body}
      </details>
    );
  }

  return (
    <section
      className={styles.card}
      data-receipt-panel=""
      aria-labelledby={headingId}
    >
      <div className={styles.titleRow}>
        <h2 id={headingId} className={styles.receiptTitle}>
          {DESK_COPY.receiptTitle}
        </h2>
        <span className={styles.optional}>{DESK_COPY.optional}</span>
      </div>
      {body}
    </section>
  );
}
