import Link from "next/link";
import type { ReactNode } from "react";
import { formatFingerprint } from "@/lib/seal-format";
import type { LetterKind } from "./FigureLine";
import { REVEAL_COPY } from "./copy";
import styles from "./receipts.module.css";
import revealStyles from "./reveal.module.css";

/**
 * The seal line at the foot of the receipts column (spec 15 R12.6). It reads
 * "The seal is intact. Nothing here has changed since it was sealed.", with the
 * Fingerprint behind a closed "Show the fingerprint" disclosure.
 *
 * The persona Tamper_Control lives in this row (`tamper`), after the
 * disclosure, and keeps today's behaviour. A live or real letter passes no
 * `tamper`. The verified envelope hash is the one `openLetter` checked, so the
 * line never shows a result the check did not give.
 */

export type SealLineProps = {
  /** The verified envelope hash from `Opened.envelopeHash`. */
  envelopeHash: string;
  /** The kind of opened letter. A persona shows the demo labels. */
  letterKind: LetterKind;
  /** The persona Tamper_Control. Omitted for a live or real letter. */
  tamper?: ReactNode;
};

/** Split the 16 space-separated groups into two lines of 8. */
function twoLines(fingerprint: string): [string, string] {
  const groups = fingerprint.split(" ");
  return [groups.slice(0, 8).join(" "), groups.slice(8).join(" ")];
}

export function SealLine({ envelopeHash, letterKind, tamper }: SealLineProps) {
  const fingerprint = formatFingerprint(envelopeHash);
  if (fingerprint === null) return null;
  const [lineOne, lineTwo] = twoLines(fingerprint);
  const isPersona = letterKind === "persona";

  return (
    <section className={styles.seal} data-seal-line="">
      <p className={styles.sealStatus} role="status">
        <span className={styles.sealMark} aria-hidden="true">
          ✓
        </span>
        <span>{REVEAL_COPY.sealIntact}</span>
      </p>
      <details className={revealStyles.fingerprintDisclosure}>
        <summary>{REVEAL_COPY.fingerprintShow}</summary>
        <p className={revealStyles.fingerprintGroups} translate="no">
          <span className={revealStyles.fingerprintLine}>{lineOne}</span>
          <span className={revealStyles.fingerprintLine}>{lineTwo}</span>
        </p>
        {isPersona ? (
          <>
            <p className={revealStyles.fingerprintStatement}>
              <span className={revealStyles.fixtureLabel}>
                {REVEAL_COPY.fingerprintDemo}
              </span>
            </p>
            <p className={revealStyles.fingerprintStatement}>
              <Link
                href="/how-it-is-sealed"
                className={revealStyles.fingerprintLink}
              >
                {REVEAL_COPY.fingerprintHowLink}
              </Link>
            </p>
          </>
        ) : (
          <p className={revealStyles.fingerprintStatement}>
            {REVEAL_COPY.fingerprintPassedCard}
          </p>
        )}
      </details>
      {isPersona && tamper !== undefined ? tamper : null}
    </section>
  );
}
