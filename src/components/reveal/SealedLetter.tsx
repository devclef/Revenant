import type { Opened } from "./opening-machine";
import { formatCalendarDate, formatLetterDate } from "@/components/ui/letter-date";
import { formatLocalDateTime } from "@/components/live/format";
import { WaxSeal } from "@/components/ui/WaxSeal";
import { LIVE_COPY, REVEAL_COPY } from "./copy";
import styles from "./reveal.module.css";

/**
 * Stage 2 of the reveal (design.md "Reveal", R10.1-R10.4): what was written
 * then. It shows, in order and with nothing added:
 *
 * - The Letter_Disclosure line, one line for a persona letter: the persona is
 *   fictional and the letter was written as of its date (`written_as_of`,
 *   R10.2, R10.3, spec 09 C6.3). It is omitted when the payload has no date.
 * - "Sealed for this demo on {sealedAt}" from the envelope header (R10.4,
 *   spec 09 C6.3), formatted UTC-pinned from the millisecond-`Z` instant.
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
  /**
   * `"persona"` (default) is the demo letter with its demo labels. `"live"` is
   * a Live_Letter: one local seal line and the letter text, no demo wording
   * (spec 06, R18.2).
   */
  variant?: "persona" | "live";
  /**
   * The live letter's id. In live mode it is the seal's pattern key, so each
   * live letter gets its own seal look. Ignored by the persona variant.
   */
  letterId?: string;
  /**
   * When true, the letter text sits in a closed disclosure, so the figures
   * Stage starts near the first Receipt_Card on the phone (P6, P7). The text
   * is kept in the document and opens on one tap.
   */
  collapsible?: boolean;
};

export function SealedLetter({
  opened,
  personaName,
  variant = "persona",
  letterId,
  collapsible = false,
}: SealedLetterProps) {
  const letterText = (
    <p className={styles.letter} data-letter-text="">
      {opened.payload.letter_text}
    </p>
  );
  const letterBody = collapsible ? (
    <details className={styles.letterDisclosure} data-letter-disclosure="">
      <summary>{REVEAL_COPY.letterDisclosureSummary}</summary>
      {letterText}
    </details>
  ) : (
    letterText
  );

  const { payload, header } = opened;

  if (variant === "live") {
    return (
      <section className={styles.sealedLetter}>
        <h2 tabIndex={-1}>{REVEAL_COPY.stage2Title}</h2>

        {letterId === undefined ? null : <WaxSeal patternKey={letterId} size={48} />}

        <p className={styles.period}>
          {LIVE_COPY.sealedOn.replace(
            "{sealedAt}",
            formatLocalDateTime(header.sealedAt),
          )}
        </p>

        <p className={styles.letter} data-letter-text="">{payload.letter_text}</p>
      </section>
    );
  }

  // The Letter_Disclosure names the persona as fictional and gives the
  // written-as-of date in one line (C6.3). It replaces the separate "Written
  // as of" line and the demo note. Without a written-as-of date the line is
  // not shown, rather than shown with a made-up date.
  const disclosure =
    payload.written_as_of === undefined
      ? undefined
      : REVEAL_COPY.letterDisclosure
          .replace("{name}", personaName)
          .replace("{writtenAsOf}", formatCalendarDate(payload.written_as_of));

  const sealedForThisDemo = REVEAL_COPY.sealedForThisDemo.replace(
    "{sealedAt}",
    formatLetterDate(header.sealedAt, { kind: "utc" }),
  );

  return (
    <section className={styles.sealedLetter}>
      <h2 tabIndex={-1}>{REVEAL_COPY.stage2Title}</h2>

      {disclosure === undefined ? null : (
        <p className={styles.period} data-persona-disclosure="">
          {disclosure}
        </p>
      )}

      <p className={styles.period}>{sealedForThisDemo}</p>

      {letterBody}
    </section>
  );
}
