"use client";

import { LetterCard } from "./LetterCard";
import { LIVE_COPY } from "./copy";
import { buildKeepsakeIcs, downloadTextFile, icsFileName } from "./keepsake-files";
import styles from "./live.module.css";

/**
 * The keepsakes on the sealed state (spec 06, task 11; R20.1, R20.4–R20.6).
 * It offers the printable letter card and a calendar download.
 *
 * The `.ics` file is built and saved in the click handler, as a Blob, with no
 * request to the server. The page never registers a service worker and never
 * uploads a card (source scan in keepsakes-source-scan.test.ts).
 */

export interface SealedKeepsakesProps {
  letterId: string;
  /** APP_ORIGIN without a trailing slash. */
  appOrigin: string;
  /** The opening instant, an ISO 8601 string in UTC. */
  opensAt: string;
  /** The sealing Fingerprint: 64 lowercase hex characters, shown on the card. */
  envelopeHash: string;
  /** Draw the wax seal on the letter card. Defaults to true. */
  showSeal?: boolean;
  /** Show the Demo label on the letter card. Defaults to true. */
  showDemoLabel?: boolean;
  /**
   * The surface the keepsakes sit on, outside the paper letter card. "paper"
   * (the default) keeps the paper ink; "desk" sets the desk text colours for
   * the line above the card and the calendar button below it.
   */
  surface?: "paper" | "desk";
}

export function SealedKeepsakes({
  letterId,
  appOrigin,
  opensAt,
  envelopeHash,
  showSeal = true,
  showDemoLabel = true,
  surface = "paper",
}: SealedKeepsakesProps) {
  const onDesk = surface === "desk" ? ` ${styles.onDesk}` : "";
  function onDownloadIcs(): void {
    const text = buildKeepsakeIcs({
      letterId,
      appOrigin,
      opensAt,
      dtstamp: new Date().toISOString(),
    });
    downloadTextFile(text, icsFileName(letterId), "text/calendar;charset=utf-8");
  }

  return (
    <div className={styles.keepsakes} data-live-keepsakes>
      <p className={`${styles.intro}${onDesk}`}>{LIVE_COPY.sealDrawnFrom}</p>
      <LetterCard
        letterId={letterId}
        appOrigin={appOrigin}
        opensAt={opensAt}
        envelopeHash={envelopeHash}
        showSeal={showSeal}
        showDemoLabel={showDemoLabel}
      />
      <div className={styles.noPrint}>
        <button type="button" className={`${styles.secondary}${onDesk}`} onClick={onDownloadIcs} data-live-ics>
          {LIVE_COPY.downloadIcs}
        </button>
      </div>
    </div>
  );
}
