import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Reveal, type RevealProps } from "./Reveal";
import { MotionProvider } from "@/components/ceremony/motion";
import { SkipProvider } from "@/components/ceremony/skip";
import { LiveRegionProvider } from "@/components/ceremony/LiveRegion";
import { LocalViewProvider } from "@/components/ceremony/local-view";
import type { Opened } from "./opening-machine";
import type { RecallRecordV2 } from "@/lib/recall";
import type { OpenedPayload } from "@/components/reveal/opened-payload";
import { CATALOGUE } from "@/lib/figures/catalogue";
import { DEMO_FIGURES } from "@/lib/figures/demo";
import { thenAndNow } from "@/lib/figures/then-now";

/**
 * The receipts order at stage 2 and stage 3 (spec 15 R12.2). Each case holds
 * one open letter with one figure: Maya's persona letter, and a Live_Letter.
 * At stage 2 the receipts column starts with each author question as written,
 * its testimony beside the sealed answer, then the letter. At stage 3 the
 * figures follow the letter, and the letter stays open in the split. The test
 * reads the order of the markup, so a block moved above another fails.
 */

const { useFiguresSpy } = vi.hoisted(() => ({ useFiguresSpy: vi.fn() }));

vi.mock("./figures-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./figures-api")>();
  return {
    ...actual,
    useFigures: () => {
      useFiguresSpy();
      return { status: "loading" as const };
    },
  };
});

const METRIC_ID = "us-gasoline-regular";
const AS_OF = "2024-10-15";
const OWN_QUESTION = "Which street did you walk down that week?";
const FIGURE_QUESTION = "What did a gallon of gas cost then?";
const LETTER = "A letter from the past that says the same thing as before.";

/** The sealed metric and its "then" figure, from the real figure file. */
const series = CATALOGUE.find((entry) => entry.metric.id === METRIC_ID);
const then = thenAndNow(METRIC_ID, AS_OF, DEMO_FIGURES).then;
if (series === undefined || !then.found) {
  throw new Error(`test setup: no sealed figure for ${METRIC_ID} on ${AS_OF}`);
}

const LETTER_ID = "letter-receipts-order";

const OPENED: Opened = {
  letterId: LETTER_ID,
  header: {
    sealedAt: "2026-11-01T00:00:00.000Z",
    opensAt: "2026-11-09T00:00:00.000Z",
  },
  openingKey: {} as unknown as CryptoKey,
  envelopeHash:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  payload: {
    letter_text: LETTER,
    metrics: [series.metric],
    figures: [then.figure],
    recall_questions: [
      { id: "a1", answer_type: "text", text: OWN_QUESTION },
      {
        id: "q1",
        answer_type: "number",
        metric_id: METRIC_ID,
        text: FIGURE_QUESTION,
      },
    ],
  } satisfies OpenedPayload,
};

const RECORD: RecallRecordV2 = {
  version: 2,
  answers: [
    { question_id: "a1", kind: "text", value: "The one by the bakery." },
    { question_id: "q1", kind: "no_answer" },
  ],
};

type Case = {
  name: string;
  extra: Partial<RevealProps>;
};

const CASES: readonly Case[] = [
  {
    name: "Maya's persona letter",
    extra: {
      personaName: "Maya",
      variant: "persona",
      letterKind: "persona",
      close: { kind: "persona", personaKey: "us-maya", demo2On: false },
    },
  },
  {
    name: "a Live_Letter with one figure",
    extra: {
      personaName: "Live letter",
      letterKind: "live",
      variant: "live",
    },
  },
];

function renderReveal(extra: Partial<RevealProps>): string {
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
              record: RECORD,
              letterId: LETTER_ID,
              personaName: "Live letter",
              stage: 2,
              onAdvance: () => {},
              onShowAll: () => {},
              phone: false,
              ...extra,
            }),
          ),
        ),
      ),
    ),
  );
}

function indexOfOrFail(markup: string, needle: string): number {
  const at = markup.indexOf(needle);
  expect(at, `${needle} is in the markup`).toBeGreaterThanOrEqual(0);
  return at;
}

/**
 * True when the letter text sits inside a `<details>` element. The figures'
 * Source and the seal's fingerprint use `<details>` too, so only an open
 * `<details>` before the letter, with no `</details>` yet, counts.
 */
function letterInsideDetails(markup: string): boolean {
  const at = indexOfOrFail(markup, "data-letter-text");
  return markup.lastIndexOf("<details", at) > markup.lastIndexOf("</details>", at);
}

describe.each(CASES)("receipts order for $name (spec 10 C9.3)", ({ extra }) => {
  beforeEach(() => {
    useFiguresSpy.mockClear();
  });

  it("leads the receipts with the question pairs, the Author_Question first, and no Answer_List", () => {
    const markup = renderReveal({ ...extra, stage: 2 });
    const receipts = indexOfOrFail(markup, "data-receipts");
    const own = indexOfOrFail(markup, OWN_QUESTION);
    expect(own).toBeGreaterThan(receipts);
    // The stage 1 Answer_List is not part of the receipts column (spec 15 R12.2).
    expect(markup).not.toContain("data-answer-list");
  });

  it("puts the question pairs above the letter", () => {
    const markup = renderReveal({ ...extra, stage: 2 });
    const testimony = indexOfOrFail(markup, "data-author-testimony");
    const pair = indexOfOrFail(markup, "data-question-pair");
    const letter = indexOfOrFail(markup, "data-letter-text");
    expect(testimony).toBeLessThan(pair);
    expect(pair).toBeLessThan(letter);
  });

  it("keeps the letter unfolded at stage 2, before any figures", () => {
    const markup = renderReveal({ ...extra, stage: 2 });
    expect(markup).not.toContain("data-letter-disclosure");
    expect(letterInsideDetails(markup)).toBe(false);
    expect(markup).not.toContain("data-figures-panel");
    expect(markup).toContain("data-letter-stage");
    expect(markup.match(/data-letter-text/g)).toHaveLength(1);
  });

  it("places the one open letter after the question pairs and before the figures at stage 3", () => {
    const markup = renderReveal({ ...extra, stage: 3 });
    const testimony = indexOfOrFail(markup, "data-author-testimony");
    const letter = indexOfOrFail(markup, "data-letter-text");
    const figures = indexOfOrFail(markup, "data-figures-panel");
    expect(testimony).toBeLessThan(letter);
    expect(letter).toBeLessThan(figures);
    expect(markup.match(/data-letter-text/g)).toHaveLength(1);
    expect(markup.match(/data-letter-stage/g)).toHaveLength(1);
  });

  it("ends the column with the figures, the seal line and the end card, after the letter", () => {
    const markup = renderReveal({ ...extra, stage: 3 });
    const letter = indexOfOrFail(markup, "data-letter-text");
    const figures = indexOfOrFail(markup, "data-figures-panel");
    const seal = indexOfOrFail(markup, "data-seal-line");
    const end = indexOfOrFail(markup, "data-end-card");
    expect(letter).toBeLessThan(figures);
    expect(figures).toBeLessThan(seal);
    expect(seal).toBeLessThan(end);
  });

  it("lays the stage 3 receipts out as the split, with the letter beside the figures", () => {
    const markup = renderReveal({ ...extra, stage: 3 });
    expect(markup).toContain('data-receipts-layout="split"');
  });

  it("never folds the letter at stage 3: no disclosure, no details, no 'Read the letter again'", () => {
    const markup = renderReveal({ ...extra, stage: 3 });
    expect(markup).not.toContain("data-letter-disclosure");
    expect(letterInsideDetails(markup)).toBe(false);
    expect(markup.toLowerCase()).not.toContain("read the letter again");
    expect(markup).toContain("data-letter-stage");
  });

  it("keeps the letter open at stage 3 on a phone too", () => {
    const markup = renderReveal({ ...extra, stage: 3, phone: true });
    expect(markup).not.toContain("data-letter-disclosure");
    expect(markup).toMatch(/data-letter-text/);
  });
});
