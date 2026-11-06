// The browser's side of the Figures_API (spec 08-judge-polish, design "The
// Figures_API" and Property 24).
//
// parseFiguresResponse checks the body of GET /api/figures. pickNow finds the
// "now" figure for one sealed official figure by its series alone: the entry
// whose source, series ID, unit and region all equal the sealed metric's. The
// response carries no letter data, so the server never learns what a letter
// tracks (tech.md, "Opening" step 5).
//
// Pure module: imports only the sealed-format schemas and zod, so it is safe in
// the browser and on the server.

import { z } from "zod";

import {
  figureV1Schema,
  metricDefinitionV1Schema,
  type FigureV1,
  type MetricDefinitionV1,
} from "@/lib/seal-format";

/** The body of GET /api/figures, format revenant-figures-v1. */
export const figuresResponseV1Schema = z.strictObject({
  format: z.literal("revenant-figures-v1"),
  generated_at: z.string(),
  source_mode: z.enum(["db", "file"]),
  series: z.array(
    z.strictObject({
      metric: metricDefinitionV1Schema,
      period_type: z.enum(["weekly", "monthly"]),
      last_success_at: z.string().nullable(),
      figure: figureV1Schema.nullable(),
      // True when the figure came from the bundled fallback file rather than
      // the database. Optional: a body without it means false.
      fallback: z.boolean().optional(),
    }),
  ),
});

export type FiguresResponseV1 = z.infer<typeof figuresResponseV1Schema>;

export type ParseFiguresResponse =
  | { ok: true; value: FiguresResponseV1 }
  | { ok: false };

/**
 * Checks an unknown body against the Figures_API shape. Any mismatch gives
 * `{ ok: false }`, which the reveal treats as a failed request.
 */
export function parseFiguresResponse(body: unknown): ParseFiguresResponse {
  const result = figuresResponseV1Schema.safeParse(body);
  return result.success ? { ok: true, value: result.data } : { ok: false };
}

export type PickNowResult =
  | { found: true; figure: FigureV1; fallback: boolean }
  | { found: false; reason: "series_missing" | "no_figure" };

/**
 * Picks the now figure for a sealed official figure. The match uses the
 * metric's source, series ID, unit and region, and nothing else (Property 24).
 *
 * - An entry matches and holds a figure: `found: true`.
 * - An entry matches with `figure: null`: `no_figure`.
 * - No entry matches, or the sealed figure is self-reported: `series_missing`.
 */
export function pickNow(
  then: FigureV1,
  metric: MetricDefinitionV1,
  response: FiguresResponseV1,
): PickNowResult {
  if (then.kind === "self-reported") {
    return { found: false, reason: "series_missing" };
  }

  const entry = response.series.find(
    (s) =>
      s.metric.source === metric.source &&
      s.metric.series_id === metric.series_id &&
      s.metric.unit === metric.unit &&
      s.metric.region === metric.region,
  );

  if (entry === undefined) {
    return { found: false, reason: "series_missing" };
  }
  if (entry.figure === null) {
    return { found: false, reason: "no_figure" };
  }
  return {
    found: true,
    figure: entry.figure,
    fallback: entry.fallback ?? false,
  };
}
