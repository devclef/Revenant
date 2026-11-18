"use client";

import { WaxSeal } from "@/components/ui/WaxSeal";

import type { Checklist } from "./checklist";
import { DESK_COPY } from "./copy";
import styles from "./panel.module.css";

export interface InTheEnvelopeCardProps {
  /** The checklist values for the draft (W9.5). */
  checklist: Checklist;
  /** True when the Write_Check passes. The small seal is then at full opacity (W9.4). */
  ready: boolean;
}

const EYEBROW_ID = "live-in-envelope-heading";

/** The round marker of one Checklist_Line. Hidden from assistive tech (W9.6). */
function Marker({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={on ? styles.markerOn : styles.markerOff}
      data-marker={on ? "on" : "off"}
    >
      {on ? "✓" : ""}
    </span>
  );
}

/**
 * The "In the envelope" card (spec 14, W9): a small envelope with the Blank
 * Signet, then three Checklist_Lines. Below 600 px the lines collapse into one
 * phone line. The card is not a live region, so the checklist never announces
 * each keystroke.
 */
export function InTheEnvelopeCard({ checklist, ready }: InTheEnvelopeCardProps) {
  const lines = [
    {
      key: "letter",
      label: DESK_COPY.checkLetter,
      value: checklist.letter,
      present: checklist.present.letter,
    },
    {
      key: "questions",
      label: DESK_COPY.checkQuestions,
      value: checklist.questions,
      present: checklist.present.questions,
    },
    {
      key: "receipt",
      label: DESK_COPY.checkReceipt,
      value: checklist.receipt,
      present: checklist.present.receipt,
    },
  ] as const;

  return (
    <section
      className={styles.card}
      data-in-envelope=""
      aria-labelledby={EYEBROW_ID}
    >
      <p id={EYEBROW_ID} className={styles.eyebrow}>
        {DESK_COPY.inEnvelope}
      </p>
      <div className={styles.smallEnvelope} aria-hidden="true">
        <span className={styles.smallFlap} />
        <span
          className={styles.smallSeal}
          data-small-seal=""
          data-ready={ready ? "" : undefined}
        >
          <WaxSeal size={52} />
        </span>
      </div>
      <ul className={styles.checklist}>
        {lines.map((line) => (
          <li key={line.key} className={styles.line} data-checklist={line.key}>
            <Marker on={line.present} />
            <span className={styles.label}>{line.label}</span>
            <span className={styles.value}>{line.value}</span>
          </li>
        ))}
      </ul>
      <p className={styles.phoneLine}>{checklist.phoneLine}</p>
    </section>
  );
}
