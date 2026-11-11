"use client";

import type { ReactNode } from "react";

import { LIVE_COPY } from "./copy";
import styles from "./live.module.css";

/** The state of the figures request, as the live seal page sees it (X2). */
export type ReceiptsStatus = "loading" | "ready" | "failed";

export interface ReceiptsDisclosureProps {
  status: ReceiptsStatus;
  /** The figure picker. Shown only when the request is ready. */
  picker?: ReactNode;
  /** The visitor's own numbers. Shown whatever the figures status is. */
  selfReported?: ReactNode;
}

/**
 * The one closed Receipts_Disclosure on the Write step (spec 11, L1.4 and
 * L1.5). It is a native `details`, closed by default, and its content stays in
 * the document. It opens with one neutral sentence, then the figure picker,
 * then the visitor's own numbers.
 *
 * The figures request only changes what the disclosure shows about official
 * figures (X2.2 and X2.3): a loading line while it is in flight, one plain
 * unavailable line when it failed, and the picker when it is ready. Your own
 * numbers are not official figures, so they stay in every state. Nothing here
 * gates sealing or Next.
 */
export function ReceiptsDisclosure({
  status,
  picker,
  selfReported,
}: ReceiptsDisclosureProps) {
  return (
    <details className={styles.more} data-receipts-disclosure>
      <summary className={styles.moreSummary}>
        {LIVE_COPY.receiptsSummary}
      </summary>
      <p className={styles.hint}>{LIVE_COPY.receiptsExplain}</p>
      {status === "loading" ? (
        <p className={styles.hint} role="status">
          {LIVE_COPY.receiptsLoading}
        </p>
      ) : null}
      {status === "failed" ? (
        <p className={styles.hint} role="status">
          {LIVE_COPY.receiptsUnavailable}
        </p>
      ) : null}
      {status === "ready" ? picker : null}
      {selfReported}
    </details>
  );
}
