/**
 * The Text_Persona's `recall` Stage (spec 11 P1.6, design.md "Text_Persona
 * flow"): one question at a time, each with her answer and the Fictional_Label.
 * There is no answer field, no "No answer" control, no Sample_Answer, no
 * "Record my answers" and no Memory_Line. The judge reads, then goes on. Nothing
 * here is posted or stored.
 *
 * The control is "Next question" on every question but the last, and
 * "Break the seal" on the last. Both are one activation. Nothing highlights,
 * pairs, aligns, counts, scores or explains her answer against the letter
 * (neutrality.md). The wording never grades her answer.
 *
 * Every string comes from copy modules (R15.1). This component holds no state:
 * the index and the advance live in the reducer.
 */

import paper from "@/components/ui/paper.module.css";
import buttons from "@/components/ui/buttons.module.css";
import { formatCalendarDate, formatLetterDate } from "@/components/ui/letter-date";
import { REVEAL_COPY } from "@/components/reveal/copy";
import { CEREMONY_COPY } from "../copy";
import { TestifyContext, type TestifyContextProps } from "../intro/TestifyContext";
import introStyles from "../intro/intro.module.css";
import type { TestimonyEntry } from "@/components/reveal/opening-machine";
import styles from "./RecallReader.module.css";

type PersonaTestify = Extract<TestifyContextProps, { kind: "persona" }>;

/**
 * The persona Testify_Context for the reading walk (spec 11 P1.6). It has the
 * same lines as TestifyContext, the notice, "A letter from", the two dates and
 * the seal line, but no Memory_Line: the judge answers nothing on this walk.
 * It is written here, not in TestifyContext, so the recall walk keeps its
 * Memory_Line unchanged.
 */
function ReadingTestify({ testify }: { testify: PersonaTestify }) {
  const writtenText = CEREMONY_COPY.envelopeWrittenAsOf.replace(
    "{date}",
    formatCalendarDate(testify.writtenAsOf),
  );
  const opensText = CEREMONY_COPY.envelopeOpens.replace(
    "{date}",
    formatLetterDate(testify.opensAt, { kind: "utc" }),
  );
  return (
    <section
      className={introStyles.testify}
      data-testify-context=""
      data-block="testify-context"
    >
      <p className={introStyles.testifyNotice}>
        {CEREMONY_COPY.personaNotice.replace("{name}", testify.personaName)}
      </p>
      <p className={introStyles.testifyFrom}>
        {REVEAL_COPY.contextFrom.replace("{name}", testify.personaName)}
      </p>
      <p className={introStyles.testifyDates}>{`${writtenText} · ${opensText}`}</p>
      <p className={introStyles.testifySeal}>{REVEAL_COPY.sealIntact}</p>
    </section>
  );
}

export type RecallReaderProps = {
  /** Her questions and answers, in payload order. */
  testimony: readonly TestimonyEntry[];
  /** The question on screen, counting from 0. */
  index: number;
  /** Shows the next question. Not called on the last question. */
  onNext: () => void;
  /** Breaks the seal after the last question. */
  onReadDone: () => void;
  /** The persona's written-as-of date (`YYYY-MM-DD`), for the counter. */
  writtenAsOf?: string;
  /** The Testify_Context above the card. The Memory_Line is always off here. */
  testify?: TestifyContextProps;
};

export function RecallReader({
  testimony,
  index,
  onNext,
  onReadDone,
  writtenAsOf,
  testify,
}: RecallReaderProps) {
  const entry = testimony[index];
  if (entry === undefined) return null;
  const total = testimony.length;
  const isLast = index === total - 1;

  const counter = REVEAL_COPY.questionCounter
    .replace("{n}", String(index + 1))
    .replace("{total}", String(total));
  const asOf =
    writtenAsOf === undefined
      ? null
      : REVEAL_COPY.questionCounterAsOf.replace(
          "{date}",
          formatCalendarDate(writtenAsOf),
        );

  return (
    <>
      {testify === undefined ? null : testify.kind === "persona" ? (
        <ReadingTestify testify={testify} />
      ) : (
        <TestifyContext {...testify} />
      )}
      <section className={`${paper.paper} ${styles.reader}`} data-paper="" data-recall-reader="">
        <p className={styles.counter} data-fit="counter">
          {asOf === null ? (
            counter
          ) : (
            <>
              {counter}
              {REVEAL_COPY.questionCounterSeparator}
              <span className={styles.nowrap}>{asOf}</span>
            </>
          )}
        </p>
        <h2 tabIndex={-1} data-stage-heading="" className={styles.question}>
          {entry.question}
        </h2>
        <p className={styles.label} data-fictional-label="">
          {REVEAL_COPY.personaAnswerLabel}
        </p>
        <p className={styles.answer}>{entry.answer}</p>
        <div className={styles.controls}>
          <button
            type="button"
            className={buttons.primary}
            data-primary-control=""
            onClick={isLast ? onReadDone : onNext}
          >
            {isLast ? CEREMONY_COPY.sealButton : REVEAL_COPY.nextQuestion}
          </button>
        </div>
      </section>
    </>
  );
}
