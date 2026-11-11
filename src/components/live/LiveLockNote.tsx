import Link from "next/link";
import { LIVE_COPY } from "./copy";
import styles from "./live.module.css";

export interface LiveLockNoteProps {
  /**
   * True when the letter holds at least one official figure. Only then does the
   * note offer the longer comparison. Self-reported numbers do not count.
   */
  hasOfficialFigures?: boolean;
}

/**
 * The fixed note shown after stage 3 of a Live_Letter reveal (spec 06, R18.6).
 * It says the letter was locked for 30 seconds and points to the persona
 * letters at `/demo`. The comparison line appears only with official figures.
 * It makes no claim about whether any number changed.
 *
 * Every string comes from LIVE_COPY (R15.1). The note sits on the desk, so it
 * draws its own paper surface and sets its own text colour.
 */
export function LiveLockNote({ hasOfficialFigures = false }: LiveLockNoteProps) {
  return (
    <div className={styles.lockNote}>
      <p>{LIVE_COPY.lockNote}</p>
      {hasOfficialFigures ? <p>{LIVE_COPY.lockNoteComparison}</p> : null}
      <p>
        <Link href="/demo" className={styles.lockNoteLink}>
          {LIVE_COPY.lockNoteLink}
        </Link>
      </p>
    </div>
  );
}
