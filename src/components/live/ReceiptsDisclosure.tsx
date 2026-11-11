"use client";

import type { ReactNode } from "react";

import { LIVE_COPY } from "./copy";
import styles from "./live.module.css";

/** The state of the figures request, as the live seal page sees it (X2). */
export type ReceiptsStatus = "loading" | "ready" | "failed";

export interface ReceiptsDisclosureProps {
  status: ReceiptsStatus;
  /** The picker. Shown only when the request is ready. */
  children?: ReactNode;
}

/**
 * The receipts part of the write step (spec 11, X2.2 and X2.3). It shows the
 * loading line while the figures request is in flight, the unavailable line
 * and no picker when it failed, and the picker when it is ready.
 *
 * It never gates sealing or Next. A failed or loading request only changes
 * what this part shows; the letter can still be sealed with one question.
 */
export function ReceiptsDisclosure({ status, children }: ReceiptsDisclosureProps) {
  if (status === "loading") {
    return (
      <p className={styles.hint} role="status">
        {LIVE_COPY.receiptsLoading}
      </p>
    );
  }
  if (status === "failed") {
    return (
      <p className={styles.hint} role="status">
        {LIVE_COPY.receiptsUnavailable}
      </p>
    );
  }
  return <>{children}</>;
}
