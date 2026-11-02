"use client";

import { useId, useMemo } from "react";

import { DemoLabel } from "@/components/demo/DemoLabel";
import { encodeQr, qrPath } from "@/lib/cards";

import { keyGroups } from "./BackupFallback";
import { LIVE_COPY } from "./copy";
import { letterLinkText } from "./keepsake-files";
import styles from "./live.module.css";

/**
 * The backup key card (spec 06, task 12; R21.3–R21.5). A printable keepsake
 * that opens the letter on its own after the opening date. It shows what the
 * card is, the letter link as text, the key in groups of four, and a QR code
 * of `{origin}/l/{letterId}#k={key without hyphens}`.
 *
 * The key sits in the URL fragment, which browsers never send to the server.
 * The card makes no request, writes nothing to storage and logs nothing. It
 * is shown only after the judge asks for it on the sealed view.
 */

export interface BackupKeyCardProps {
  letterId: string;
  /** APP_ORIGIN without a trailing slash. */
  appOrigin: string;
  /** The printed key from formatBackupKey: 27 characters with hyphens. */
  keyText: string;
}

/**
 * The URL the card's QR code encodes: the letter link followed by the key in
 * the fragment, with the hyphens removed. Exported so a test can check it.
 */
export function backupKeyFragmentUrl(appOrigin: string, letterId: string, keyText: string): string {
  return `${letterLinkText(appOrigin, letterId)}#k=${keyText.replace(/-/g, "")}`;
}

export function BackupKeyCard({ letterId, appOrigin, keyText }: BackupKeyCardProps) {
  const headingId = useId();
  const linkText = letterLinkText(appOrigin, letterId);
  const qr = useMemo(
    () => qrPath(encodeQr(backupKeyFragmentUrl(appOrigin, letterId, keyText), "M")),
    [appOrigin, letterId, keyText],
  );

  return (
    <section className={styles.card} aria-labelledby={headingId} data-live-backup-card>
      <DemoLabel />
      <h2 id={headingId} className={styles.cardTitle}>
        {LIVE_COPY.backupCardTitle}
      </h2>
      <p className={styles.cardOpens}>{LIVE_COPY.backupCardWhat}</p>
      <p className={styles.cardOpens}>{LIVE_COPY.backupCardKeep}</p>

      <p className={styles.cardOpens}>{LIVE_COPY.linkLabel}</p>
      <p className={styles.cardLink} data-live-card-link>
        {linkText}
      </p>

      <p className={styles.cardOpens}>{LIVE_COPY.backupCardKeyLabel}</p>
      <div className={styles.keyBox} data-live-key>
        {keyGroups(keyText).map((group, index) => (
          <span key={index} className={styles.keyGroup}>
            {group}
          </span>
        ))}
      </div>

      <div className={styles.cardQr} aria-hidden="true" data-live-backup-qr>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`0 0 ${qr.side} ${qr.side}`}
          shapeRendering="crispEdges"
          role="img"
        >
          <path fill="#000" d={qr.d} />
        </svg>
      </div>
      <p className={styles.cardOpens}>{LIVE_COPY.backupCardQrHint}</p>

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
