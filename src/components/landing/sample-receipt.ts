// Feature: 09-demo-polish (B3.4, B3.7)
//
// The data behind the Sample_Receipt: one browser GET /api/figures after
// hydration, parsed with parseFiguresResponse, and the first series in the
// response turned into the receipt's state. Pure apart from the injectable
// fetch, so it is safe in the browser and in tests. It never throws.

import {
  parseFiguresResponse,
  type FiguresResponseV1,
} from "@/lib/figures/now";
import type { FigureV1, MetricDefinitionV1 } from "@/lib/seal-format";

/** The fixed relative route. No origin, no query. */
export const SAMPLE_URL = "/api/figures";

/** How long the one request may take before it is aborted and treated as failed. */
export const SAMPLE_TIMEOUT_MS = 30_000;

export type SampleState =
  | { status: "loading" }
  | { status: "none" }
  | {
      status: "ready";
      metric: MetricDefinitionV1;
      figure: FigureV1;
      /** True for a Fallback_Figure: the figure from the bundled file (A1.8). */
      fallback: boolean;
    };

/**
 * Turns a parsed Figures_API body into the receipt state. The receipt uses the
 * first series only. A missing series, or one with `figure: null`, gives
 * `none`, so no number is shown.
 */
export function sampleFromResponse(body: FiguresResponseV1): SampleState {
  const first = body.series[0];
  if (first === undefined || first.figure === null) {
    return { status: "none" };
  }
  return {
    status: "ready",
    metric: first.metric,
    figure: first.figure,
    fallback: first.fallback ?? false,
  };
}

/**
 * Sends one `GET /api/figures` and resolves with the receipt state. Any failure
 * (a thrown fetch, an abort, a non-2xx status, a body that is not JSON, or a
 * body the parser rejects) gives `none`.
 */
export async function loadSampleFigure(
  fetchImpl: typeof fetch = fetch,
): Promise<SampleState> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SAMPLE_TIMEOUT_MS);
  try {
    const response = await fetchImpl(SAMPLE_URL, {
      cache: "default",
      credentials: "same-origin",
      referrerPolicy: "no-referrer",
      signal: controller.signal,
    });
    if (!response.ok) return { status: "none" };
    const parsed = parseFiguresResponse(await response.json());
    return parsed.ok ? sampleFromResponse(parsed.value) : { status: "none" };
  } catch {
    return { status: "none" };
  } finally {
    clearTimeout(timer);
  }
}
