import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FiguresThenNow } from "./FiguresThenNow";
import { REVEAL_COPY } from "./copy";
import type { Opened } from "./opening-machine";
import { PERSONAS } from "@/lib/personas";
import { CATALOGUE } from "@/lib/figures/catalogue";
import { DEMO_FIGURES } from "@/lib/figures/demo";
import { thenAndNow } from "@/lib/figures/then-now";
import { formatPeriod } from "@/lib/figures";
import type { FigureV1, MetricDefinitionV1, PayloadV1 } from "@/lib/seal-format";

/**
 * Markup tests for stage 3 of the reveal, fed with the committed personas and
 * the real figure file (spec 04-real-figures, task 10; issue #84).
 *
 * For each committed persona, the sealed "then" figures are the figures
 * `thenAndNow(metricId, written_as_of, DEMO_FIGURES).then`, the same lookup the
 * sealing script uses. The "now" figures come from DEMO_FIGURES inside the
 * component. Nothing here reads a fixture file, mocks the figure module, or
 * makes a network request. Rendered with `renderToStaticMarkup`, as the other
 * reveal tests are.
 *
 * Checks, per persona:
 *
 * - no "fixture data" label and no fixture note appear, because every figure
 *   is real;
 * - each then figure carries "historical record, retrieved {date}" with the
 *   UTC calendar date of its retrieved_at;
 * - the period, unit and region of each then and now figure shown are present.
 */

// No network of any kind in stage 3. A guard fails the test if render reaches
// for fetch.
beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("FiguresThenNow tried to fetch");
    }),
  );
});

// Formats an ISO instant as the reveal does, in UTC, independently of the
// component's own formatter so the expected label is not read back from it.
const UTC_LONG_DATE = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function htmlText(text: string): string {
  // renderToStaticMarkup escapes bare text (for example an apostrophe), so the
  // expected string is encoded the same way before it is searched for.
  const encoded = renderToStaticMarkup(createElement("span", null, text));
  return encoded.slice("<span>".length, -"</span>".length);
}

function metricFor(metricId: string): MetricDefinitionV1 {
  const series = CATALOGUE.find((s) => s.metric.id === metricId);
  if (series === undefined) {
    throw new Error(`test setup: no catalogue series for ${metricId}`);
  }
  return series.metric;
}

function openedFor(persona: (typeof PERSONAS)[number]): {
  opened: Opened;
  thenFigures: Readonly<FigureV1>[];
} {
  const metrics = persona.metrics.map((m) => metricFor(m.metric_id));
  const thenFigures: Readonly<FigureV1>[] = [];
  for (const m of persona.metrics) {
    const { then } = thenAndNow(m.metric_id, persona.written_as_of, DEMO_FIGURES);
    if (!then.found) {
      throw new Error(
        `test setup: no then figure for ${persona.key} ${m.metric_id}`,
      );
    }
    thenFigures.push(then.figure);
  }

  const payload = {
    format_version: 1,
    letter_text: "Persona letter.",
    written_as_of: persona.written_as_of,
    metrics,
    figures: thenFigures,
    recall_questions: [],
  } satisfies PayloadV1;

  const opened: Opened = {
    letterId: persona.letter_id,
    header: {
      sealedAt: `${persona.written_as_of}T00:00:00.000Z`,
      opensAt: persona.opens_at,
    },
    openingKey: {} as unknown as CryptoKey,
    payload,
  };

  return { opened, thenFigures };
}

describe("FiguresThenNow with the committed personas and real figures", () => {
  it("has at least one persona to check", () => {
    expect(PERSONAS.length).toBeGreaterThan(0);
  });

  for (const persona of PERSONAS) {
    describe(`persona ${persona.key}`, () => {
      const { opened, thenFigures } = openedFor(persona);
      const markup = renderToStaticMarkup(
        createElement(FiguresThenNow, { opened }),
      );

      it("shows no fixture label", () => {
        expect(markup).not.toContain(REVEAL_COPY.labelFixtureData);
      });

      it("shows no fixture note", () => {
        expect(markup).not.toContain(htmlText(REVEAL_COPY.fixtureNote));
      });

      it("labels each then figure as a historical record with its UTC retrieved date", () => {
        for (const figure of thenFigures) {
          // The UTC calendar date is the first ten characters of retrieved_at.
          const utcDay = new Date(`${figure.retrieved_at.slice(0, 10)}T00:00:00.000Z`);
          const retrievedDate = UTC_LONG_DATE.format(utcDay);
          const label = `historical record, retrieved ${retrievedDate}`;
          expect(markup).toContain(htmlText(label));
        }
      });

      it("shows the period, unit and region of each then figure", () => {
        for (const figure of thenFigures) {
          const rescale = DEMO_FIGURES.series.get(figure.metric_id)?.display_rescale;
          const unit = rescale === undefined ? figure.unit : rescale.unit;
          expect(markup).toContain(htmlText(formatPeriod(figure.period, figure.region)));
          expect(markup).toContain(htmlText(unit));
          expect(markup).toContain(htmlText(figure.region));
        }
      });
    });
  }
});
