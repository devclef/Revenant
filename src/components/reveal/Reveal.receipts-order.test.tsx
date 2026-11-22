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
 * The receipts order for a Live_Letter (spec 15 R12.2). At `stage` 2 the
 * receipts column starts with each author question as written, its testimony
 * beside the sealed answer, then the letter. At `stage` 3 the figures follow
 * the letter. The test reads the order of the markup, so a block moved above
 * another fails.
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

const OPENED: Opened = {
  letterId: "letter-live-order",
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
              record: RECORD,
              personaName: "Live letter",
              letterId: OPENED.letterId,
              letterKind: "live",
              variant: "live",
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

describe("Live_Letter receipts order (spec 10 C9.3)", () => {
  beforeEach(() => {
    useFiguresSpy.mockClear();
  });

  it("leads the receipts with the question pairs, the Author_Question first, and no Answer_List", () => {
    const markup = renderReveal({ stage: 2 });
    const receipts = indexOfOrFail(markup, "data-receipts");
    const own = indexOfOrFail(markup, OWN_QUESTION);
    expect(own).toBeGreaterThan(receipts);
    // The stage 1 Answer_List is not part of the receipts column (spec 15 R12.2).
    expect(markup).not.toContain("data-answer-list");
  });

  it("puts the question pairs above the letter", () => {
    const markup = renderReveal({ stage: 2 });
    const testimony = indexOfOrFail(markup, "data-author-testimony");
    const pair = indexOfOrFail(markup, "data-question-pair");
    const letter = indexOfOrFail(markup, "data-letter-text");
    expect(testimony).toBeLessThan(pair);
    expect(pair).toBeLessThan(letter);
  });

  it("shows the figures before the letter at stage 3, so the letter folds after them", () => {
    const markup = renderReveal({ stage: 3 });
    const testimony = indexOfOrFail(markup, "data-author-testimony");
    const figures = indexOfOrFail(markup, "data-figures-panel");
    const letter = indexOfOrFail(markup, "data-letter-text");
    expect(testimony).toBeLessThan(figures);
    expect(figures).toBeLessThan(letter);
  });

  it("ends the column with the letter, the seal line and the end card, after the figures", () => {
    const markup = renderReveal({ stage: 3 });
    const figures = indexOfOrFail(markup, "data-figures-panel");
    const letter = indexOfOrFail(markup, "data-letter-text");
    const seal = indexOfOrFail(markup, "data-seal-line");
    const end = indexOfOrFail(markup, "data-end-card");
    expect(figures).toBeLessThan(letter);
    expect(letter).toBeLessThan(seal);
    expect(seal).toBeLessThan(end);
  });

  it("keeps the letter unfolded at stage 2, before any figures", () => {
    const markup = renderReveal({ stage: 2 });
    expect(markup).not.toContain("data-letter-disclosure");
    expect(markup).not.toContain("data-figures-panel");
  });

  it("folds the letter closed after the figures at stage 3, with no motion", () => {
    const markup = renderReveal({ stage: 3 });
    const details = indexOfOrFail(markup, "data-letter-disclosure");
    const figures = indexOfOrFail(markup, "data-figures-panel");
    expect(details).toBeGreaterThan(figures);
    // The disclosure is closed on first render: no `open` attribute.
    expect(markup).toMatch(/<details[^>]*data-letter-disclosure=""[^>]*>/);
    expect(markup).not.toMatch(/<details[^>]* open/);
    // The folded letter mounts still, so no unfold runs under the closed disclosure.
    expect(markup).toContain('data-light="static"');
  });

  it("folds the letter at stage 3 on a phone too", () => {
    const markup = renderReveal({ stage: 3, phone: true });
    expect(markup).toMatch(/<details[^>]*data-letter-disclosure=""/);
    expect(markup).not.toMatch(/<details[^>]* open/);
  });
});
