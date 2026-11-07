// Feature: 09-demo-polish (F6.2, F6.3)
//
// What no wax seal could do: at most three sentences, from landing/copy.ts.

import { LANDING_SECTION_COPY } from "./copy";
import styles from "./landing.module.css";

export function NoSealSection() {
  return (
    <section className={styles.section} aria-labelledby="no-seal-title">
      <h2 id="no-seal-title" className={styles.sectionTitle}>
        {LANDING_SECTION_COPY.noSealTitle}
      </h2>
      <p className={styles.body}>{LANDING_SECTION_COPY.noSealBody}</p>
    </section>
  );
}
