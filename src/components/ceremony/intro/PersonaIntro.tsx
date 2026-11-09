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
// the states the spec names.
//
// The first line is the fictional-persona notice at every width (P5.3). Below
// 600 px the Compact_Top_Bar does not render it, so this card is the only place
// it shows there. At 600 px and wider the Top_Bar also shows it (spec 07 R8.4).
//
// Server-safe: no hooks, no browser APIs, no import from lib/crypto or
// lib/seal-format.

import { CEREMONY_COPY } from "../copy";
import { SCENE_COPY } from "../scene/copy";
import { formatCalendarDate, formatLetterDate } from "@/components/ui/letter-date";

import styles from "./intro.module.css";

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
  flowMinutes,
}: PersonaIntroProps) {
  const notice = SCENE_COPY.personaNotice.replace("{name}", personaName);
  const writtenText = CEREMONY_COPY.envelopeWrittenAsOf.replace(
    "{date}",
    formatCalendarDate(writtenAsOf),
  );
  const openDate = formatLetterDate(opensAt, { kind: "utc" });
  const opensText = CEREMONY_COPY.envelopeOpens.replace("{date}", openDate);

  return (
    <section className={styles.intro} data-persona-intro data-block="persona-intro">
      <p className={styles.notice}>{notice}</p>
      <p className={styles.line}>{introLine}</p>
      <p className={styles.dates}>
        <span>{writtenText}</span>
        <span>{opensText}</span>
      </p>
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
