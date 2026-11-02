import Link from "next/link";

import { DEMO_COPY } from "./copy";
import styles from "./LiveEntry.module.css";

/**
 * The one link from the Demo_Index page to the live demo at `/demo/live`
 * (R12.1). It sits on the dark desk, so its text uses the desk tokens. It is a
 * server-rendered link with no client JavaScript. Its words come from copy.ts
 * (R15.1).
 */
export function LiveEntry() {
  return (
    <section className={styles.entry} aria-labelledby="live-entry-heading">
      <h2 id="live-entry-heading" className={styles.heading}>
        {DEMO_COPY.liveEntryHeading}
      </h2>
      <p className={styles.body}>{DEMO_COPY.liveEntryBody}</p>
      <Link href="/demo/live" className={styles.link}>
        {DEMO_COPY.liveEntryLink}
      </Link>
    </section>
  );
}
