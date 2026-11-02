// Feature: 05-reveal-ceremony, issue #103
//
// Close: the last Stage of the ceremony (R12.9). Stage 3 renders it once the
// then and now Steps are done (Reveal.tsx gates it on `localView.step`). It
// shows only a heading, one line of copy and a link back to the desk. It never
// shows a summary, a score or a comment on the figures.
//
// Every word comes from CEREMONY_COPY (R15.1). The panel sets its own ink, so
// the text never inherits the desk's cream colour.

import Link from "next/link";

import { ParchmentSurface } from "@/components/ui";

import { CEREMONY_COPY } from "../copy";
import styles from "./close.module.css";

/** Where the Close link leads: back to the demo desk. */
export const CLOSE_HREF = "/demo";

export function Close() {
  return (
    <ParchmentSurface className={styles.close}>
      <h2 className={styles.heading}>{CEREMONY_COPY.closeTitle}</h2>
      <p className={styles.body}>{CEREMONY_COPY.closeBody}</p>
      <Link href={CLOSE_HREF} className={styles.link}>
        {CEREMONY_COPY.closeBack}
      </Link>
    </ParchmentSurface>
  );
}
