// Feature: 16-remember-first, Property 11: A persona Remember screen names its date once
//
// For any written-as-of date and any persona question (figure or author, first
// or later, Priya's included), the visible text of the rendered Remember screen
// contains the formatted date exactly once. It is in the counter for a figure
// question and in the "As of {date} you asked yourself:" line for an author
// question. The live and /l/{id} screens (a sealing day, not a written-as-of
// date) are checked too, so they keep naming their own day once.
// Validates spec 16 Requirements 13.1, 13.2, 13.4, 13.5.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { RecallPager } from "./RecallPager";
import { RecallReader } from "./RecallReader";
import { REVEAL_COPY } from "@/components/reveal/copy";
import { formatCalendarDate } from "@/components/ui/letter-date";
import type { TestimonyEntry } from "@/components/reveal/opening-machine";
import type { PayloadV1 } from "@/lib/seal-format";

/** Persona windows from the spec: 2022 to 2026 covers every fixed window. */
const MIN_MS = Date.parse("2022-01-01T00:00:00.000Z");
const MAX_MS = Date.parse("2026-12-31T00:00:00.000Z");

/** A written-as-of date (`YYYY-MM-DD`) inside the persona windows' years. */
const dateArb = fc
  .integer({ min: MIN_MS, max: MAX_MS })
  .map((ms) => new Date(ms).toISOString().slice(0, 10));

/** A question list of 1 to 3 items, each a figure or an author question. */
const kindsArb = fc.array(
  fc.constantFrom("number", "text") as fc.Arbitrary<"number" | "text">,
  {
    minLength: 1,
    maxLength: 3,
  },
);

/** Builds the sealed payload slice the pager reads, one metric per figure. */
function payloadFor(
  kinds: readonly ("number" | "text")[],
): Pick<PayloadV1, "metrics" | "recall_questions"> {
  const metrics: Array<Record<string, string>> = [];
  const recall_questions = kinds.map((answer_type, i) => {
    if (answer_type === "number") {
      metrics.push({
        id: `m${i}`,
        display_name: `Metric ${i}`,
        unit: "USD per gallon",
        region: "U.S. city average",
        source: "Source",
        series_id: `SERIES-${i}`,
      });
      return {
        id: `q${i}`,
        answer_type,
        text: `What did metric ${i} cost then?`,
        metric_id: `m${i}`,
      };
    }
    return {
      id: `q${i}`,
      answer_type,
      text: `Author question ${i} in present tense?`,
    };
  });
  return { metrics, recall_questions } as unknown as Pick<
    PayloadV1,
    "metrics" | "recall_questions"
  >;
}

/** Visible text of rendered markup: tags removed, whitespace kept as one space. */
function visibleText(html: string): string {
  return html.replace(/<[^>]+>/g, " ");
}

/** How many times `needle` occurs as a whole date, not inside a longer number. */
function countDate(text: string, needle: string): number {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.match(new RegExp(`(?<!\\d)${escaped}(?!\\d)`, "g"))?.length ?? 0;
}

function renderPager(
  kinds: readonly ("number" | "text")[],
  index: number,
  extra: {
    writtenAsOf?: string;
    writtenOn?: { sealedAt: string; timeZone: string };
  },
): string {
  return renderToStaticMarkup(
    createElement(RecallPager, {
      payload: payloadFor(kinds),
      drafts: {},
      invalid: [],
      submitting: false,
      onEdit: () => {},
      onToggleNoAnswer: () => {},
      onSubmit: () => {},
      initialIndex: index,
      ...extra,
    }),
  );
}

describe("Property 11: a persona Remember screen names its written-as-of date once", () => {
  it("names the persona date exactly once on every question (figure and author)", () => {
    fc.assert(
      fc.property(dateArb, kindsArb, fc.nat(), (writtenAsOf, kinds, pick) => {
        const index = pick % kinds.length;
        const html = renderPager(kinds, index, { writtenAsOf });
        const expected = formatCalendarDate(writtenAsOf);
        expect(countDate(visibleText(html), expected)).toBe(1);
      }),
      { numRuns: 200 },
    );
  });

  it("puts the date in the 'As of' line for an author question and in the counter for a figure", () => {
    fc.assert(
      fc.property(dateArb, (writtenAsOf) => {
        const expected = formatCalendarDate(writtenAsOf);
        const asked = renderPager(["text"], 0, { writtenAsOf });
        expect(asked).toContain(
          REVEAL_COPY.askedAsOf.replace("{date}", expected),
        );
        const figure = renderPager(["number"], 0, { writtenAsOf });
        expect(figure).toContain(
          REVEAL_COPY.questionCounterAsOf.replace("{date}", expected),
        );
      }),
      { numRuns: 100 },
    );
  });

  it("does not repeat the persona date in the Remember intro on the first question", () => {
    fc.assert(
      fc.property(dateArb, kindsArb, (writtenAsOf, kinds) => {
        const html = renderPager(kinds, 0, { writtenAsOf });
        expect(html).toContain(REVEAL_COPY.recallIntro);
        expect(REVEAL_COPY.recallIntro).not.toContain("{date}");
      }),
      { numRuns: 50 },
    );
  });

  it("Priya's reading walk names the date once on every question", () => {
    const testimony: TestimonyEntry[] = [
      {
        question: "What were you looking forward to most?",
        answer: "The coast trip.",
      },
      { question: "What were you worried about?", answer: "The extra shift." },
      { question: "What did you plan next?", answer: "A short course." },
    ];
    fc.assert(
      fc.property(dateArb, fc.nat(), (writtenAsOf, pick) => {
        const index = pick % testimony.length;
        const html = renderToStaticMarkup(
          createElement(RecallReader, {
            testimony,
            index,
            onNext: () => {},
            onReadDone: () => {},
            writtenAsOf,
          }),
        );
        expect(
          countDate(visibleText(html), formatCalendarDate(writtenAsOf)),
        ).toBe(1);
      }),
      { numRuns: 100 },
    );
  });

  it("leaves the live screen's sealing-day line alone: the sealing day appears once", () => {
    fc.assert(
      fc.property(dateArb, kindsArb, fc.nat(), (day, kinds, pick) => {
        const index = pick % kinds.length;
        const html = renderPager(kinds, index, {
          writtenOn: { sealedAt: `${day}T12:00:00.000Z`, timeZone: "UTC" },
        });
        expect(countDate(visibleText(html), formatCalendarDate(day))).toBe(1);
        expect(html).not.toContain(REVEAL_COPY.askedAsOf.split("{date}")[0]);
      }),
      { numRuns: 150 },
    );
  });
});
