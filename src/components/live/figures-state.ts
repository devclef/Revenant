/**
 * The state of the GET /api/figures request as the live seal page sees it
 * (spec X2, issue #338). Sealing, waiting, testifying and reading never wait
 * on this request: a `failed` state only means the figures cannot be picked.
 *
 * `figuresStateFrom` is the one place that maps an outcome of the request to a
 * state. Every failure becomes `failed`: a rejected fetch, an abort (including
 * the 30 second timeout), a status other than 200, and a body that
 * `parseFiguresResponse` rejects.
 */

import {
  parseFiguresResponse,
  type FiguresResponseV1,
} from "@/lib/figures/now";

/** How long one figures request may take before it is aborted and failed. */
export const FIGURES_TIMEOUT_MS = 30_000;

export type FiguresState =
  | { status: "loading" }
  | { status: "ready"; figures: FiguresResponseV1 }
  | { status: "failed" };

/**
 * What happened to one request. `rejected` is a fetch that threw (offline,
 * DNS, a body that is not JSON). `aborted` is a request stopped by its own
 * timeout. `response` is an answer with a status and a parsed JSON body.
 */
export type FiguresOutcome =
  | { kind: "rejected" }
  | { kind: "aborted" }
  | { kind: "response"; status: number; body: unknown };

/** Maps one request outcome to the figures state. It never throws. */
export function figuresStateFrom(outcome: FiguresOutcome): FiguresState {
  if (outcome.kind === "rejected" || outcome.kind === "aborted") {
    return { status: "failed" };
  }
  if (outcome.status !== 200) return { status: "failed" };
  const parsed = parseFiguresResponse(outcome.body);
  return parsed.ok
    ? { status: "ready", figures: parsed.value }
    : { status: "failed" };
}
