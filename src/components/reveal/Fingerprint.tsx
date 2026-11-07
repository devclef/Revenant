// Feature: 08-judge-polish (spec task 3, R14.3, R14.6, R14.8)
//
// The opening Fingerprint block. It sits in the Caption_Block of the `letter`
// Stage, on the desk surface (`--bg`), above the paper (spec 09 L6.2). It gives the reader their own receipt that the
// sealed letter has not changed: the same 16 groups of 4 hex characters that
// were printed on the letter card.
//
// - The heading is an `h3` ("Fingerprint at sealing"), so the focus rule's
//   newest `h1`/`h2` is unchanged (R14.3, design.md).
// - The 16 groups come from `formatFingerprint`, the one module that formats
//   and parses a fingerprint, so the card and the Reveal always show the exact
//   same string (R14.4, Property 16). They are shown in a monospace face, two
//   lines of 8 groups, with `translate="no"` so no browser translation ever
//   rewrites the hex.
// - "The seal check passed." is always shown (R14.3). This block is rendered
//   only after the envelope-hash check has passed; a failed check never reaches
//   the Reveal (R14.6), so this file carries no failure rendering.
// - A live or real letter adds the card sentence (its Fingerprint is printed on
//   the reader's card). A persona letter adds the "demo letter" label and no
//   card wording, because a persona letter has no card (R14.8).
//
// `formatFingerprint` can return `null` for a non-hex hash. A letter that
// opened always carries a verified 64-char lowercase hex hash, so `null` is not
// expected here; the block renders nothing in that case rather than show a
// malformed fingerprint. Every string comes from copy.ts (R15.1).

import Link from "next/link";
import { formatFingerprint } from "@/lib/seal-format";
import type { LetterKind } from "./FigureLine";
import { REVEAL_COPY } from "./copy";
import styles from "./reveal.module.css";

/** Split the 16 space-separated groups into two lines of 8. */
function twoLines(fingerprint: string): [string, string] {
  const groups = fingerprint.split(" ");
  return [groups.slice(0, 8).join(" "), groups.slice(8).join(" ")];
}

export type FingerprintProps = {
  /**
   * The verified envelope hash from `Opened.envelopeHash`: 64 lowercase hex
   * characters, the exact value `openLetter` checked before it returned ok
   * (R14.5). It is formatted into the 16 groups shown on the card and here.
   */
  envelopeHash: string;
  /**
   * The kind of opened letter (R14.8). A persona letter shows the "demo letter"
   * label and no card wording; a live or real letter shows the card sentence.
   */
  letterKind: LetterKind;
};

export function Fingerprint({ envelopeHash, letterKind }: FingerprintProps) {
  const fingerprint = formatFingerprint(envelopeHash);
  // A letter that opened carries a verified 64-char lowercase hex hash, so this
  // is defensive: a malformed hash shows no block rather than a broken one.
  if (fingerprint === null) return null;
  const [lineOne, lineTwo] = twoLines(fingerprint);

  // C6.4: a persona letter shows the verdict first, then a closed disclosure
  // that holds the fingerprint, the demo label and a link to the How_Page. A
  // persona letter has no card, so the card sentence is never shown here.
  if (letterKind === "persona") {
    return (
      <section className={styles.fingerprint} data-fingerprint-persona="">
        <p className={styles.sealVerdict}>{REVEAL_COPY.sealVerdict}</p>
        <details className={styles.fingerprintDisclosure}>
          <summary>{REVEAL_COPY.fingerprintShow}</summary>
          <p className={styles.fingerprintGroups} translate="no">
            <span className={styles.fingerprintLine}>{lineOne}</span>
            <span className={styles.fingerprintLine}>{lineTwo}</span>
          </p>
          <p className={styles.fingerprintStatement}>
            <span className={styles.fixtureLabel}>
              {REVEAL_COPY.fingerprintDemo}
            </span>
          </p>
          <p className={styles.fingerprintStatement}>
            <Link href="/how-it-is-sealed" className={styles.fingerprintLink}>
              {REVEAL_COPY.fingerprintHowLink}
            </Link>
          </p>
        </details>
      </section>
    );
  }

  return (
    <section className={styles.fingerprint} aria-labelledby="fp-title">
      <h3 id="fp-title" className={styles.fingerprintTitle}>
        {REVEAL_COPY.fingerprintTitle}
      </h3>
      <p className={styles.fingerprintGroups} translate="no">
        <span className={styles.fingerprintLine}>{lineOne}</span>
        <span className={styles.fingerprintLine}>{lineTwo}</span>
      </p>
      <p className={styles.fingerprintStatement}>
        {REVEAL_COPY.fingerprintPassed}
        {` ${REVEAL_COPY.fingerprintPassedCard}`}
      </p>
    </section>
  );
}
