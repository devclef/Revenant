import Link from "next/link";

import { DEMO_COPY } from "./copy";
import paperStyles from "./PersonaCard.module.css";
import styles from "./LiveEntry.module.css";

/**
 * The live demo entry at `/demo/live` (R12.1), drawn as the last card in the
 * Persona_List on the Demo_Index page. It is one `li` that takes the persona
 * card's paper class, so it sits on the same paper as the persona cards and
 * sets its own `--ink` and `--ink-soft`. Its link uses the persona card's orange
 * button class. It is a server-rendered link with no client JavaScript. Its
 * words come from copy.ts (R15.1). The page renders it inside the `ul`.
 */
export function LiveEntry() {
  return (
    <li
      className={`${paperStyles.paper} ${styles.card}`}
      data-live-entry-card=""
    >
      <h2 id="live-entry-heading" className={styles.heading}>
        {DEMO_COPY.liveEntryHeading}
      </h2>
      <p className={styles.body}>{DEMO_COPY.liveEntryBody}</p>
      <Link
        href="/demo/live"
        className={`${paperStyles.button} ${styles.link}`}
      >
        {DEMO_COPY.liveEntryLink}
      </Link>
    </li>
  );
}
