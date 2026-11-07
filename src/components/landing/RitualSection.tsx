// Feature: 09-demo-polish (B3.2)
//
// The ritual: five plain rectangular cards from the Brand_Copy ritual steps,
// each with its number, name and one-line description. No arch, gravestone,
// moon, bat, cobweb or arrow (tone.md).

import { BRAND_COPY } from "@/components/brand/copy";

import { LANDING_SECTION_COPY } from "./copy";
import styles from "./landing.module.css";

export function RitualSection() {
  return (
    <section className={styles.section} aria-labelledby="ritual-title">
      <h2 id="ritual-title" className={styles.sectionTitle}>
        {LANDING_SECTION_COPY.ritualTitle}
      </h2>
      <ol className={styles.ritualList} data-block="ritual">
        {BRAND_COPY.ritualSteps.map((step, index) => (
          <li key={step.name} className={styles.ritualCard}>
            <span className={styles.ritualNumber}>{index + 1}</span>
            <h3 className={styles.ritualName}>{step.name}</h3>
            <p className={styles.ritualLine}>{step.line}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
