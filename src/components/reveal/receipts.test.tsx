import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { EndCard } from "./EndCard";
import { QuestionPair } from "./QuestionPair";
import { SealLine } from "./SealLine";
import { REVEAL_COPY } from "./copy";
import { sealedAnswerOf, sealedLabelOf, testimonyTextOf } from "./receipts";
import type { RecallQuestion } from "./opening-machine";

/** Static markup escapes the apostrophe in "I don't remember". */
const escaped = (text: string) => text.replace(/'/g, "&#x27;");

const HASH = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

describe("sealedAnswerOf (spec 15 R12.2)", () => {
  it("reads the sealed answer of a version 2 text question", () => {
    const question = {
      id: "a1",
      answer_type: "text",
      text: "What worries me most right now?",
      sealed_answer: "That I will say yes and regret it.",
    } as RecallQuestion;
    expect(sealedAnswerOf(question)).toBe("That I will say yes and regret it.");
  });

  it("returns undefined for a version 1 text question, which has none", () => {
    const question = {
      id: "a1",
      answer_type: "text",
      text: "What worries me most right now?",
    } as RecallQuestion;
    expect(sealedAnswerOf(question)).toBeUndefined();
  });

  it("returns undefined for a number question", () => {
    const question = {
      id: "q1",
      answer_type: "number",
      metric_id: "fuel",
      text: "What did a gallon cost then?",
    } as RecallQuestion;
    expect(sealedAnswerOf(question)).toBeUndefined();
  });
});

describe("testimonyTextOf (spec 15 R12.2, Decision 6)", () => {
  it("shows the reader's text answer as written", () => {
    const record = {
      version: 2 as const,
      answers: [
        { question_id: "a1", kind: "text" as const, value: "The bakery." },
      ],
    };
    expect(testimonyTextOf(record, "a1")).toBe("The bakery.");
  });

  it("shows I don't remember for a text question stored as no_answer", () => {
    const record = {
      version: 2 as const,
      answers: [{ question_id: "a1", kind: "no_answer" as const }],
    };
    expect(testimonyTextOf(record, "a1")).toBe(REVEAL_COPY.dontRemember);
  });

  it("shows No answer when nothing was stored, or there is no record", () => {
    expect(testimonyTextOf(null, "a1")).toBe(REVEAL_COPY.noAnswer);
    expect(testimonyTextOf({ version: 2 as const, answers: [] }, "a1")).toBe(
      REVEAL_COPY.noAnswer,
    );
  });
});

describe("sealedLabelOf (spec 15 R12.2, R12.7)", () => {
  it("dates a live letter's answer by the sealing day", () => {
    expect(sealedLabelOf(false, "19 November 2026")).toBe(
      "You wrote, 19 November 2026",
    );
  });

  it("dates a persona's answer as of its written day", () => {
    expect(sealedLabelOf(true, "12 May 2024")).toBe(
      "She wrote, as of 12 May 2024",
    );
  });

  it("never claims a persona was sealed on a day when the letter has no written day", () => {
    expect(sealedLabelOf(true, "")).toBe(
      REVEAL_COPY.receiptsWroteUndatedPersona,
    );
  });
});

describe("QuestionPair (spec 15 R12.2, R12.3)", () => {
  const base = {
    question: "What is on my mind about work right now?",
    questionLabel: REVEAL_COPY.receiptsAsWritten,
    testimony: "The January project.",
    testimonyLabel: REVEAL_COPY.receiptsRemembered,
    sealedAnswer: "I keep saying I will decide after the release.",
    sealedLabel: "You wrote, 19 November 2026",
    noSealedAnswer: REVEAL_COPY.noSealedAnswer,
  };

  it("shows the question as written, then the testimony, then the sealed answer", () => {
    const html = renderToStaticMarkup(createElement(QuestionPair, base));
    const question = html.indexOf(base.question);
    const testimony = html.indexOf(base.testimony);
    const sealed = html.indexOf(base.sealedAnswer);
    expect(question).toBeGreaterThanOrEqual(0);
    expect(testimony).toBeGreaterThan(question);
    expect(sealed).toBeGreaterThan(testimony);
  });

  it("shows the no-sealed-answer line on a version 1 letter", () => {
    const html = renderToStaticMarkup(
      createElement(QuestionPair, { ...base, sealedAnswer: undefined }),
    );
    expect(html).toContain("No answer was sealed with this question.");
    expect(html).not.toContain(base.sealedAnswer);
  });

  it("marks a live letter's words as user content, and a persona's words as not", () => {
    const live = renderToStaticMarkup(createElement(QuestionPair, base));
    const persona = renderToStaticMarkup(
      createElement(QuestionPair, { ...base, userContent: false }),
    );
    expect(live).toContain('data-user-content=""');
    expect(persona).not.toContain("data-user-content");
  });

  it("shows I don't remember in the testimony slot, with the same words", () => {
    const html = renderToStaticMarkup(
      createElement(QuestionPair, {
        ...base,
        testimony: REVEAL_COPY.dontRemember,
      }),
    );
    expect(html).toContain(escaped(REVEAL_COPY.dontRemember));
  });

  it("draws no comparison, highlight or grade between the two answers", () => {
    const html = renderToStaticMarkup(createElement(QuestionPair, base));
    expect(html).not.toMatch(/mark|highlight|same|differs|changed/i);
  });
});

describe("SealLine (spec 15 R12.6)", () => {
  it("reads the intact line, with the fingerprint behind a disclosure", () => {
    const html = renderToStaticMarkup(
      createElement(SealLine, { envelopeHash: HASH, letterKind: "live" }),
    );
    expect(html).toContain(REVEAL_COPY.sealIntact);
    expect(html).toContain("<summary>");
    expect(html).toContain(REVEAL_COPY.fingerprintShow);
  });

  it("holds the tamper control for a persona, after the disclosure", () => {
    const html = renderToStaticMarkup(
      createElement(SealLine, {
        envelopeHash: HASH,
        letterKind: "persona",
        tamper: createElement("p", null, "TAMPER_SLOT"),
      }),
    );
    expect(html).toContain("TAMPER_SLOT");
    expect(html.indexOf("TAMPER_SLOT")).toBeGreaterThan(
      html.indexOf("</details>"),
    );
  });

  it("drops the tamper control for a live letter", () => {
    const html = renderToStaticMarkup(
      createElement(SealLine, {
        envelopeHash: HASH,
        letterKind: "live",
        tamper: createElement("p", null, "TAMPER_SLOT"),
      }),
    );
    expect(html).not.toContain("TAMPER_SLOT");
  });

  it("renders nothing for a malformed hash", () => {
    const html = renderToStaticMarkup(
      createElement(SealLine, {
        envelopeHash: "not-a-hash",
        letterKind: "live",
      }),
    );
    expect(html).toBe("");
  });
});

describe("EndCard (spec 15 R12.2)", () => {
  it("wraps its end actions in the end card section", () => {
    const html = renderToStaticMarkup(
      createElement(EndCard, null, createElement("p", null, "END_ACTION")),
    );
    expect(html).toContain('data-end-card=""');
    expect(html).toContain("END_ACTION");
  });
});
