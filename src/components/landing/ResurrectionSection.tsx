// Feature: 09-demo-polish (F6.1, B3.3)
//
// What we resurrected: the pli cacheté story in at most four sentences, then
// the four Seal_Mapping rows from the Brand_Copy module. The paragraph names no
// historical number or date, so it links to no source (B3.3).

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
      <table className={styles.sealTable} data-block="seal-mapping">
        <thead>
          <tr>
            <th scope="col">Part of the wax seal</th>
            <th scope="col">Its Revenant replacement</th>
          </tr>
        </thead>
        <tbody>
          {LANDING_SECTION_COPY.sealMapping.map((row) => (
            <tr key={row.seal}>
              <td data-label="Part of the wax seal">{row.seal}</td>
              <td data-label="Its Revenant replacement">{row.revenant}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
