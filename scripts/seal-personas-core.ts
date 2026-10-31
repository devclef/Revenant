// Sealing_Script core (design.md "Sealing_Script", R4.1-R4.14, R2.8).
//
// All the logic of the persona-sealing script lives here, with every I/O
// dependency injected through `Deps`, so it can be driven from tests without a
// database, a clock or randomness. The bundle entry (scripts/seal-personas.ts)
// wires the real dependencies; this module imports no database client, reads no
// `process.env`, and never touches `scripts/*` beyond its own types.
//
// `buildPersonaPayload` is pure and deterministic: given the same persona,
// letter text and loaded figures it always builds a byte-identical canonical
// payload. That determinism is what lets `sealPersonas` (added in the next
// task) compare a freshly built payload against a stored one for idempotency.
//
// Import boundary: this module imports `@/lib/crypto` together with
// `@/lib/letter-store` types, which the crypto.md R14.6 exemption allows for
// the sealing script. Nothing under `src/` imports `scripts/`, so the web app
// never pulls crypto in through here; the frontend boundary test checks that.

import type { Persona } from "@/lib/personas";
import type { LetterRow } from "@/lib/letter-store/queries";
import { generateRecallQuestions } from "@/lib/recall";
import {
  payloadV1Schema,
  type PayloadV1,
  type MetricDefinitionV1,
} from "@/lib/seal-format";
import { thenAndNow } from "@/lib/figures/then-now";
import type { LoadedFigures } from "@/lib/figures";

/**
 * The outcome of sealing one persona (R4.11). A `stored` result means a new
 * `demo_letters` row was inserted; `skipped` means an identical row already
 * existed; `failed` carries the fixed {@link FailureReason} and never any
 * library error text or secret.
 */
export type PersonaResult =
  | { key: string; letterId: string; result: "stored" | "skipped" }
  | { key: string; letterId: string; result: "failed"; reason: FailureReason };

/**
 * Why sealing one persona failed. Each value is a fixed reason that maps to a
 * fixed output line; no error object or stored value is ever surfaced (R4.11).
 *
 * - `missing_then_figure`  — no figure at or before `written_as_of` for a
 *   tracked metric (R4.3). The output line names the metric ID.
 * - `stored_letter_differs` — a row exists for this ID but its sealed payload
 *   does not canonically equal the freshly built one, or the stored letter
 *   would not open (R4.8).
 * - `real_letter_collision` — the letter ID is already used by a real letter
 *   in `letters` (R4.9).
 * - `store_rejected`        — `storePersonaLetter` threw, e.g. a racing insert.
 * - `unexpected_error`      — anything else; the original error is dropped and
 *   never printed.
 */
export type FailureReason =
  | "missing_then_figure"
  | "stored_letter_differs"
  | "real_letter_collision"
  | "store_rejected"
  | "unexpected_error";

/**
 * A sealed-letter row as the sealing script reads it. This is the exact return
 * shape of `findLetter` in `@/lib/letter-store`, aliased here so `Deps` can be
 * stated without a second declaration.
 */
export type FoundLetter = LetterRow;

/**
 * Every I/O the sealing logic needs, injected so the core stays pure and
 * testable. The entry supplies the real implementations; tests supply fakes.
 */
export type Deps = {
  /** The personas to seal, in list order. */
  personas: readonly Persona[];
  /** Read one persona's letter text by its `letter_path`. */
  readLetterText(path: string): string;
  /** The loaded demo figures the "then" figure is taken from. */
  figures: LoadedFigures;
  /** Read an existing letter row by ID, or `null` when none exists. */
  findLetter(id: string): Promise<FoundLetter | null>;
  /** Insert one sealed persona letter. Throws on a rejected write. */
  storePersonaLetter(input: {
    envelope: unknown;
    envelopeHash: string;
    serverSecret: Uint8Array;
  }): Promise<void>;
  /** The current time, used only as `sealedAt`. */
  now(): Date;
  /** Fill `n` cryptographically random bytes (crypto.getRandomValues). */
  randomBytes(n: number): Uint8Array;
};

/**
 * Pick exactly the six {@link MetricDefinitionV1} keys from a series' metric,
 * so catalogue-only fields (for example `period_type`) never enter the payload
 * (R4.4). Returns a fresh object; the input is not mutated (R12.6-style purity).
 */
function pickMetricDefinition(metric: MetricDefinitionV1): MetricDefinitionV1 {
  return {
    id: metric.id,
    display_name: metric.display_name,
    unit: metric.unit,
    region: metric.region,
    source: metric.source,
    series_id: metric.series_id,
  };
}

/**
 * Build the sealed payload for one persona (R4.1, R4.2, R4.4, R2.8).
 *
 * For each tracked metric, in list order, it takes the "then" figure from
 * `thenAndNow(metricId, written_as_of, figures).then`. If that figure is
 * missing it returns `{ ok: false, metricId }` for the FIRST such metric. Each
 * found figure is copied with a plain spread, changing no field and keeping the
 * value string verbatim. The metric definition is the six-key pick from the
 * series' metric, and the recall questions come from `generateRecallQuestions`
 * over the metrics and their subjects. The assembled payload is validated with
 * `payloadV1Schema.parse`, which throws on any shape error.
 *
 * The function reads no clock and no randomness, so the same inputs always
 * build a byte-identical canonical payload. That determinism is what makes the
 * idempotency compare in `sealPersonas` meaningful.
 */
export function buildPersonaPayload(
  p: Persona,
  text: string,
  figures: LoadedFigures,
): { ok: true; payload: PayloadV1 } | { ok: false; metricId: string } {
  const metrics: MetricDefinitionV1[] = [];
  const payloadFigures: PayloadV1["figures"] = [];

  for (const { metric_id } of p.metrics) {
    const then = thenAndNow(metric_id, p.written_as_of, figures).then;
    if (!then.found) {
      // The first metric without a "then" figure fails the whole build (R4.3).
      return { ok: false, metricId: metric_id };
    }

    // Copy the figure with a plain spread: no field changed or added, and the
    // value string stays exactly as published (data-integrity.md).
    payloadFigures.push({ ...then.figure });

    const series = figures.series.get(metric_id);
    if (series === undefined) {
      // thenAndNow found a figure, so the series exists; this is unreachable in
      // practice. Fail the same metric rather than build an invalid payload.
      return { ok: false, metricId: metric_id };
    }
    metrics.push(pickMetricDefinition(series.metric));
  }

  const recall_questions = generateRecallQuestions(
    p.metrics.map((m, i) => ({
      metric: metrics[i],
      recall_subject: m.recall_subject,
    })),
  );

  const payload = payloadV1Schema.parse({
    format_version: 1,
    letter_text: text,
    written_as_of: p.written_as_of,
    metrics,
    figures: payloadFigures,
    recall_questions,
  });

  return { ok: true, payload };
}
