// Property 8: the receipts order does not depend on direction
//
// For any non-empty set of sealed official figures, and for each change
// direction (every figure up, every figure down, every figure unchanged), the
// rendered Reveal at stage 3 holds the same order of blocks: the author's
// question pairs, the figures, the folded letter, then the seal line and the
// end card. The folded letter is a details element that is closed on first
// render.
//
// Validates spec 10 requirements 10.1, 10.4, 10.5, 10.8 and 16.4.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import fc from "fast-check";

import { MotionProvider } from "@/components/ceremony/motion";
import { SkipProvider } from "@/components/ceremony/skip";
import { LiveRegionProvider } from "@/components/ceremony/LiveRegion";
import { LocalViewProvider } from "@/components/ceremony/local-view";
import type { FiguresState } from "./figures-api";
import { Reveal, type RevealProps } from "./Reveal";
import type { Opened } from "./opening-machine";
import type { RecallRecordV2 } from "@/lib/recall";
import type { OpenedPayload } from "@/components/reveal/opened-payload";
import { CATALOGUE } from "@/lib/figures/catalogue";
import { DEMO_FIGURES } from "@/lib/figures/demo";
import { thenAndNow } from "@/lib/figures/then-now";
import type { FigureV1 } from "@/lib/seal-format";

const { useFiguresSpy, nowState } = vi.hoisted(() => ({
  useFiguresSpy: vi.fn(),
  nowState: { current: null as unknown },
}));

vi.mock("./figures-api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./figures-api")>();
  return {
    ...actual,
    useFigures: () => {
      useFiguresSpy();
      return (nowState.current ?? { status: "loading" }) as FiguresState;
    },
  };
});

const AS_OF = "2024-10-15";
const OWN_QUESTION = "Which street did you walk down that week?";
const FIGURE_QUESTION = "What did this cost then?";
const LETTER = "A letter from the past that says the same thing as before.";
const NOW_PERIOD = "2026-09-28";
const NOW_RETRIEVED_AT = "2026-10-30T14:02:11Z";

type Direction = "up" | "down" | "unchanged";
const DIRECTIONS: readonly Direction[] = ["up", "down", "unchanged"];

type Picked = {
  metricId: string;
  metric: (typeof CATALOGUE)[number]["metric"];
  periodType: (typeof CATALOGUE)[number]["period_type"];
  then: FigureV1;
};

// Every catalogue series with a sealed figure on the demo date. A figure set
// is a non-empty subset of these, in the order they are sealed.
const ELIGIBLE: readonly Picked[] = CATALOGUE.flatMap((entry) => {
  const found = thenAndNow(entry.metric.id, AS_OF, DEMO_FIGURES).then;
  return found.found
    ? [
        {
          metricId: entry.metric.id,
          metric: entry.metric,
          periodType: entry.period_type,
          then: found.figure,
        },
      ]
    : [];
});

if (ELIGIBLE.length === 0) {
  throw new Error(`test setup: no sealed figure on ${AS_OF}`);
}

/** The "now" value for one figure, moved in the given direction. */
function nowValue(then: FigureV1, direction: Direction): string {
  if (direction === "unchanged") return then.value;
  const factor = direction === "up" ? 1.1 : 0.9;
  return (Number(then.value) * factor).toFixed(3);
}

function nowFigure(then: FigureV1, direction: Direction): FigureV1 {
  return {
    ...then,
    value: nowValue(then, direction),
    period: NOW_PERIOD,
    retrieved_at: NOW_RETRIEVED_AT,
  } as FigureV1;
}

function openedFor(picked: readonly Picked[]): Opened {
  const payload = {
    letter_text: LETTER,
    metrics: picked.map((p) => p.metric),
    figures: picked.map((p) => p.then),
    recall_questions: [
      { id: "a1", answer_type: "text", text: OWN_QUESTION },
      ...picked.map((p, index) => ({
        id: `q${index}`,
        answer_type: "number" as const,
        metric_id: p.metricId,
        text: FIGURE_QUESTION,
      })),
    ],
  } satisfies OpenedPayload;
  return {
    letterId: "letter-receipts-order-property",
    header: {
      sealedAt: "2026-11-01T00:00:00.000Z",
      opensAt: "2026-11-09T00:00:00.000Z",
    },
    openingKey: {} as unknown as CryptoKey,
    envelopeHash:
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    payload,
  };
}

function recordFor(picked: readonly Picked[]): RecallRecordV2 {
  return {
    version: 2,
    answers: [
      { question_id: "a1", kind: "text", value: "The one by the bakery." },
      ...picked.map((_, index) => ({
        question_id: `q${index}`,
        kind: "no_answer" as const,
      })),
    ],
  };
}

function setNowFigures(picked: readonly Picked[], direction: Direction): void {
  nowState.current = {
    status: "ready",
    figures: {
      format: "revenant-figures-v1",
      generated_at: NOW_RETRIEVED_AT,
      source_mode: "file",
      series: picked.map((p) => ({
        metric: p.metric,
        period_type: p.periodType,
        last_success_at: null,
        figure: nowFigure(p.then, direction),
        fallback: false,
      })),
    },
  };
}

function renderStage3(picked: readonly Picked[], direction: Direction): string {
  setNowFigures(picked, direction);
  const props: Partial<RevealProps> = {
    variant: "live",
    letterKind: "live",
    close: { kind: "live" },
  };
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
              opened: openedFor(picked),
              record: recordFor(picked),
              personaName: "Live letter",
              letterId: "letter-receipts-order-property",
              stage: 3,
              onAdvance: () => {},
              onShowAll: () => {},
              phone: false,
              ...props,
            }),
          ),
        ),
      ),
    ),
  );
}

const BLOCKS = [
  "data-author-testimony",
  "data-figures-panel",
  "data-letter-disclosure",
  "data-letter-text",
  "data-seal-line",
  "data-end-card",
] as const;

/** The expected top-to-bottom order of the blocks at stage 3 with figures. */
const EXPECTED_ORDER: readonly string[] = [
  "data-author-testimony",
  "data-figures-panel",
  "data-letter-disclosure",
  "data-letter-text",
  "data-seal-line",
  "data-end-card",
];

/** The block names in the order they appear in the markup. */
function orderOf(markup: string): string[] {
  return BLOCKS.map((name) => {
    const at = markup.indexOf(name);
    expect(at, `${name} is in the markup`).toBeGreaterThanOrEqual(0);
    return { name, at };
  })
    .sort((a, b) => a.at - b.at)
    .map((entry) => entry.name);
}

const pickedArb = fc.subarray([...ELIGIBLE], { minLength: 1 });
const directionArb = fc.constantFrom<Direction>(...DIRECTIONS);

describe("Property 8: the receipts order does not depend on direction", () => {
  it("renders the same block order for every direction, for any figure set", () => {
    fc.assert(
      fc.property(pickedArb, (picked) => {
        useFiguresSpy.mockClear();
        for (const direction of DIRECTIONS) {
          const markup = renderStage3(picked, direction);
          expect(orderOf(markup), `order when ${direction}`).toEqual(
            EXPECTED_ORDER,
          );
        }
      }),
      { numRuns: 25 },
    );
  });

  it("folds the letter in a details element closed on first render, for any direction", () => {
    fc.assert(
      fc.property(pickedArb, directionArb, (picked, direction) => {
        const markup = renderStage3(picked, direction);
        expect(markup).toMatch(/<details[^>]*data-letter-disclosure=""[^>]*>/);
        expect(markup).not.toMatch(/<details[^>]* open[ >=]/);
      }),
      { numRuns: 50 },
    );
  });
});

describe("Property 8: the fold in the markup", () => {
  it("nests the letter text inside the folded disclosure", () => {
    const markup = renderStage3(ELIGIBLE.slice(0, 1), "up");
    const marker = markup.indexOf("data-letter-disclosure");
    const open = markup.lastIndexOf("<details", marker);
    const close = markup.indexOf("</details>", open);
    const letter = markup.indexOf("data-letter-text");
    expect(marker).toBeGreaterThanOrEqual(0);
    expect(open).toBeGreaterThanOrEqual(0);
    expect(letter).toBeGreaterThan(open);
    expect(letter).toBeLessThan(close);
  });
});
