"use client";

import { useId, useMemo } from "react";

import { DemoLabel } from "@/components/demo/DemoLabel";
import { encodeQr, qrToSvg } from "@/lib/cards";

import { LIVE_COPY } from "./copy";
import { formatLocalDateTime } from "./format";
import { letterLinkText } from "./keepsake-files";
import styles from "./live.module.css";

/**
 * The letter card (spec 06, task 11; R20.1, R20.2, design Part D). An in-page
 * printable section with a QR code of the letter link, the opening time, and
 * the link as text. The QR holds only `{origin}/l/{letterId}`: no key and no
 * letter content. The print button and the Demo label are hidden in print
 * through `.noPrint`; the card itself prints as a keepsake.
 */

export interface LetterCardProps {
  letterId: string;
  /** APP_ORIGIN without a trailing slash. */
  appOrigin: string;
  /** The opening instant, an ISO 8601 string in UTC. */
  opensAt: string;
}

export function LetterCard({ letterId, appOrigin, opensAt }: LetterCardProps) {
  const headingId = useId();
  const linkText = letterLinkText(appOrigin, letterId);
  const qrSvg = useMemo(() => qrToSvg(encodeQr(linkText, "M")), [linkText]);

  return (
    <section className={styles.card} aria-labelledby={headingId} data-live-letter-card>
      <DemoLabel />
      <h2 id={headingId} className={styles.cardTitle}>
        {LIVE_COPY.letterCardTitle}
      </h2>
      <div className={styles.cardQr} aria-hidden="true" data-live-card-qr dangerouslySetInnerHTML={{ __html: qrSvg }} />
      <p className={styles.cardOpens}>
        {LIVE_COPY.letterCardOpens.replace("{time}", formatLocalDateTime(opensAt))}
      </p>
      <p className={styles.cardLink} data-live-card-link>
        {linkText}
      </p>
      <div className={styles.noPrint}>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => window.print()}
          data-live-print
        >
          {LIVE_COPY.printCard}
        </button>
      </div>
    </section>
  );
}
