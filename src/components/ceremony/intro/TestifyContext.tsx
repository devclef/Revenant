// Feature: 10-own-questions (C1.4, C4.3, C4.10)
//
// The Testify_Context: the short block above the first recall question that
// says what the reader is looking at before they answer. On a persona letter
// it names the fictional persona, who wrote the letter, when it was written and
// when it opens. On a Live_Letter or Real_Letter it shows only the seal line.
// Both end with the seal-verified statement, so the reader knows the letter has
// not changed since it was sealed (C1.4).
//
// Server-safe: no hooks, no browser APIs, no import from lib/crypto.

import { CEREMONY_COPY } from "../copy";
import { SCENE_COPY } from "../scene/copy";
import { REVEAL_COPY } from "@/components/reveal/copy";
import { formatCalendarDate, formatCalendarMonth, formatLetterDate } from "@/components/ui/letter-date";

import styles from "./intro.module.css";

/** Between the written-as-of and opens dates on the one line (C4.3). */
const DATE_SEPARATOR = " · ";

export type TestifyContextProps =
  | {
      kind: "persona";
      /** The persona's display name, for the notice and \"A letter from\" line. */
      personaName: string;
      /** YYYY-MM-DD (Persona_List `written_as_of`). */
      writtenAsOf: string;
      /** UTC instant (Persona_List `opens_at`). */
      opensAt: string;
    }
  | { kind: "letter" };

/** Fill `{name}` in a copy string. */
function fillName(template: string, name: string): string {
  return template.replace("{name}", name);
}

export function TestifyContext(props: TestifyContextProps) {
  if (props.kind === "letter") {
    return (
      <section className={styles.testify} data-testify-context="" data-block="testify-context">
        <p className={styles.testifySeal}>{REVEAL_COPY.sealIntact}</p>
      </section>
    );
  }

  const writtenText = CEREMONY_COPY.envelopeWrittenAsOf.replace(
    "{date}",
    formatCalendarDate(props.writtenAsOf),
  );
  const opensText = CEREMONY_COPY.envelopeOpens.replace(
    "{date}",
    formatLetterDate(props.opensAt, { kind: "utc" }),
  );

  return (
    <section className={styles.testify} data-testify-context="" data-block="testify-context">
      <p className={styles.testifyNotice}>{fillName(SCENE_COPY.personaNotice, props.personaName)}</p>
      <p className={styles.testifyFrom}>{fillName(REVEAL_COPY.contextFrom, props.personaName)}</p>
      <p className={styles.testifyDates}>{`${writtenText}${DATE_SEPARATOR}${opensText}`}</p>
      <p className={styles.testifySeal}>{REVEAL_COPY.sealIntact}</p>
      <p className={styles.testifyMemory} data-memory-line="">
        {REVEAL_COPY.memoryLine.replace("{month}", formatCalendarMonth(props.writtenAsOf))}
      </p>
    </section>
  );
}
