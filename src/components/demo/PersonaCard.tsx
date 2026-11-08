import Link from "next/link";
import { Envelope } from "@/components/ceremony/envelope/Envelope";
import { DEMO_COPY } from "./copy";
import { formatCalendarDate, formatLetterDate } from "@/components/ui/letter-date";
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
 * A single persona on the Demo_Index page, drawn as one closed envelope with
 * the wax seal on its flap. The whole envelope is one real anchor to the
 * persona's letter (next/link), so it works without JavaScript. Its accessible
 * name is "Open {name}'s letter", which is also the text of the one orange
 * button inside it.
 *
 * The envelope drawing is the shared Envelope, turned to its back so the flap
 * and seal face the reader. The dates and names sit on a paper panel below the
 * drawing. The panel sets its own `--ink`, so the desk's light text never
 * reaches the paper. No date uses the accent colour, and no up or down
 * direction is coloured (neutrality.md).
 *
 * All words come from copy.ts and all dates from letter-date.ts (R15.1).
 */
export function PersonaCard({
  personaKey,
  display_name,
  region,
  written_as_of,
  opens_at,
}: PersonaCardProps) {
  const openedOn = formatLetterDate(opens_at, { kind: "utc" });
  const openLabel = DEMO_COPY.openLetterFor.replace("{name}", display_name);
  const buttonId = `persona-${personaKey}-open`;

  return (
    <Link
      href={`/demo/personas/${personaKey}`}
      className={styles.envelope}
      aria-labelledby={buttonId}
    >
      <span className={styles.art} aria-hidden="true">
        {/* A static end pose: no turn animation, so the flap and seal show on first paint. */}
        <Envelope state="turned" layout="narrow" animate={false} />
      </span>
      <span className={styles.paper}>
        <span className={styles.name}>{display_name}</span>
        <span className={styles.region}>{region}</span>
        <span className={styles.dates}>
          <span className={styles.dateRow}>
            <span className={styles.dateLabel}>{DEMO_COPY.writtenAsOfPrefix}</span>{" "}
            <span className={styles.dateValue}>
              {formatCalendarDate(written_as_of)}
            </span>
          </span>
          <span className={styles.dateRow}>
            <span className={styles.dateLabel}>{DEMO_COPY.opensPrefix}</span>{" "}
            <span className={styles.dateValue}>{openedOn}</span>
          </span>
        </span>
        <span id={buttonId} className={styles.button}>
          {openLabel}
        </span>
      </span>
    </Link>
  );
}
