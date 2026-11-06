// Feature: 08-judge-polish (R18), 09-demo-polish (F4)
//
// The How_Page at /how-it-is-sealed. A server component on the plain Scene
// shell (design.md "Pages and the Top_Bar"): the Top_Bar with the wordmark link
// to /, and no Demo chip, backdrop or controls. The footer comes from layout.tsx.
//
// It opens with "How the seal works" and the Seal_Mapping table from
// Brand_Copy, then shows its sections in their existing order. It imports
// nothing from src/lib/crypto, src/lib/cards or src/lib/ics (R18.7). Its text is
// in src/components/how/copy.ts, and the table rows are in Brand_Copy.

import { BRAND_COPY } from "@/components/brand/copy";
import { SceneShell } from "@/components/ceremony/scene/SceneShell";
import { HOW_COPY } from "@/components/how/copy";
import { UI_COPY } from "@/components/ui/copy";
import { pageMetadata } from "@/lib/page-metadata";

import styles from "./page.module.css";

export const metadata = pageMetadata(UI_COPY.pageMeta.howItIsSealed, "/how-it-is-sealed");

export default function HowItIsSealedPage() {
  return (
    <SceneShell variant="plain" demo={false}>
      <div className={styles.page}>
        <h1 className={styles.heading}>{HOW_COPY.heading}</h1>
        <table className={styles.mapping}>
          <thead>
            <tr>
              <th scope="col">{HOW_COPY.mappingHeaders.seal}</th>
              <th scope="col">{HOW_COPY.mappingHeaders.revenant}</th>
            </tr>
          </thead>
          <tbody>
            {BRAND_COPY.sealMapping.map((row) => (
              <tr key={row.seal}>
                <td>{row.seal}</td>
                <td>{row.revenant}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
