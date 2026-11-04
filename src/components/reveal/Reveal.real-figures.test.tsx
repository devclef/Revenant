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
 * sealing script uses. The "now" figures are `thenAndNow(...).now` from the
 * same file. Nothing here reads a fixture file, mocks the figure module, or
 * makes a network request. Rendered with `renderToStaticMarkup`, as the other
 * reveal tests are.
 *
 * Checks, per persona:
 *
 * - no "fixture data" label and no fixture note appear, because every figure
 *   is real;
 * - each then figure carries "historical record, retrieved {date}" with the
 *   UTC calendar date of its retrieved_at;
 * - each then and each now figure shows its own label, period, unit and region
 *   inside its own group, so a value on one figure cannot pass because another
 *   figure shows it.
 *
 * Each figure renders as one group that ends with its closing `</details>` tag
 * (see FigureLine). Splitting the markup on that tag gives one group per
 * figure, in render order: then, then now (when a now figure exists), then the
 * next metric.
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

// The unit a figure is shown in: the series' display rescale unit when one is
// set, otherwise the figure's own unit.
function shownUnit(figure: Readonly<FigureV1>): string {
  const rescale = DEMO_FIGURES.series.get(figure.metric_id)?.display_rescale;
  return rescale === undefined ? figure.unit : rescale.unit;
}

// The UTC calendar date of an ISO instant, formatted in the reveal's long form.
function utcLongDate(retrievedAt: string): string {
  return UTC_LONG_DATE.format(
    new Date(`${retrievedAt.slice(0, 10)}T00:00:00.000Z`),
  );
}

type ExpectedGroup = {
  kind: "then" | "now";
  label: string;
  period: string;
  unit: string;
  region: string;
};

function openedFor(
  persona: (typeof PERSONAS)[number],
): {
  opened: Opened;
  expected: ExpectedGroup[];
} {
  const metrics = persona.metrics.map((m) => metricFor(m.metric_id));
  const thenFigures: Readonly<FigureV1>[] = [];
  const expected: ExpectedGroup[] = [];

  for (const m of persona.metrics) {
    const { then, now } = thenAndNow(
      m.metric_id,
      persona.written_as_of,
      DEMO_FIGURES,
    );
    if (!then.found) {
      throw new Error(
        `test setup: no then figure for ${persona.key} ${m.metric_id}`,
      );
    }
    thenFigures.push(then.figure);

    // Then group: the label carries the UTC calendar date of retrieved_at.
    expected.push({
      kind: "then",
      label: `historical record, retrieved ${utcLongDate(then.figure.retrieved_at)}`,
      period: formatPeriod(then.figure.period, then.figure.region),
      unit: shownUnit(then.figure),
      region: then.figure.region,
    });

    // Now group, when the now figure exists. Its label is "retrieved {date}".
    if (now.found) {
      expected.push({
        kind: "now",
        label: `retrieved ${utcLongDate(now.figure.retrieved_at)}`,
        period: formatPeriod(now.figure.period, now.figure.region),
        unit: shownUnit(now.figure),
        region: now.figure.region,
      });
    }
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

  return { opened, expected };
}

// Splits the rendered markup into one group per figure. Each figure's stamp or
// line ends with its closing `</details>`, so the markup up to and including
// each such tag is one group. The text after the last tag holds no figure and
// is dropped.
function figureGroups(markup: string): string[] {
  const parts = markup.split("</details>");
  return parts.slice(0, -1).map((part) => `${part}</details>`);
}

describe("FiguresThenNow with the committed personas and real figures", () => {
  it("has at least one persona to check", () => {
    expect(PERSONAS.length).toBeGreaterThan(0);
  });

  for (const persona of PERSONAS) {
    describe(`persona ${persona.key}`, () => {
      const { opened, expected } = openedFor(persona);
      const markup = renderToStaticMarkup(
        createElement(FiguresThenNow, { opened }),
      );
      const groups = figureGroups(markup);

      it("shows no fixture label", () => {
        expect(markup).not.toContain(REVEAL_COPY.labelFixtureData);
      });

      it("shows no fixture note", () => {
        expect(markup).not.toContain(htmlText(REVEAL_COPY.fixtureNote));
      });

      // Spec 07 R14.3: one Figure_Entry per metric, holding its then and now
      // figures, so the groups count the then figures only.
      it("renders one Figure_Entry per metric", () => {
        const thenCount = expected.filter((want) => want.kind === "then").length;
        expect(groups).toHaveLength(thenCount);
      });

      it("shows the label, period, unit and region of each figure in its own group", () => {
        expected.forEach((want) => {
          expect(
            groups.some((group) => group.includes(htmlText(want.label))),
            want.label,
          ).toBe(true);
          expect(
            groups.some(
              (group) =>
                group.includes(htmlText(want.label)) &&
                group.includes(htmlText(want.period)) &&
                group.includes(htmlText(want.unit)) &&
                group.includes(htmlText(want.region)),
            ),
            want.label,
          ).toBe(true);
        });
      });
    });
  }
});
