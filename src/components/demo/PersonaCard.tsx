import Link from "next/link";
import { ParchmentSurface } from "@/components/ui";
import { DEMO_COPY } from "./copy";
import { formatCalendarDate, formatUtcDate } from "./dates";
import styles from "./PersonaCard.module.css";

/**
 * The list fields shown for one persona on the Demo_Index page. These are the
 * ONLY fields a card may receive -- never the sealed payload contents (R6.6).
 * A card is a label and a way in, nothing from inside the letter.
 *
 * The persona's `key` arrives as `personaKey`, because `key` is reserved by
 * React and cannot be read back as a prop.
 */
export type PersonaCardProps = {
  /** The persona's stable key, used in the link to its sealed letter. */
  personaKey: string;
  /** The persona's display name. */
  display_name: string;
  /** The persona's region, in plain words. */
  region: string;
  /** The date the letter was written as of, as `YYYY-MM-DD`. */
  written_as_of: string;
  /** The ISO UTC instant the letter opens. */
  opens_at: string;
};

/**
 * A single persona entry on the Demo_Index page (R6.2, R6.7). Pure
 * presentational server component: no "use client", no state, no data access.
 *
 * All label prefixes come from copy.ts and all dates from dates.ts, so no
 * user-facing literal lives here (R15.1). Styling is co-located and uses only
 * globals.css ink tokens -- AA contrast, no directional or judgement colour
 * (neutrality.md).
 */
export function PersonaCard({
  personaKey,
  display_name,
  region,
  written_as_of,
  opens_at,
}: PersonaCardProps) {
  return (
    <ParchmentSurface as="article" tone="deep" className={styles.card}>
      <h2 className={styles.name}>{display_name}</h2>
      <p className={styles.region}>{region}</p>
      <dl className={styles.dates}>
        <div className={styles.dateRow}>
          <dt className={styles.dateLabel}>{DEMO_COPY.writtenAsOfPrefix}</dt>
          <dd className={styles.dateValue}>
            {formatCalendarDate(written_as_of)}
          </dd>
        </div>
        <div className={styles.dateRow}>
          <dt className={styles.dateLabel}>{DEMO_COPY.opensPrefix}</dt>
          <dd className={styles.dateValue}>{formatUtcDate(opens_at)}</dd>
        </div>
      </dl>
      <Link className={styles.breakSeal} href={`/demo/personas/${personaKey}`}>
        {DEMO_COPY.breakSeal}
      </Link>
    </ParchmentSurface>
  );
}
