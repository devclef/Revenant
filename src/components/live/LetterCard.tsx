"use client";

import { useId, useMemo } from "react";

import { DemoLabel } from "@/components/demo/DemoLabel";
import { encodeQr, qrPath, letterCardSvg } from "@/lib/cards";
import { formatFingerprint } from "@/lib/seal-format";

import { LIVE_COPY } from "./copy";
import { formatLocalDateTime } from "./format";
import { downloadTextFile, letterLinkText } from "./keepsake-files";
import styles from "./live.module.css";

/**
 * The letter card (spec 06, task 11; R20.1, R20.2, design Part D; spec 08 R14.4,
 * R14.7). An in-page printable section with a QR code of the letter link, the
 * opening time, the link as text and the sealing Fingerprint under the link.
 * The QR holds only `{origin}/l/{letterId}`: no key and no letter content.
 *
 * The Fingerprint is the same 16 groups of 4 hex characters the Reveal shows
 * (R14.4, Property 16), from the one `formatFingerprint` module. It is shown so
 * the reader can compare the card against the opening Fingerprint by eye.
 *
 * The print button, the "Save the card as an image" button and the Demo label
 * are hidden in print through `.noPrint`; the card itself prints as a keepsake.
 * "Save the card as an image" builds a standalone SVG of the card (QR, opening
 * date, link and Fingerprint) in the browser, with no raster library, and saves
 * it as a file (R14.1, R14.2, R14.7).
 */

export interface LetterCardProps {
  letterId: string;
  /** APP_ORIGIN without a trailing slash. */
  appOrigin: string;
  /** The opening instant, an ISO 8601 string in UTC. */
  opensAt: string;
  /** The sealing Fingerprint: 64 lowercase hex characters, from the seal response. */
  envelopeHash: string;
}

export function LetterCard({ letterId, appOrigin, opensAt, envelopeHash }: LetterCardProps) {
  const headingId = useId();
  const linkText = letterLinkText(appOrigin, letterId);
  const qr = useMemo(() => qrPath(encodeQr(linkText, "M")), [linkText]);
  const opensText = formatLocalDateTime(opensAt);
  // A sealed letter always carries a verified 64-char hex hash, so this is
  // defensive: a malformed hash shows no Fingerprint rather than a broken one.
  const fingerprint = formatFingerprint(envelopeHash);

  function onSaveImage(): void {
    if (fingerprint === null) return;
    const svg = letterCardSvg({
      qr,
      title: LIVE_COPY.letterCardTitle,
      opensLabel: LIVE_COPY.letterCardOpens.replace("{time}", opensText),
      link: linkText,
      fingerprintLabel: LIVE_COPY.letterCardFingerprint,
      fingerprint,
    });
    downloadTextFile(svg, `revenant-letter-card-${letterId.replace(/[^A-Za-z0-9-]/g, "")}.svg`, "image/svg+xml;charset=utf-8");
  }

  return (
    <section className={styles.card} aria-labelledby={headingId} data-live-letter-card>
      <DemoLabel />
      <h2 id={headingId} className={styles.cardTitle}>
        {LIVE_COPY.letterCardTitle}
      </h2>
      <div className={styles.cardQr} aria-hidden="true" data-live-card-qr>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`0 0 ${qr.side} ${qr.side}`}
          shapeRendering="crispEdges"
          role="img"
        >
          <path fill="#000" d={qr.d} />
        </svg>
      </div>
      <p className={styles.cardOpens}>
        {LIVE_COPY.letterCardOpens.replace("{time}", opensText)}
      </p>
      <p className={styles.cardLink} data-live-card-link>
        {linkText}
      </p>
      {fingerprint !== null ? (
        <>
          <p className={styles.cardFingerprintLabel}>{LIVE_COPY.letterCardFingerprint}</p>
          <p className={styles.cardFingerprint} translate="no" data-live-card-fingerprint>
            {fingerprint}
          </p>
        </>
      ) : null}
      <div className={styles.noPrint}>
        <button
          type="button"
          className={styles.secondary}
          onClick={() => window.print()}
          data-live-print
        >
          {LIVE_COPY.printCard}
        </button>
        {fingerprint !== null ? (
          <button
            type="button"
            className={styles.secondary}
            onClick={onSaveImage}
            data-live-save-image
          >
            {LIVE_COPY.saveCardImage}
          </button>
        ) : null}
      </div>
    </section>
  );
}
