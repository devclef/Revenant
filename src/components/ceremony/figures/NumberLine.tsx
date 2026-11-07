"use client";

// Feature: 05-reveal-ceremony, Task 4 (task 2 of the number-line work),
// extended by 08-judge-polish task 2 (R5 Number_Line labels).
//
// NumberLine: the drawn range for one comparable figure pair (design.md
// "Number_Line geometry", "What the Number_Line draws", R10.6, R12.1-R12.4).
//
// The geometry comes from number-line.ts. This component only places things:
//  - the axis, ascending left to right, with no numbers of its own (R12.4);
//  - a pin from the then Stamp (above) and from the now Stamp (below);
//  - the Mark, when the judge gave an answer. With no answer there is no Mark
//    element at all (R12.1).
//  - three visible labels, "Then", "Now" and "Your answer {value} {unit}" (or
//    "No answer"), placed by line-labels.ts (spec 08 R5).
//
// The three positions reach the markup only through --pos-then, --pos-now and
// --pos-mark (Property 11, R10.3). The Mark's position is clamped to the
// range by number-line.ts. The markup has no edge flag, so a Mark beyond
// either end renders the same as one at the other end (R12.3, Property 12).
//
// Label widths and the line width are estimated for the server render and the
// first client render. After mount they are measured, once the fonts are
// ready and again on resize, and the same placeLineLabels call runs each time.
//
// The axis, pins and Mark stroke are aria-hidden. The visible labels are
// aria-hidden too. The text alternative on the root (role="img") names all
// three points (R5.8).

import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

import {
  LABEL_CHAR_PX,
  LINE_LABEL_MAX_PX,
  LINE_LABEL_ROW_EM,
  LINE_LABEL_TOP_REM,
  LINE_MIN_PX,
} from "../constants";
import { CEREMONY_COPY } from "../copy";
import { numberLineGeometry } from "./number-line";
import { placeLineLabels, type LabelBox } from "./line-labels";
import { answerText } from "../recall/answer-text";
import styles from "./figures.module.css";

export type NumberLineProps = {
  /** The then value, as the figure's value string. Drives the range. */
  thenValue: string;
  /** The now value, as the figure's value string. Drives the range. */
  nowValue: string;
  /** The then value as shown to the reader, for the text alternative only. */
  thenShown: string;
  /** The now value as shown to the reader, for the text alternative only. */
  nowShown: string;
  /** The period of the then figure, for the text alternative only. */
  thenPeriod: string;
  /** The period of the now figure, for the text alternative only. */
  nowPeriod: string;
  /**
   * The Mark's value, as the judge typed it (the Recall_Record answer), or
   * `undefined` for "No answer". With `undefined` no Mark element is drawn.
   */
  markValue?: string;
  /** The figure's unit, shown in the Mark's hidden text and the labels. */
  unit: string;
};

type Measured = { lineWidth: number; widths: readonly [number, number, number] };

// The estimate for the server render and the first client render (R5.3).
function estimateWidth(lines: readonly string[]): number {
  const longest = Math.max(...lines.map((line) => line.length));
  return Math.min(LINE_LABEL_MAX_PX, Math.ceil(longest * LABEL_CHAR_PX));
}

function rowTop(row: number): string {
  return `calc(${LINE_LABEL_TOP_REM}rem + ${row * LINE_LABEL_ROW_EM}em)`;
}

export function NumberLine({
  thenValue,
  nowValue,
  thenShown,
  nowShown,
  thenPeriod,
  nowPeriod,
  markValue,
  unit,
}: NumberLineProps) {
  const geometry = numberLineGeometry(thenValue, nowValue, markValue);

  // Only the three position variables. Set --pos-mark only when there is a Mark.
  const style: Record<string, string> = {
    "--pos-then": String(geometry.posThen),
    "--pos-now": String(geometry.posNow),
  };
  if (geometry.posMark !== undefined) {
    style["--pos-mark"] = String(geometry.posMark);
  }

  const shownMark = markValue === undefined ? undefined : answerText(markValue);

  const markText =
    shownMark === undefined
      ? undefined
      : CEREMONY_COPY.markAnswer.replace("{value}", shownMark).replace("{unit}", unit);

  const answerLines =
    shownMark === undefined
      ? [CEREMONY_COPY.lineNoAnswer]
      : [`${shownMark} ${unit}`];
  const labelTexts = [
    [CEREMONY_COPY.lineThen],
    [CEREMONY_COPY.lineNow],
    answerLines,
  ] as const;
  const estimated: readonly [number, number, number] = [
    estimateWidth(labelTexts[0]),
    estimateWidth(labelTexts[1]),
    estimateWidth(labelTexts[2]),
  ];

  const rootRef = useRef<HTMLDivElement>(null);
  const labelRefs = useRef<Array<HTMLSpanElement | null>>([null, null, null]);
  const [measured, setMeasured] = useState<Measured | null>(null);

  // Re-measure whenever the words change, so a new width is always read.
  const textKey = `${thenValue}|${nowValue}|${markValue ?? ""}|${unit}`;
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    let alive = true;
    const measure = () => {
      if (!alive) return;
      const widths = labelRefs.current.map(
        (span, i) => Math.ceil(span?.offsetWidth || estimated[i]),
      ) as unknown as readonly [number, number, number];
      setMeasured({ lineWidth: root.clientWidth || LINE_MIN_PX, widths });
    };
    measure();
    document.fonts?.ready.then(measure);
    window.addEventListener("resize", measure);
    return () => {
      alive = false;
      window.removeEventListener("resize", measure);
    };
    // The estimate depends only on the label text, which textKey covers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textKey]);

  const lineWidth = measured?.lineWidth ?? LINE_MIN_PX;
  const widths = measured?.widths ?? estimated;
  const boxes: readonly [LabelBox, LabelBox, LabelBox] = placeLineLabels({
    positions: [geometry.posThen, geometry.posNow, geometry.posMark ?? 1],
    widths,
    lineWidth,
  });

  const fill = (template: string, values: Readonly<Record<string, string>>): string =>
    template.replace(/\{(\w+)\}/g, (_match, key: string) => values[key] ?? "");

  const altText =
    markValue === undefined
      ? fill(CEREMONY_COPY.numberLineAltNoAnswer, {
          then: thenShown,
          now: nowShown,
          thenPeriod,
          nowPeriod,
          unit,
        })
      : fill(CEREMONY_COPY.numberLineAlt, {
          then: thenShown,
          now: nowShown,
          thenPeriod,
          nowPeriod,
          answer: shownMark ?? "",
          unit,
        });

  const labelStyle = (box: LabelBox): CSSProperties => ({
    left: `${box.x}px`,
    top: rowTop(box.row),
  });

  const markStyle = style as CSSProperties;

  return (
    <div
      ref={rootRef}
      className={styles.numberLine}
      style={markStyle}
      role="img"
      aria-label={altText}
    >
      <span className={styles.axis} aria-hidden="true" />
      <span className={styles.pinThen} aria-hidden="true" />
      <span className={styles.pinNow} aria-hidden="true" />
      {markText === undefined ? null : (
        <span className={styles.markWrap}>
          <span className={styles.markStroke} aria-hidden="true" />
          <span className={styles.srOnly}>{markText}</span>
        </span>
      )}
      <span
        ref={(el) => {
          labelRefs.current[0] = el;
        }}
        className={`${styles.lineLabel} ${styles.lineLabelMuted}`}
        style={labelStyle(boxes[0])}
        data-line-label="then"
        aria-hidden="true"
      >
        {CEREMONY_COPY.lineThen}
      </span>
      <span
        ref={(el) => {
          labelRefs.current[1] = el;
        }}
        className={`${styles.lineLabel} ${styles.lineLabelMuted}`}
        style={labelStyle(boxes[1])}
        data-line-label="now"
        aria-hidden="true"
      >
        {CEREMONY_COPY.lineNow}
      </span>
      <span
        ref={(el) => {
          labelRefs.current[2] = el;
        }}
        className={`${styles.lineLabel} ${styles.lineLabelAccent}`}
        style={labelStyle(boxes[2])}
        data-line-label="answer"
        aria-hidden="true"
      >
        {shownMark === undefined ? CEREMONY_COPY.lineNoAnswer : `${shownMark} ${unit}`}
      </span>
    </div>
  );
}
