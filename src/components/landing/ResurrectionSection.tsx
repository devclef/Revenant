// Feature: 09-demo-polish (F6.1, B3.3), changed by 16 task 15
//
// What we resurrected: the wax seal in one sentence, then the one thing no wax
// seal could do, then the maker's story under "Why I built it". The paragraphs
// name no historical number or date, so they link to no source (B3.3). The
// seal mapping table is on /how-it-is-sealed, not here.

import { LANDING_SECTION_COPY } from "./copy";
import styles from "./landing.module.css";

export function ResurrectionSection() {
  return (
    <section className={styles.section} aria-labelledby="resurrected-title">
      <h2 id="resurrected-title" className={styles.sectionTitle}>
        {LANDING_SECTION_COPY.resurrectedTitle}
      </h2>
      {LANDING_SECTION_COPY.resurrectedBody.map((sentence) => (
        <p key={sentence} className={styles.body}>
          {sentence}
        </p>
      ))}
      <p className={styles.body}>{LANDING_SECTION_COPY.noSealBody}</p>
      <h3 className={styles.makerTitle}>{LANDING_SECTION_COPY.makerTitle}</h3>
      <p className={styles.body}>{LANDING_SECTION_COPY.makerBody}</p>
    </section>
  );
}
