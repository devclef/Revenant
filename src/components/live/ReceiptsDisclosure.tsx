"use client";

import { type ReactNode, useEffect, useRef } from "react";

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
  /**
   * A counter the page raises to ask for the disclosure to open (the Add a
   * receipt action). Each change opens the disclosure and moves focus into it.
   * Zero, the default, does nothing.
   */
  openRequest?: number;
}

/** Controls a visitor can focus inside the disclosure, in DOM order. */
const CONTROL_SELECTOR = "input, button, select, textarea, a[href]";

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
 *
 * The summary still opens it from the keyboard, because it is a native
 * `details`. When `openRequest` changes, the disclosure opens and focus moves
 * to the first figure checkbox when figures are ready, otherwise to the first
 * own-number control. The focus move does not scroll the page.
 */
export function ReceiptsDisclosure({
  status,
  picker,
  selfReported,
  openRequest = 0,
}: ReceiptsDisclosureProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const handledRequest = useRef(0);

  useEffect(() => {
    if (openRequest === 0 || openRequest === handledRequest.current) return;
    handledRequest.current = openRequest;
    const details = detailsRef.current;
    if (details === null) return;
    details.open = true;
    const target = firstTarget(details, status === "ready");
    target?.focus({ preventScroll: true });
  }, [openRequest, status]);

  return (
    <details ref={detailsRef} className={styles.more} data-receipts-disclosure>
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

/**
 * The control to focus when the disclosure opens: the first figure checkbox
 * when figures are ready, otherwise the first control after the summary. Falls
 * back to the first control of any kind when the preferred one is missing.
 */
function firstTarget(
  details: HTMLDetailsElement,
  figuresReady: boolean,
): HTMLElement | null {
  if (figuresReady) {
    const checkbox = details.querySelector<HTMLElement>(
      'input[type="checkbox"]',
    );
    if (checkbox !== null) return checkbox;
  }
  const controls = Array.from(
    details.querySelectorAll<HTMLElement>(CONTROL_SELECTOR),
  );
  return controls.find((el) => el.closest("summary") === null) ?? null;
}
