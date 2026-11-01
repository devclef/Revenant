import type { Opened } from "./opening-machine";
import { formatCalendarDate, formatUtcDate } from "@/components/demo/dates";
import { REVEAL_COPY } from "./copy";
import styles from "./reveal.module.css";

/**
 * Stage 2 of the reveal (design.md "Reveal", R10.1-R10.4): what was written
 * then. It shows, in order and with nothing added:
 *
 * - "Written as of {date}" — only when the payload carries `written_as_of`
 *   (R10.2). The date is a `YYYY-MM-DD` calendar date, formatted UTC-pinned so
 *   the day never shifts under the viewer's timezone.
 * - The demo letter label, always (R10.3): it names the persona as fictional
 *   and says the letter was prepared later than its written-as-of date, so a
 *   reader can never mistake a demo letter for a real sealed one
 *   (data-integrity.md). The copy string `demoLetterLabel` (committed in
 *   copy.ts) carries a `{name}` placeholder, filled here from `personaName`.
 * - "Sealed for the demo on {sealedAt}" from the envelope header (R10.4),
 *   formatted UTC-pinned from the millisecond-`Z` instant the header carries.
 * - The letter text in a `<p className={styles.letter}>`; the stylesheet sets
 *   `white-space: pre-wrap`, so the letter's own line breaks and spacing are
 *   preserved exactly. The text is a `{expression}` child read straight from
 *   the sealed payload — never an authored literal (R15.1).
 *
 * No commentary, grade or summary is added to the letter (neutrality.md): only
 * these elements appear. This component holds no state, reads no clock, logs
 * nothing and touches no storage; every date comes from the demo date helper
 * and every user-facing string from copy.ts.
 *
 * `personaName` is required because `demoLetterLabel`'s `{name}` placeholder
 * must be filled and the `Opened` letter carries no persona name — the name
 * lives on the persona list and is already threaded through `OpeningFlow`.
 */

export type SealedLetterProps = {
  /** The opened letter; its payload holds the sealed text and its header the seal date. */
  opened: Opened;
  /** The persona's display name, used only to fill `demoLetterLabel`'s `{name}` (R10.3). */
  personaName: string;
};

export function SealedLetter({ opened, personaName }: SealedLetterProps) {
  const { payload, header } = opened;

  const writtenAsOf =
    payload.written_as_of === undefined
      ? undefined
      : REVEAL_COPY.writtenAsOfPrefix.replace(
          "{date}",
          formatCalendarDate(payload.written_as_of),
        );

  const demoLabel = REVEAL_COPY.demoLetterLabel.replace("{name}", personaName);

  const sealedForDemoOn = REVEAL_COPY.sealedForDemoOn.replace(
    "{sealedAt}",
    formatUtcDate(header.sealedAt),
  );

  return (
    <section className={styles.sealedLetter}>
      <h2 tabIndex={-1}>{REVEAL_COPY.stage2Title}</h2>

      {writtenAsOf === undefined ? null : (
        <p className={styles.period}>{writtenAsOf}</p>
      )}

      <p>
        <span className={styles.fixtureLabel}>{demoLabel}</span>
      </p>

      <p className={styles.period}>{sealedForDemoOn}</p>

      <p className={styles.letter} data-ink-text>{payload.letter_text}</p>
    </section>
  );
}
