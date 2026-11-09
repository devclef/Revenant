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
import type { PayloadV1 } from "@/lib/seal-format";
import { CATALOGUE } from "@/lib/figures/catalogue";
import { DEMO_FIGURES } from "@/lib/figures/demo";
import { thenAndNow } from "@/lib/figures/then-now";

/**
 * The receipts order for a Live_Letter (spec 10 C9.3). At `stage` 2 the
 * Answer_List sits at `marks` and lists the Author_Question first. Then the
 * Author_Testimony, then the letter. At `stage` 3 the figures follow the letter.
 * The test reads the order of the markup, so a block moved above another fails.
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
    format_version: 1,
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
  } satisfies PayloadV1,
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

  it("leads the receipts with the Answer_List, which holds the Author_Question first", () => {
    const markup = renderReveal({ stage: 2 });
    const list = indexOfOrFail(markup, "data-answer-list");
    const own = indexOfOrFail(markup, OWN_QUESTION);
    // A number question shows its metric name in the Answer_List, not its wording.
    expect(own).toBeGreaterThan(list);
    expect(markup.indexOf(series.metric.display_name)).toBeGreaterThan(own);
  });

  it("puts the Author_Testimony above the letter, after the Answer_List", () => {
    const markup = renderReveal({ stage: 2 });
    const list = indexOfOrFail(markup, "data-answer-list");
    const testimony = indexOfOrFail(markup, "data-author-testimony");
    const letter = indexOfOrFail(markup, "data-letter-text");
    expect(list).toBeLessThan(testimony);
    expect(testimony).toBeLessThan(letter);
  });

  it("shows the figures after the letter at stage 3", () => {
    const markup = renderReveal({ stage: 3 });
    const testimony = indexOfOrFail(markup, "data-author-testimony");
    const letter = indexOfOrFail(markup, "data-letter-text");
    const figures = indexOfOrFail(markup, "data-figures-panel");
    expect(testimony).toBeLessThan(letter);
    expect(letter).toBeLessThan(figures);
  });
});
