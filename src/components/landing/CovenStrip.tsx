// Feature: 09-demo-polish (B3.5, B3.6)
//
// The Coven_Strip: the four Kiro_Stats counts and two links to GitHub. A null
// count is hidden, never shown as a number (B3.6). Counts are computed at build
// time by src/lib/kiro-stats.ts and passed in as props. The type has the same
// shape as that module's KiroStats.

import { LANDING_SECTION_COPY } from "./copy";
import styles from "./landing.module.css";

export type KiroStats = {
  specs: number | null;
  steering: number | null;
  agents: number | null;
  hooks: number | null;
};

/** The two links of B3.5. Plain GitHub URLs, no tracking parameters. */
export const COVEN_LINKS = {
  kiro: "https://github.com/devclef/Revenant/tree/main/.kiro",
  loop: "https://github.com/devclef/Revenant/blob/main/docs/agent-loop.md",
} as const;

type CountForms = { one: string; other: string };

/** The singular or plural label for `n`, with `{n}` replaced by the count. */
export function countLabel(n: number, forms: CountForms): string {
  const template = n === 1 ? forms.one : forms.other;
  return template.replace("{n}", String(n));
}

export function CovenStrip({ stats }: { stats: KiroStats }) {
  const counts: { key: string; n: number; forms: CountForms }[] = [];
  const pairs: [string, number | null, CountForms][] = [
    ["specs", stats.specs, LANDING_SECTION_COPY.covenCounts.specs],
    ["steering", stats.steering, LANDING_SECTION_COPY.covenCounts.steering],
    ["agents", stats.agents, LANDING_SECTION_COPY.covenCounts.agents],
    ["hooks", stats.hooks, LANDING_SECTION_COPY.covenCounts.hooks],
  ];
  for (const [key, n, forms] of pairs) {
    if (n !== null) counts.push({ key, n, forms });
  }

  return (
    <section className={styles.section} aria-labelledby="coven-title">
      <h2 id="coven-title" className={styles.sectionTitle}>
        {LANDING_SECTION_COPY.covenTitle}
      </h2>
      {counts.length === 0 ? null : (
        <ul className={styles.covenList} data-block="coven-counts">
          {counts.map((c) => (
            <li key={c.key} className={styles.covenCount}>
              {countLabel(c.n, c.forms)}
            </li>
          ))}
        </ul>
      )}
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
