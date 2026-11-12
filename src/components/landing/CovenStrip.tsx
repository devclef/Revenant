// Feature: 09-demo-polish (B3.5)
//
// The Coven_Strip: a heading and two links to GitHub. It takes no props and
// shows no counts, so it reads no build-time data.

import { LANDING_SECTION_COPY } from "./copy";
import styles from "./landing.module.css";

/** The two links of B3.5. Plain GitHub URLs, no tracking parameters. */
export const COVEN_LINKS = {
  kiro: "https://github.com/devclef/Revenant/tree/main/.kiro",
  loop: "https://github.com/devclef/Revenant/blob/main/docs/agent-loop.md",
} as const;

export function CovenStrip() {
  return (
    <section className={styles.section} aria-labelledby="coven-title">
      <h2 id="coven-title" className={styles.sectionTitle}>
        {LANDING_SECTION_COPY.covenTitle}
      </h2>
      <ul className={styles.covenLinks}>
        <li>
          <a
            className={styles.covenLink}
            href={COVEN_LINKS.kiro}
            rel="noreferrer noopener"
            target="_blank"
          >
            {LANDING_SECTION_COPY.covenKiroLink}
          </a>
        </li>
        <li>
          <a
            className={styles.covenLink}
            href={COVEN_LINKS.loop}
            rel="noreferrer noopener"
            target="_blank"
          >
            {LANDING_SECTION_COPY.covenLoopLink}
          </a>
        </li>
      </ul>
    </section>
  );
}
