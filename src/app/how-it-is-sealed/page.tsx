// Feature: 08-judge-polish (R18)
//
// The How_Page at /how-it-is-sealed. A server component on the plain Scene
// shell (design.md "Pages and the Top_Bar"): the Top_Bar with the wordmark link
// to /, and no Demo chip, backdrop or controls. The footer comes from layout.tsx.
//
// It imports nothing from src/lib/crypto, src/lib/cards or src/lib/ics (R18.7).
// Its text is in src/components/how/copy.ts.

import { SceneShell } from "@/components/ceremony/scene/SceneShell";
import { HOW_COPY } from "@/components/how/copy";

import styles from "./page.module.css";

export default function HowItIsSealedPage() {
  return (
    <SceneShell variant="plain" demo={false}>
      <div className={styles.page}>
        <h1 className={styles.heading}>{HOW_COPY.heading}</h1>
        {HOW_COPY.sections.map((section) => (
          <section className={styles.section} key={section.id}>
            <h2 className={styles.subheading}>{section.title}</h2>
            <p className={styles.body}>{section.body}</p>
          </section>
        ))}
      </div>
    </SceneShell>
  );
}
