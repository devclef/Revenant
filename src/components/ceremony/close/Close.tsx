// Feature: 07-judge-journey, spec 07 task 6 (design.md "Close")
//
// Close: the last Stage of the reveal. Reveal.tsx mounts it only once the
// figures have settled (R15.2). It reads no figure or answer and sends no
// event (R15.3, R15.5).
//
// Two kinds:
// - `persona`: the judge's closing items, in order: a heading, the Demo_2_On
//   link to /demo/live (only while demo2On), a small note, and "Start over" to
//   the same persona. Every string comes from CEREMONY_COPY (R15.1).
// - `live`: the spec 06 R18.6 note and link, rendered unchanged by
//   LiveLockNote (R15.6, R17.11).
//
// Every link is at least 44 px tall and keyboard reachable with a focus ring
// (R15.4, R19.6).

import { LiveLockNote } from "@/components/live/LiveLockNote";
import { CEREMONY_COPY } from "@/components/ceremony/copy";

import styles from "./close.module.css";

export type CloseProps =
  | {
      kind: "persona";
      personaKey: string;
      demo2On: boolean;
      /**
       * False for a letter with no official figures: the heading then reads
       * `closeLineNoFigures` (spec 11 L5.2). Defaults to true.
       */
      hasFigures?: boolean;
    }
  | {
      kind: "live";
      /** True when the letter holds at least one official figure (spec 06). */
      hasFigures?: boolean;
    }
  | { kind: "real" };

/** Where the Demo_2_On link leads: the passkey demo's seal page. */
export const DEMO_2_HREF = "/demo/live";

/** Where "Start over" leads for a persona: the same persona, a fresh load. */
export function startOverHref(personaKey: string): string {
  return `/demo/personas/${personaKey}`;
}

export function Close(props: CloseProps) {
  if (props.kind === "live") {
    return <LiveLockNote hasOfficialFigures={props.hasFigures === true} />;
  }
  if (props.kind === "real") {
    // A Real_Letter gets no close: no 30-second note and no demo links (spec 08, R24.11).
    return null;
  }

  return (
    <section className={styles.close}>
      <h2 className={styles.heading} data-close-line="">
        {props.hasFigures === false ? CEREMONY_COPY.closeLineNoFigures : CEREMONY_COPY.closeLine}
      </h2>
      {props.demo2On ? (
        <a className={styles.cta} href={DEMO_2_HREF}>
          {CEREMONY_COPY.closeLink}
        </a>
      ) : null}
      <p className={styles.small}>{CEREMONY_COPY.closeNote}</p>
      {/* A plain anchor, not next/link: a full fresh load replays the
          Emergence from `emerging` (R15.11). */}
      <a className={styles.quietLink} href={startOverHref(props.personaKey)}>
        {CEREMONY_COPY.startOver}
      </a>
    </section>
  );
}
