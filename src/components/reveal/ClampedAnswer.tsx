"use client";

import { useId, useState } from "react";
import { REVEAL_COPY } from "./copy";
import styles from "./reveal.module.css";

/**
 * A judge's answer shown clamped to ANSWER_CLAMP_LINES_LETTER lines, with a
 * control that shows the full text (spec 11 P4.2).
 *
 * The full text is always in the DOM. Only the `answerClamped` class hides the
 * overflow, so the text stays searchable and readable without script. The
 * control is a plain button: it does not move focus, and it takes no autofocus,
 * so the heading that `focusTargetFor` chose keeps focus.
 *
 * The answer is the judge's own words, so it is a React text node inside
 * `data-user-content` (never HTML). It is not graded or compared (neutrality.md).
 */

export type ClampedAnswerProps = {
  /** The answer as recorded. */
  text: string;
  /** The element that holds the answer. */
  as: "p" | "span";
  /** Extra class names for the answer element, from reveal.module.css. */
  className: string;
};

export function ClampedAnswer({ text, as: Tag, className }: ClampedAnswerProps) {
  const [expanded, setExpanded] = useState(false);
  const textId = useId();
  const classes = expanded
    ? className
    : `${className} ${styles.answerClamped}`;

  return (
    <div>
      <Tag id={textId} className={classes} data-user-content="">
        {text}
      </Tag>
      <button
        type="button"
        className={styles.answerToggle}
        aria-expanded={expanded}
        aria-controls={textId}
        data-answer-toggle=""
        onClick={() => setExpanded((value) => !value)}
      >
        {expanded ? REVEAL_COPY.answerShowLess : REVEAL_COPY.answerShowFull}
      </button>
    </div>
  );
}
