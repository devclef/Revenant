import type { Opened } from "./opening-machine";
import { formatCalendarDate, formatLetterDate } from "@/components/ui/letter-date";
import { formatLocalDateTime } from "@/components/live/format";
import { WaxSeal } from "@/components/ui/WaxSeal";
import { LIVE_COPY, REVEAL_COPY } from "./copy";
import type { LetterKind } from "./FigureLine";
import styles from "./reveal.module.css";

/**
 * Stage 2 of the reveal (design.md "Reveal", R10.1-R10.4, spec 09 L6).
 *
 * The letter stage is split in two so the paper can hold the letter alone:
 *
 * - `SealedLetterCaption` is the Caption_Block, which sits on the dark above
 *   the paper: the Stage heading (a real `h2`), the Letter_Disclosure line and
 *   the "Sealed for this demo on {date}" line for a Persona_Letter, or the
 *   local "Sealed on {date and time}" line for a Live_Letter.
 * - `SealedLetterText` is the Letter_Text alone: one `<p>` whose only child is
 *   the sealed text, `white-space: pre-wrap` from the stylesheet.
 *
 * `SealedLetter` composes both for callers that want the whole stage in one
 * section. `LetterBlock` places the caption and the paper itself.
 *
 * No commentary, grade or summary is added to the letter (neutrality.md). This
 * module holds no state, reads no clock and logs nothing. Every date comes from
 * the date helpers and every user-facing string from copy.ts.
 *
 * `personaName` fills the Letter_Disclosure's `{name}`. The `Opened` letter
 * does not carry the persona name, so it is passed in from `OpeningFlow`.
 */

export type SealedLetterProps = {
  /** The opened letter; its payload holds the sealed text and its header the seal date. */
  opened: Opened;
  /** The persona's display name, used only to fill the Letter_Disclosure's `{name}` (R10.3). */
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
   * When true, the paper sits in a closed disclosure, so the figures Stage
   * starts near the first Receipt_Card on the phone (P6, P7). The paper is kept
   * in the document and opens on one tap. Used by `SealedLetter` only.
   */
  collapsible?: boolean;
};

export type SealedLetterCaptionProps = Omit<SealedLetterProps, "collapsible">;

/**
 * The Caption_Block: the heading and the labels that sit above the paper.
 * Renders no paper and no letter text.
 */
export function SealedLetterCaption({
  opened,
  personaName,
  variant = "persona",
  letterId,
}: SealedLetterCaptionProps) {
  const { header, payload } = opened;

  if (variant === "live") {
    return (
      <>
        <h2 tabIndex={-1} data-letter-heading="">
          {REVEAL_COPY.stage2Title}
        </h2>

        {letterId === undefined ? null : <WaxSeal patternKey={letterId} size={48} />}

        <p className={styles.period}>
          {LIVE_COPY.sealedOn.replace("{sealedAt}", formatLocalDateTime(header.sealedAt))}
        </p>
      </>
    );
  }

  // The Letter_Disclosure names the persona as fictional and gives the
  // written-as-of date in one line (C6.3). Without a written-as-of date the
  // line is not shown, rather than shown with a made-up date.
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
    <>
      <h2 tabIndex={-1} data-letter-heading="">
        {REVEAL_COPY.stage2Title}
      </h2>

      {disclosure === undefined ? null : (
        <p className={styles.period} data-persona-disclosure="">
          {disclosure}
        </p>
      )}

      <p className={styles.period}>{sealedForThisDemo}</p>
    </>
  );
}

/**
 * The Letter_Text alone: the sealed text as one text node in one paragraph.
 * A real, live or other non-persona letter carries `data-user-content`, so the
 * user's own words are marked apart from the demo labels. Persona letters do
 * not carry it.
 */
export function SealedLetterText({
  opened,
  letterKind = "persona",
}: {
  opened: Opened;
  letterKind?: LetterKind;
}) {
  const userContent = letterKind === "persona" ? undefined : "";
  return (
    <p className={styles.letter} data-letter-text="" data-user-content={userContent}>
      {opened.payload.letter_text}
    </p>
  );
}

export function SealedLetter({
  opened,
  personaName,
  variant = "persona",
  letterId,
  collapsible = false,
}: SealedLetterProps) {
  const letterText = <SealedLetterText opened={opened} />;
  const letterBody = collapsible ? (
    <details className={styles.letterDisclosure} data-letter-disclosure="">
      <summary>{REVEAL_COPY.letterDisclosureSummary}</summary>
      {letterText}
    </details>
  ) : (
    letterText
  );

  return (
    <section className={styles.sealedLetter}>
      <SealedLetterCaption
        opened={opened}
        personaName={personaName}
        variant={variant}
        letterId={letterId}
      />
      {letterBody}
    </section>
  );
}
