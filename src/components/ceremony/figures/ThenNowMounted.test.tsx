// Feature: 05-reveal-ceremony, Task 5 (task 2 of the passage, counter and
// then-and-now work, GitHub issue #99)
//
// Mounted test for the real reveal stage 3: the same tree Reveal.tsx mounts
// (ThenNowSequence wrapping FiguresThenNow) rendered with its providers. It
// checks the final state the reader sees, with no DOM library, matching the
// existing reveal test style (renderToStaticMarkup and createElement).
//
// Assertions:
// - every [data-counter] cell exists, and every cell is equal once its digits
//   are replaced (R10.6, R11.2);
// - the change line and its formula line sit inside the [data-change] block
//   that the stage 3 change fade animates (R10.5, R12.8).

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { REVEAL_COPY } from "@/components/reveal/copy";
import { FiguresThenNow } from "@/components/reveal/FiguresThenNow";
import type { Opened } from "@/components/reveal/opening-machine";
import type { RecallRecordV1 } from "@/lib/recall";
import { DEMO_FIGURES } from "@/lib/figures/demo";
import { thenAndNow } from "@/lib/figures/then-now";
import type { FigureV1, MetricDefinitionV1, PayloadV1 } from "@/lib/seal-format";

import {
  planThenNow,
  ThenNowSequence,
  type ThenNowSequenceProps,
} from "./ThenNowSequence";
import { LocalViewProvider } from "../local-view";
import { MotionProvider } from "../motion";
import { SkipProvider } from "../skip";

const SEALED_AT = "2026-10-27T00:00:00.000Z";
const GAS_ID = "fixture-us-gasoline-regular";

// The now figure comes from the same frozen catalogue stage 3 reads.
const { now } = thenAndNow(GAS_ID, SEALED_AT.slice(0, 10), DEMO_FIGURES);
if (!now.found) throw new Error("test setup: no now figure for the gasoline series");
const GAS_NOW: Readonly<FigureV1> = now.figure;

const GAS_METRIC: MetricDefinitionV1 = {
  id: GAS_ID,
  display_name: "Regular gasoline (fixture)",
  unit: GAS_NOW.unit,
  region: GAS_NOW.region,
  source: GAS_NOW.source,
  series_id: GAS_NOW.series_id,
};

const Q_GAS = {
  id: "q-gas",
  answer_type: "number" as const,
  text: "What do you think a gallon of regular gasoline cost then?",
  metric_id: GAS_ID,
};

// A then figure in the same series as the now figure, from an earlier period,
// so the pair is comparable and one change line is drawn.
const GAS_THEN: Readonly<FigureV1> = {
  ...GAS_NOW,
  value: "3.000",
  period: "2023-11-06",
};

const PAYLOAD: PayloadV1 = {
  format_version: 1,
  letter_text: "A short sealed letter.",
  written_as_of: "2023-11-06",
  metrics: [GAS_METRIC],
  figures: [GAS_THEN],
  recall_questions: [Q_GAS],
};

const RECORD: RecallRecordV1 = {
  version: 1,
  answers: [{ question_id: "q-gas", kind: "number", value: "3.50" }],
};

const OPENED: Opened = {
  letterId: "letter-mounted",
  header: { sealedAt: SEALED_AT, opensAt: "2026-11-05T00:00:00.000Z" },
  openingKey: {} as unknown as CryptoKey,
  payload: PAYLOAD,
};

/** Mounts stage 3 the way Reveal.tsx does, and returns its final markup. */
function mountStageThree(): string {
  const entries = OPENED.payload.figures.map((figure, index) => ({
    key: `${figure.metric_id}-${index}`,
  }));
  const sequenceProps: ThenNowSequenceProps = {
    entries,
    children: createElement(FiguresThenNow, { opened: OPENED, record: RECORD }),
  };
  return renderToStaticMarkup(
    createElement(
      LocalViewProvider,
      null,
      createElement(
        SkipProvider,
        null,
        createElement(
          MotionProvider,
          null,
          createElement(ThenNowSequence, sequenceProps),
        ),
      ),
    ),
  );
}

/**
 * Every `[data-counter]` cell in a markup string, each as its own substring.
 * A cell ends where its own `<span>` closes, found by counting nested spans.
 */
function counterCells(html: string): string[] {
  const marker = 'data-counter="digit"';
  const cells: string[] = [];
  let from = 0;
  for (;;) {
    const at = html.indexOf(marker, from);
    if (at === -1) break;
    const start = html.lastIndexOf("<span", at);
    const spans = /<span\b|<\/span>/g;
    spans.lastIndex = start;
    let depth = 0;
    let end = html.length;
    for (let m = spans.exec(html); m !== null; m = spans.exec(html)) {
      if (m[0] === "</span>") {
        depth -= 1;
        if (depth === 0) {
          end = m.index + m[0].length;
          break;
        }
      } else {
        depth += 1;
      }
    }
    cells.push(html.slice(start, end));
    from = end;
  }
  return cells;
}

/** The inner markup of every change block (the element with data-change). */
function changeBlocks(html: string): string[] {
  return [...html.matchAll(/<div[^>]*data-change=""[^>]*>([\s\S]*?)<\/div>/g)].map(
    (m) => m[1] ?? "",
  );
}

describe("mounted reveal stage 3: counters (R10.6, R11.2)", () => {
  it("renders [data-counter] cells that are all equal once their digits are replaced", () => {
    const html = mountStageThree();
    const cells = counterCells(html);

    // The then and now stamps each roll a counter, so there are cells to compare.
    expect(cells.length).toBeGreaterThan(0);

    const digitless = cells.map((cell) => cell.replace(/\d/g, "#"));
    const reference = digitless[0];
    for (const cell of digitless) {
      expect(cell).toBe(reference);
    }
  });
});

describe("mounted reveal stage 3: the change fade (R10.5, R12.8)", () => {
  it("puts the change and formula lines inside the data-change block that fades", () => {
    const html = mountStageThree();
    const blocks = changeBlocks(html);

    // One comparable entry, so exactly one change block.
    expect(blocks).toHaveLength(1);

    const [block] = blocks;
    expect(block).toContain(REVEAL_COPY.formulaLabel);
    expect(block).toMatch(/class="[^"]*formula[^"]*"/);
  });

  it("times the fade from the stage 3 plan, not from a literal", () => {
    const html = mountStageThree();
    const { changeFade } = planThenNow(
      OPENED.payload.figures.map((figure, index) => ({
        key: `${figure.metric_id}-${index}`,
      })),
    );

    expect(html).toContain(`--change-delay:${changeFade.startMs}ms`);
    expect(html).toContain(`--change-fade-ms:${changeFade.durationMs}ms`);
  });
});
