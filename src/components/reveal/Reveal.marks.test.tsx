import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Reveal, type RevealProps } from "./Reveal";
import { REVEAL_COPY } from "./copy";
import { CEREMONY_COPY } from "@/components/ceremony/copy";
import { WaxSeal, normaliseWaxSealIds } from "@/components/ui/WaxSeal";
import { MotionProvider } from "@/components/ceremony/motion";
import { SkipProvider } from "@/components/ceremony/skip";
import { LiveRegionProvider } from "@/components/ceremony/LiveRegion";
import { LocalViewProvider } from "@/components/ceremony/local-view";
import type { Opened } from "./opening-machine";
import type { RecallRecordV1 } from "@/lib/recall";
import type { PayloadV1 } from "@/lib/seal-format";

/**
 * The marks stage (stage 1 of the reveal) shows each number answer on a
 * read-only recall scale, with the Mark at the value the judge recorded. Built
 * with `renderToStaticMarkup`, like the other reveal markup tests.
 */

const OPENED: Opened = {
  letterId: "letter-marks",
  header: {
    sealedAt: "2024-10-01T00:00:00.000Z",
    opensAt: "2024-11-05T00:00:00.000Z",
  },
  openingKey: {} as unknown as CryptoKey,
  envelopeHash:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  payload: {
    format_version: 1,
    letter_text: "A short letter for the marks test.",
    metrics: [
      {
        id: "fuel",
        display_name: "Regular gasoline",
        unit: "USD per gallon",
        region: "U.S. city average",
        source: "U.S. EIA",
        series_id: "EMM_EPMR_PTE_NUS_DPG",
      },
      {
        id: "milk",
        display_name: "Milk",
        unit: "USD per gallon",
        region: "U.S. city average",
        source: "U.S. BLS",
        series_id: "APU0000709112",
      },
    ],
    figures: [],
    recall_questions: [
      {
        id: "q-fuel",
        answer_type: "number",
        text: "What do you think a gallon of regular gasoline cost then?",
        metric_id: "fuel",
      },
      {
        id: "q-milk",
        answer_type: "number",
        text: "What do you think a gallon of milk cost then?",
        metric_id: "milk",
      },
      {
        id: "q-note",
        answer_type: "text",
        text: "What were you spending most on then?",
      },
    ],
  } satisfies PayloadV1,
};

function renderMarks(
  record: RecallRecordV1,
  extra: Partial<RevealProps> = {},
): string {
  return normaliseWaxSealIds(renderMarksRaw(record, extra));
}

function renderMarksRaw(
  record: RecallRecordV1,
  extra: Partial<RevealProps> = {},
): string {
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
              record,
              personaName: "Maya",
              stage: 1,
              onAdvance: () => {},
              onShowAll: () => {},
              ...extra,
            }),
          ),
        ),
      ),
    ),
  );
}

describe("reveal marks stage: recorded scales (spec 08 R6)", () => {
  const RECORD: RecallRecordV1 = {
    version: 1,
    answers: [
      { question_id: "q-fuel", kind: "number", value: "2.50" },
      { question_id: "q-milk", kind: "no_answer" },
      { question_id: "q-note", kind: "no_answer" },
    ],
  };

  it("renders one recorded scale per number question, with no slider and no tab stop", () => {
    const html = renderMarks(RECORD);
    expect(html).not.toContain('role="slider"');
    expect(html.match(/role="img"/g) ?? []).toHaveLength(2);
    expect(html).not.toContain("tabindex");
  });

  it("places the Mark at the recorded value and names the value with its unit", () => {
    const html = renderMarks(RECORD);
    expect(html).toContain(": 2.50 USD per gallon\"");
    expect(html).toContain(">2.50<");
  });

  it("shows no Mark for a question recorded as no answer, and says No answer", () => {
    const html = renderMarks(RECORD);
    expect(html).toContain(`: ${CEREMONY_COPY.lineNoAnswer}"`);
    expect(html).toContain(CEREMONY_COPY.lineNoAnswer);
    // Only the answered question carries a Mark readout.
    expect(html.match(/recordedMark/g) ?? []).toHaveLength(1);
  });

  it("shows the judge's value in the Accent, in its own answers list", () => {
    const html = renderMarks(RECORD);
    const answers = sliceBetween(html, 'data-fit="marks-answers"', "</dl>");
    expect(answers).toContain(">2.50</span>");
    expect(answers).toMatch(/class="[^"]*marksValue[^"]*"/);
    // The Accent value is the only answer in the list drawn with the Accent.
    expect(answers.match(/class="[^"]*marksValue[^"]*"/g) ?? []).toHaveLength(1);
  });

  it("shows 'No answer' for a question recorded without a number", () => {
    const html = renderMarks(RECORD);
    const answers = sliceBetween(html, 'data-fit="marks-answers"', "</dl>");
    expect(answers.match(new RegExp(REVEAL_COPY.noAnswer, "g")) ?? []).toHaveLength(2);
  });
});

describe("reveal marks stage: column markers and order", () => {
  const RECORD: RecallRecordV1 = {
    version: 1,
    answers: [
      { question_id: "q-fuel", kind: "number", value: "2.50" },
      { question_id: "q-milk", kind: "no_answer" },
      { question_id: "q-note", kind: "no_answer" },
    ],
  };

  it("renders the three data-fit markers for the heading, the answers and the break", () => {
    const html = renderMarks(RECORD);
    expect(html.match(/data-fit="marks-heading"/g) ?? []).toHaveLength(1);
    expect(html.match(/data-fit="marks-answers"/g) ?? []).toHaveLength(1);
    expect(html.match(/data-fit="break"/g) ?? []).toHaveLength(1);
  });

  it("puts the heading, answers, scales, the break region, instruction, Show everything, then the sound note, in that order", () => {
    const html = renderMarks(RECORD);
    const order = [
      html.indexOf('data-fit="marks-heading"'),
      html.indexOf('data-fit="marks-answers"'),
      html.indexOf('role="img"'),
      html.indexOf('data-fit="break"'),
      html.indexOf(CEREMONY_COPY.sealInstruction),
      html.indexOf(REVEAL_COPY.showAll),
      html.indexOf(CEREMONY_COPY.soundNote),
    ];
    for (const index of order) expect(index).toBeGreaterThanOrEqual(0);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("shows the sound toggle and its note only on the persona page", () => {
    const persona = renderMarks(RECORD);
    expect(persona).toContain(CEREMONY_COPY.soundNote);
    const live = renderMarks(RECORD, { variant: "live", letterId: "live-marks" });
    expect(live).not.toContain(CEREMONY_COPY.soundNote);
  });
});

describe("reveal marks stage: recorded scale names and answer format (spec 09 A9)", () => {
  const RECORD: RecallRecordV1 = {
    version: 1,
    answers: [
      { question_id: "q-fuel", kind: "number", value: "2500.50" },
      { question_id: "q-milk", kind: "no_answer" },
      { question_id: "q-note", kind: "no_answer" },
    ],
  };

  it("draws one data-recorded-scale per number question, each named with its metric", () => {
    const html = renderMarks(RECORD);
    expect(html.match(/data-recorded-scale=""/g) ?? []).toHaveLength(2);
    expect(html.indexOf("Regular gasoline")).toBeGreaterThan(-1);
    expect(html.indexOf("Milk")).toBeGreaterThan(-1);
  });

  it("shows the recorded answer grouped in threes on the scale and in the answers list", () => {
    const html = renderMarks(RECORD);
    expect(html).toContain(": 2,500.50 USD per gallon\"");
    const answers = sliceBetween(html, 'data-fit="marks-answers"', "</dl>");
    expect(answers).toContain(">2,500.50</span>");
    expect(answers).not.toContain(">2500.50<");
  });
});

/** The text between two markers, used to scope an assertion to one part. */
function sliceBetween(html: string, start: string, end: string): string {
  const from = html.indexOf(start);
  if (from < 0) return "";
  const to = html.indexOf(end, from);
  return to < 0 ? html.slice(from) : html.slice(from, to);
}

/**
 * The seal body for one pattern key: everything from the `width` attribute on,
 * so the class list `SealBreak` adds does not hide the pattern being compared.
 */
function sealMarkup(patternKey: string): string {
  const markup = renderToStaticMarkup(
    createElement(WaxSeal, { patternKey, size: 64 }),
  );
  return normaliseWaxSealIds(markup.slice(markup.indexOf("width=")));
}

describe("reveal seal pattern key (spec 06, R18.2)", () => {
  const RECORD: RecallRecordV1 = {
    version: 1,
    answers: [],
  };
  const LIVE_LETTER_ID = "live-letter-seal-key";

  it("draws the one seal for a live letter, the same as for a persona (R10.10)", () => {
    const html = renderMarks(RECORD, {
      variant: "live",
      letterId: LIVE_LETTER_ID,
    });
    expect(html).toContain(sealMarkup(LIVE_LETTER_ID));
    expect(html).toContain(sealMarkup("Maya"));
  });

  it("keeps the one seal when the variant is persona (R10.10)", () => {
    const html = renderMarks(RECORD, { letterId: LIVE_LETTER_ID });
    expect(html).toContain(sealMarkup("Maya"));
    expect(html).toContain(sealMarkup(LIVE_LETTER_ID));
  });
});

describe("reveal marks stage on the phone and the collapsed card (spec 09 P6, C3.4)", () => {
  const RECORD: RecallRecordV1 = {
    version: 1,
    answers: [
      { question_id: "q-fuel", kind: "number", value: "2.50" },
      { question_id: "q-milk", kind: "no_answer" },
      { question_id: "q-note", kind: "no_answer" },
    ],
  };

  it("shows the Answer_List in place of the recall scales on the phone", () => {
    const html = renderMarks(RECORD, { phone: true });
    expect(html).toContain('data-answer-list=""');
    expect(html).not.toContain('role="img"');
    expect(html).not.toContain("data-recorded-scale");
    expect(html).toContain("Regular gasoline");
    expect(html).toContain(`${REVEAL_COPY.noAnswer}`);
  });

  it("keeps the marks card open with its heading on the phone at stage 1", () => {
    const html = renderMarks(RECORD, { phone: true });
    expect(html).toContain('data-fit="marks-heading"');
    expect(html).not.toContain("data-testimony");
  });

  it("renders no marks card on the phone from figures on", () => {
    const html = renderMarks(RECORD, { phone: true, stage: 3 });
    expect(html).not.toContain('data-card="marks"');
    expect(html).not.toContain("data-testimony");
    expect(html).not.toContain('data-answer-list=""');
  });

  it("collapses the marks card into a closed details titled Your testimony at 600 px and wider from figures on", () => {
    const html = renderMarks(RECORD, { phone: false, stage: 3 });
    expect(html).toContain('data-testimony=""');
    expect(html).toMatch(
      new RegExp(`<details[^>]*>\\s*<summary>${REVEAL_COPY.stage1Title}</summary>`),
    );
    expect(html).not.toMatch(/<details[^>]*\sopen/);
    // The recorded scales stay in the document inside the closed card.
    expect(html.match(/role="img"/g) ?? []).toHaveLength(2);
  });

  it("keeps the open marks card at 600 px and wider on the marks Stage", () => {
    const html = renderMarks(RECORD, { phone: false, stage: 1 });
    expect(html).not.toContain("data-testimony");
    expect(html).toContain('data-fit="marks-heading"');
  });
});
