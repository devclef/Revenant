// Feature: 09-demo-polish, Property 4: the reveal shows the sealed figure and
// exactly one now outcome (issue #339, X3).
//
// For any Figures_API state, FiguresThenNow always draws the sealed then figure
// with its own period. For the now side it draws exactly one outcome: the
// loading line, the request-failed line, the retired line, the not-yet line,
// the bundled Bundled_Note, or a stored now figure with no note. The change line
// is drawn only when computeChange says the pair is comparable.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { FiguresThenNow } from "./FiguresThenNow";
import { REVEAL_COPY } from "./copy";
import type { FiguresState } from "./figures-api";
import type { Opened } from "./opening-machine";
import { nowMessageFor } from "./now-message";
import { computeChange, formatPeriod, formatValue } from "@/lib/figures";
import type { FiguresResponseV1 } from "@/lib/figures/now";
import type {
  FigureV1,
  MetricDefinitionV1,
  PayloadV1,
} from "@/lib/seal-format";

const METRIC: MetricDefinitionV1 = {
  id: "fuel",
  display_name: "Regular gasoline",
  unit: "USD per gallon",
  region: "U.S. city average",
  source: "U.S. EIA",
  series_id: "EMM_EPMR_PTE_NUS_DPG",
};

const THEN: Readonly<FigureV1> = {
  kind: "official",
  metric_id: METRIC.id,
  value: "3.412",
  unit: METRIC.unit,
  region: METRIC.region,
  period: "2024-10",
  source: METRIC.source,
  series_id: METRIC.series_id,
  retrieved_at: "2024-10-30T14:02:11Z",
  source_url: "https://www.eia.gov/series",
};

// The now figure from the same series, unit and region as THEN.
const NOW: Readonly<FigureV1> = {
  ...THEN,
  value: "3.900",
  period: "2026-10",
  retrieved_at: "2026-10-27T09:00:00Z",
};

const PAYLOAD: PayloadV1 = {
  format_version: 1,
  letter_text: "A short sealed letter.",
  written_as_of: "2024-10-30",
  metrics: [METRIC],
  figures: [THEN],
  recall_questions: [],
} as unknown as PayloadV1;

const OPENED: Opened = {
  letterId: "letter-prop4",
  header: {
    sealedAt: "2026-10-27T00:00:00.000Z",
    opensAt: "2026-11-05T00:00:00.000Z",
  },
  openingKey: {} as unknown as CryptoKey,
  envelopeHash:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  payload: PAYLOAD,
};

// The four states the now side can be in, plus the stored and fallback found
// figures. "stored" and "fallback" differ only in the series `fallback` flag.
type Outcome =
  | { kind: "loading" }
  | { kind: "failed" }
  | { kind: "series_missing" }
  | { kind: "no_figure" }
  | { kind: "found"; fallback: boolean; nowPeriod: string };

const OUTCOME: fc.Arbitrary<Outcome> = fc.oneof(
  fc.constant<Outcome>({ kind: "loading" }),
  fc.constant<Outcome>({ kind: "failed" }),
  fc.constant<Outcome>({ kind: "series_missing" }),
  fc.constant<Outcome>({ kind: "no_figure" }),
  fc.record({
    kind: fc.constant("found" as const),
    fallback: fc.boolean(),
    nowPeriod: fc.constantFrom("2025-01", "2026-03", "2026-10"),
  }),
);

// The retrieved instant of a fallback figure. The note's date is taken from it,
// so the expected note and the rendered note read the same figure.
const FALLBACK_RETRIEVED = "2026-10-30T14:02:11Z";

function stateFor(outcome: Outcome): FiguresState {
  if (outcome.kind === "loading") return { status: "loading" };
  if (outcome.kind === "failed") return { status: "failed" };

  const figure: Readonly<FigureV1> =
    outcome.kind === "found"
      ? {
          ...NOW,
          period: outcome.nowPeriod,
          retrieved_at: outcome.fallback
            ? "2026-10-30T14:02:11Z"
            : NOW.retrieved_at,
        }
      : NOW;

  const series =
    outcome.kind === "series_missing"
      ? []
      : [
          {
            metric: {
              source: METRIC.source,
              series_id: METRIC.series_id,
              unit: METRIC.unit,
              region: METRIC.region,
            },
            period_type: "month",
            last_success_at: null,
            figure: outcome.kind === "no_figure" ? null : figure,
            fallback: outcome.kind === "found" ? outcome.fallback : false,
          },
        ];

  const body = {
    format: "revenant-figures-v1",
    generated_at: "2026-10-27T00:00:00Z",
    source_mode: "file",
    series,
  } as unknown as FiguresResponseV1;

  return { status: "ready", figures: body } as FiguresState;
}

// The now-side outcome lines. Exactly one of these (or the stored now row) must
// appear for every state.
function nowLines(outcome: Outcome): string[] {
  switch (outcome.kind) {
    case "loading":
      return [REVEAL_COPY.nowLoading];
    case "failed":
      return [REVEAL_COPY.nowRequestFailed];
    case "series_missing":
      return [REVEAL_COPY.nowRetired];
    case "no_figure":
      return [REVEAL_COPY.nowNotYet];
    case "found": {
      const note = nowMessageFor({
        kind: "found",
        fallback: outcome.fallback,
        retrievedAt: FALLBACK_RETRIEVED,
      });
      return outcome.fallback && note !== null ? [note] : [];
    }
  }
}

// Apostrophes are entity-encoded in static markup, so the copy is encoded the
// same way before it is searched for (as in FiguresThenNow.test.tsx).
const encoded = (text: string): string =>
  renderToStaticMarkup(createElement("span", null, text)).slice(
    "<span>".length,
    -"</span>".length,
  );

const count = (html: string, needle: string): number =>
  html.split(needle).length - 1;

function render(state: FiguresState): string {
  return renderToStaticMarkup(
    createElement(FiguresThenNow, { opened: OPENED, figures: state }),
  );
}

describe("FiguresThenNow, Property 4: sealed figure plus exactly one now outcome (issue #339, X3)", () => {
  it("always shows the sealed figure with its period, and one now outcome", () => {
    fc.assert(
      fc.property(OUTCOME, (outcome) => {
        const html = render(stateFor(outcome));

        // The sealed then figure, with its own period, is always drawn.
        expect(html).toContain(formatValue(THEN.value, THEN.region));
        expect(html).toContain(formatPeriod(THEN.period, THEN.region));

        // Exactly one now outcome: a stored now figure shows its own row and no
        // note; every other state shows one line and no now value.
        const lines = nowLines(outcome);
        const outcomeCount = lines.reduce(
          (total, line) => total + count(html, encoded(line)),
          0,
        );
        if (outcome.kind === "found" && !outcome.fallback) {
          expect(outcomeCount).toBe(0);
          expect(html).toContain('data-role="now"');
        } else {
          expect(outcomeCount).toBe(1);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("draws the change line only when the then and now figures are comparable", () => {
    fc.assert(
      fc.property(OUTCOME, (outcome) => {
        const html = render(stateFor(outcome));
        const hasNowFigure = outcome.kind === "found";
        const comparable = hasNowFigure
          ? computeChange(THEN, {
              ...NOW,
              period: outcome.nowPeriod,
            }).comparable
          : false;
        // The formula label is the mark of a drawn change line.
        const drawn = html.includes(`${REVEAL_COPY.formulaLabel}:`);
        expect(drawn).toBe(comparable);
      }),
      { numRuns: 100 },
    );
  });
});
