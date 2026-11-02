import Link from "next/link";
import { LIVE_COPY } from "@/components/reveal/copy";
import styles from "./live.module.css";

/**
 * The fixed note shown after stage 3 of a Live_Letter reveal (spec 06, R18.6).
 * It says the letter was locked for 30 seconds and points to the persona
 * letters at `/demo`. It makes no claim about whether any number changed.
 *
 * Every string comes from LIVE_COPY (R15.1). The note sits on the desk, so it
 * draws its own paper surface and sets its own text colour.
 */
export function LiveLockNote() {
  return (
    <div className={styles.lockNote}>
      <p>{LIVE_COPY.lockNote}</p>
      <p>
        <Link href="/demo" className={styles.lockNoteLink}>
          {LIVE_COPY.lockNoteLink}
        </Link>
      </p>
    </div>
  );
}
