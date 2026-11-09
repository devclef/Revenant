import Link from "next/link";

import { DemoLabel } from "@/components/demo/DemoLabel";

import { LIVE_COPY } from "./copy";
import styles from "./live.module.css";

/**
 * Shown on `/demo/live` when RP_ID is empty (R12.8). The live demo needs a
 * passkey relying-party ID, so without one the page explains that sealing is
 * not available and links back to the demo. It renders no seal control. The
 * panel sets its own ink colour, as every paper panel does.
 */
export function Unavailable() {
  return (
    <section
      className={styles.panel}
      aria-labelledby="live-unavailable-heading"
      data-paper=""
    >
      <DemoLabel />
      <h1 id="live-unavailable-heading" className={styles.heading}>
        {LIVE_COPY.heading}
      </h1>
      <p className={styles.intro}>{LIVE_COPY.unavailable}</p>
      <Link href="/demo" className={styles.backLink}>
        {LIVE_COPY.backToDemo}
      </Link>
    </section>
  );
}
