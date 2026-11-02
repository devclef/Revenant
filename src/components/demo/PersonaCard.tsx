import { ParchmentSurface } from "@/components/ui";
import { DeskEnvelopeLink } from "@/components/ceremony/desk/DeskEnvelopeLink";
import { WaxSeal } from "@/components/ceremony/envelope/WaxSeal";
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
 * A single persona on the Demo_Index page (R6.2, R6.7), drawn as a sealed
 * envelope on the desk. The whole envelope is one real anchor to the persona's
 * letter (DeskEnvelopeLink), so it works without JavaScript and gets the desk
 * camera move in full motion. The wax seal is seeded by `personaKey` only.
 *
 * Requires a MotionProvider above it, because DeskEnvelopeLink reads the
 * motion mode. The Demo_Index page provides one through DeskScene.
 *
 * All label prefixes come from copy.ts and all dates from dates.ts, so no
 * user-facing literal lives here (R15.1). The paper panel sets its own ink
 * colour, so the desk's text colour never leaks onto it. No directional or
 * judgement colour anywhere (neutrality.md).
 */
export function PersonaCard({
  personaKey,
  display_name,
  region,
  written_as_of,
  opens_at,
}: PersonaCardProps) {
  return (
    <DeskEnvelopeLink
      href={`/demo/personas/${personaKey}`}
      className={styles.envelope}
    >
      <ParchmentSurface tone="deep" className={styles.card}>
        <span className={styles.seal} aria-hidden="true">
          <WaxSeal patternKey={personaKey} size={48} />
        </span>
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
        <span className={styles.openLetter}>{DEMO_COPY.openLetter}</span>
      </ParchmentSurface>
    </DeskEnvelopeLink>
  );
}
