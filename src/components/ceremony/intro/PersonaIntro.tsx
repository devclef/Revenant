// Feature: 09-demo-polish (C1.1, C1.2, P5.3)
//
// The Persona_Intro: the short card on the persona page that says who wrote
// the letter, when, what happens next and how long it takes. It takes every
// value from the Persona_List entry and the copy and constants. It shows
// nothing from the sealed payload, so it reads the same before and after the
// seal is broken (C1.2).
//
// Stage visibility is CSS, not props: the persona page places this card before
// OpeningFlow, and scene.module.css hides it once a later Stage (recall, marks,
// letter, figures, close) is on the page. So it shows in `emerging`, `sealed`
// and `intact`, the states the spec names.
//
// Below 600 px the first line is the fictional-persona notice (P5.3), which
// the Compact_Top_Bar no longer shows. At 600 px and wider the Top_Bar shows it
// (spec 07 R8.4), so this card hides it. The text is the same either way.
//
// Server-safe: no hooks, no browser APIs, no import from lib/crypto or
// lib/seal-format.

import { CEREMONY_COPY } from "../copy";
import { SCENE_COPY } from "../scene/copy";
import { formatCalendarDate, formatLetterDate } from "@/components/ui/letter-date";

import styles from "./intro.module.css";

/** The opening event as stored in the Persona_List (spec 09 C1.3). */
export type IntroEvent = {
  name: string;
  /** YYYY-MM-DD. */
  date: string;
  /** The official publisher's name, for example "U.S. National Archives". */
  source: string;
  /** An https link to a page that states the date. */
  source_url: string;
};

export type PersonaIntroProps = {
  /** The persona's display name, for the fictional-persona notice. */
  personaName: string;
  /** The one everyday line (Persona_List `intro_line`). */
  introLine: string;
  /** YYYY-MM-DD (Persona_List `written_as_of`). */
  writtenAsOf: string;
  /** UTC instant (Persona_List `opens_at`). */
  opensAt: string;
  /** Number of recall questions: `persona.metrics.length`, not the payload. */
  questionCount: number;
  /** The opening event, when the persona has one. */
  openingEvent?: IntroEvent;
  /**
   * FLOW_MINUTES, once the owner has measured the persona flow (spec 09 B1.7).
   * Until then the caller leaves it out and the time line does not show.
   */
  flowMinutes?: number;
};

/** The question count line for `n` questions. */
export function introQuestionsText(n: number): string {
  return n === 1
    ? CEREMONY_COPY.introQuestionsOne
    : CEREMONY_COPY.introQuestions.replace("{n}", String(n));
}

export function PersonaIntro({
  personaName,
  introLine,
  writtenAsOf,
  opensAt,
  questionCount,
  openingEvent,
  flowMinutes,
}: PersonaIntroProps) {
  const notice = SCENE_COPY.personaNotice.replace("{name}", personaName);
  const writtenText = CEREMONY_COPY.envelopeWrittenAsOf.replace(
    "{date}",
    formatCalendarDate(writtenAsOf),
  );
  const openDate = formatLetterDate(opensAt, { kind: "utc" });
  const opensText =
    openingEvent === undefined
      ? CEREMONY_COPY.envelopeOpens.replace("{date}", openDate)
      : CEREMONY_COPY.introOpensEvent
          .replace("{date}", openDate)
          .replace("{event}", openingEvent.name);

  return (
    <section className={styles.intro} data-persona-intro data-block="persona-intro">
      <p className={styles.notice}>{notice}</p>
      <p className={styles.line}>{introLine}</p>
      <p className={styles.dates}>
        <span>{writtenText}</span>
        <span>{opensText}</span>
      </p>
      {openingEvent === undefined ? null : (
        <p className={styles.source}>
          <a href={openingEvent.source_url} rel="noopener noreferrer">
            {CEREMONY_COPY.introEventSource.replace(
              "{source}",
              openingEvent.source,
            )}
          </a>
        </p>
      )}
      <p className={styles.meta}>
        <span>{introQuestionsText(questionCount)}</span>
        {flowMinutes === undefined ? null : (
          <span>
            {CEREMONY_COPY.introTime.replace("{minutes}", String(flowMinutes))}
          </span>
        )}
      </p>
    </section>
  );
}
