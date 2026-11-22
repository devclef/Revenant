import { createElement, type RefObject } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { INITIAL_TOUCHED } from "../touched";

import { DESK_COPY } from "./copy";
import { QuestionSection } from "./QuestionSection";
import { WriteDesk, type WriteDeskProps } from "./WriteDesk";

/**
 * The Write step render at both layouts (spec 16, Requirement 6.6 and 6.1).
 * The desk's markup does not branch on width; the phone layout is CSS and the
 * one JS branch (ReceiptPanel) reads matchMedia only in an effect, which
 * renderToStaticMarkup never runs. The two renders below still set the viewport
 * the component can read, so the test covers both layouts as the ticket asks.
 */

/** The four phrases Requirement 6.6 retires from any rendered Write step. */
const RETIRED_PHRASES = [
  "You don't answer them now",
  "Answered on opening day",
  "Answer it as you remember it",
  "you'll answer these from memory",
];

const VIEWPORTS = [
  { name: "1280px", width: 1280 },
  { name: "360px", width: 360 },
] as const;

const letterRef: RefObject<HTMLTextAreaElement | null> = { current: null };

/** The HTML escapes apostrophes, so the rendered markup is decoded before matching. */
const visibleText = (html: string): string =>
  html
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"');

const countOf = (haystack: string, needle: string): number =>
  haystack.split(needle).length - 1;

function renderWriteStep(width: number): string {
  vi.stubGlobal("window", {
    innerWidth: width,
    matchMedia: (query: string) => ({
      matches: query.includes("600") && width < 600,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
    }),
  });

  const props: WriteDeskProps = {
    chosenOccasion: "blank",
    onChooseOccasion: () => {},
    placeholder: "A placeholder",
    text: "",
    letterProblem: "",
    onLetterChange: () => {},
    onLetterBlur: () => {},
    letterRef,
    authorQuestions: () =>
      createElement(QuestionSection, {
        questions: [
          "What worries me most right now?",
          "Who do I want to call on Sunday?",
        ],
        answers: ["", "My sister"],
        onChange: () => {},
        onRemove: () => {},
        onAnswerChange: () => {},
      }),
    receipt: {
      series: [],
      selected: [],
      onToggleFigure: () => {},
      ownNumber: { name: "", value: "", unit: "", region: "", period: "" },
      sealingDay: "2026-11-18",
      touched: INITIAL_TOUCHED,
      onTouch: () => {},
      onOwnNumberChange: () => {},
    },
    check: {
      text: "",
      questions: [],
      metricIds: [],
      selfReported: [],
      maxFigures: 3,
      sealingDay: "2026-11-18",
    },
    onFoldPass: () => {},
    onFoldFail: () => {},
  };

  return renderToStaticMarkup(createElement(WriteDesk, props));
}

describe.each(VIEWPORTS)(
  "Write step copy at $name (spec 16, Requirement 6)",
  ({ width }) => {
    let html = "";
    let text = "";

    beforeEach(() => {
      html = renderWriteStep(width);
      text = visibleText(html);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("renders no retired phrase", () => {
      for (const phrase of RETIRED_PHRASES) {
        expect(text.toLowerCase()).not.toContain(phrase.toLowerCase());
      }
    });

    it("shows the P.S. intro exactly once", () => {
      expect(countOf(text, DESK_COPY.psIntro)).toBe(1);
    });

    it("shows the lock line and the answer placeholder", () => {
      expect(text).toContain(DESK_COPY.lockLine);
      expect(text).toContain(DESK_COPY.answerPlaceholder);
    });
  },
);
