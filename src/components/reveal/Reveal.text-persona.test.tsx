// Feature: 11-any-letter, task 19 (P1): the reveal of a Text_Persona.
//
// The walk stores no record, so Reveal gets `record: null` and her testimony.
// Every Persona_Answer carries the Fictional_Label, on the marks Stage and the
// letter Stage. There is no answer field and no judge answer label. The close
// shows with no figures Stage. Validates P1.5, P1.7, P1.9, P1.12.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Reveal, type RevealProps } from "./Reveal";
import { REVEAL_COPY } from "./copy";
import { CEREMONY_COPY } from "@/components/ceremony/copy";
import { MotionProvider } from "@/components/ceremony/motion";
import { SkipProvider } from "@/components/ceremony/skip";
import { LiveRegionProvider } from "@/components/ceremony/LiveRegion";
import { LocalViewProvider } from "@/components/ceremony/local-view";
import type { Opened, TestimonyEntry } from "./opening-machine";
import type { PayloadV1 } from "@/lib/seal-format";

const LETTER = "Priya's letter, in plain words, with no figures in it.";

const TESTIMONY: readonly TestimonyEntry[] = [
  { question: "On the day you sealed this, what were you looking forward to most?", answer: "The coast trip with my sister." },
  { question: "On the day you sealed this, what were you worried about?", answer: "The extra morning shift." },
];

const OPENED: Opened = {
  letterId: "text-persona-letter",
  header: {
    sealedAt: "2024-05-12T00:00:00.000Z",
    opensAt: "2024-11-05T00:00:00.000Z",
  },
  openingKey: {} as unknown as CryptoKey,
  envelopeHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  payload: {
    format_version: 1,
    letter_text: LETTER,
    metrics: [],
    figures: [],
    recall_questions: TESTIMONY.map((entry, i) => ({
      id: `q${i + 1}`,
      answer_type: "text" as const,
      text: entry.question,
    })),
  } satisfies PayloadV1,
};

function renderReveal(extra: Partial<RevealProps> = {}): string {
  return renderToStaticMarkup(
    createElement(
      MotionProvider,
      null,
      createElement(
        SkipProvider,
        null,
        createElement(
          LiveRegionProvider,
          null,
          createElement(
            LocalViewProvider,
            null,
            createElement(Reveal, {
              opened: OPENED,
              record: null,
              testimony: TESTIMONY,
              personaName: "Priya",
              stage: 2,
              onAdvance: () => {},
              onShowAll: () => {},
              close: { kind: "persona", personaKey: "us-priya", demo2On: false },
              phone: false,
              ...extra,
            }),
          ),
        ),
      ),
    ),
  );
}

function count(html: string, needle: string): number {
  return html.split(needle).length - 1;
}

describe("Reveal for a Text_Persona (no Recall_Record)", () => {
  it("labels every Persona_Answer with the Fictional_Label on marks and letter", () => {
    // Stage 2 shows the marks answers and the letter testimony: two answers in
    // each, so four labels in all, and each answer appears in full.
    const html = renderReveal({ stage: 2 });
    expect(count(html, REVEAL_COPY.personaAnswerLabel)).toBe(4);
    expect(html).toContain(TESTIMONY[0].answer);
    expect(html).toContain(TESTIMONY[1].answer);
  });

  it("shows her testimony heading, not the judge's", () => {
    const html = renderReveal({ stage: 2 });
    expect(html).toContain(REVEAL_COPY.personaTestimonyTitle);
    expect(html).not.toContain(REVEAL_COPY.saidJustNow);
    expect(html).not.toContain(REVEAL_COPY.noAnswer);
  });

  it("has no answer field anywhere on the reveal", () => {
    const html = renderReveal({ stage: 2 });
    expect(html).not.toMatch(/<input/);
    expect(html).not.toMatch(/<textarea/);
  });

  it("puts her testimony above the letter", () => {
    const html = renderReveal({ stage: 2 });
    const testimony = html.indexOf('data-author-testimony=""');
    const letter = html.indexOf("<article");
    expect(testimony).toBeGreaterThanOrEqual(0);
    expect(letter).toBeGreaterThan(testimony);
  });

  it("reaches the close with no figures Stage", () => {
    const html = renderReveal({ stage: 2 });
    expect(html).toContain(CEREMONY_COPY.closeLineNoFigures);
    expect(html).not.toContain("data-figures-panel");
  });
});
