// Builds the sealed payload for a live letter (spec 06, design.md
// "Components and Interfaces", build-payload.ts; R13.4 to R13.6, R14.1, R14.4).
//
// It follows buildPersonaPayload in scripts/seal-personas-core.ts. The
// differences: the reference date is the sealing day, the letter has no
// written_as_of, and the recall subjects come from RECALL_SUBJECTS.
//
// Pure module: no clock, no randomness, no I/O, so the same inputs always build
// the same payload. Safe in the browser and in tests.

import { RECALL_SUBJECTS } from "./recall-subjects";
import type { SelfReportedRow } from "./write-draft";
import { generateRecallQuestions } from "@/lib/recall";
import { payloadV1Schema, type MetricDefinitionV1, type PayloadV1 } from "@/lib/seal-format";
import type { LoadedFigures } from "@/lib/figures";
import { thenAndNow } from "@/lib/figures/then-now";

/**
 * Pick exactly the six {@link MetricDefinitionV1} keys from a series' metric, so
 * catalogue-only fields such as `period_type` never enter the payload (R14.4).
 * Returns a fresh object; the input is not changed.
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
 * The metric and the self-reported figure for one row (spec 08 later-tasks,
 * R26.3). `index` is the row's 0-based position, so the ID is `self-1` for the
 * first row. Only the outer whitespace is trimmed; the value stays as typed.
 */
function selfReportedEntry(
  row: SelfReportedRow,
  index: number,
  sealedAt: string,
): { metric: MetricDefinitionV1; figure: PayloadV1["figures"][number] } {
  const id = `self-${index + 1}`;
  const unit = row.unit.trim();
  const region = row.region.trim();
  return {
    metric: {
      id,
      display_name: row.name.trim(),
      unit,
      region,
      source: "self-reported",
      series_id: "self-reported",
    },
    figure: {
      kind: "self-reported",
      metric_id: id,
      value: row.value.trim(),
      unit,
      region,
      period: row.period.trim(),
      source: "self-reported",
      series_id: "self-reported",
      retrieved_at: sealedAt,
    },
  };
}

/**
 * Build the payload for one live letter.
 *
 * For each selected metric, in selection order, the "then" figure is
 * `thenAndNow(id, sealedDate, figures).then`. Each found figure is copied with a
 * spread, so no field changes and the value stays as published (R13.4). The
 * first metric with no "then" figure returns `{ ok: false, metricId }` and no
 * other metric is tried (R13.5, R13.6). Only official figures are used; a
 * self-reported figure never reaches the payload (R14.1).
 *
 * The recall questions come from `generateRecallQuestions` with the subjects in
 * RECALL_SUBJECTS. The result is checked with `payloadV1Schema.parse`, which
 * throws on any shape error. The caller passes a unique, listable selection, so
 * a missing subject or a duplicate id throws instead of building a bad letter.
 *
 * The Author_Question rows come first (C2.7, C2.8). `authorQuestions` must already
 * be trimmed with empty rows dropped (`questionsForSeal`). Row i becomes the
 * text question `a<i+1>` with no `metric_id`, so it can't collide with the
 * generator's `q<n>` IDs. A Real_Letter with no figures still builds, because
 * the schema has no minimum for metrics or figures (C2.9). A letter with no
 * official figure is still format version 1: its questions are v1 text
 * questions, and metrics and figures hold only the self-reported entries
 * (L1.7, Property 9).
 *
 * @param sealedDate the sealing day as "YYYY-MM-DD" (UTC), the reference date.
 */
export function buildLivePayload(input: {
  text: string;
  metricIds: readonly string[];
  authorQuestions: readonly string[];
  sealedDate: string;
  figures: LoadedFigures;
  /**
   * The visitor's own numbers (spec 08 later-tasks, R26.3). Each row becomes a
   * metric and a self-reported figure after the official ones, with no recall
   * question. Values, units, regions and periods are trimmed and otherwise kept
   * as typed. Defaults to none.
   */
  selfReported?: readonly SelfReportedRow[];
  /**
   * The sealing instant as an ISO UTC string. A self-reported figure's
   * retrieved_at is this instant. Required when there are self-reported rows.
   */
  sealedAt?: string;
}): { ok: true; payload: PayloadV1 } | { ok: false; metricId: string } {
  const { text, metricIds, authorQuestions, sealedDate, figures } = input;
  const selfReported = input.selfReported ?? [];
  if (selfReported.length > 0 && input.sealedAt === undefined) {
    throw new Error("buildLivePayload: sealedAt is required with self-reported rows");
  }

  const metrics: MetricDefinitionV1[] = [];
  const payloadFigures: PayloadV1["figures"] = [];
  const subjects: string[] = [];

  for (const metricId of metricIds) {
    const then = thenAndNow(metricId, sealedDate, figures).then;
    if (!then.found) {
      // The first metric without a "then" figure fails the whole build (R13.5).
      return { ok: false, metricId };
    }

    const series = figures.series.get(metricId);
    if (series === undefined) {
      // thenAndNow found a figure, so the series exists. Fail the metric rather
      // than build an invalid payload if that ever changes.
      return { ok: false, metricId };
    }

    payloadFigures.push({ ...then.figure });
    metrics.push(pickMetricDefinition(series.metric));
    subjects.push(RECALL_SUBJECTS[metricId]);
  }

  const authorItems = authorQuestions.map((questionText, i) => ({
    id: `a${i + 1}`,
    answer_type: "text" as const,
    text: questionText,
  }));

  const recall_questions = [
    ...authorItems,
    ...generateRecallQuestions(
      metrics.map((metric, i) => ({
        metric,
        recall_subject: subjects[i],
      })),
    ),
  ];

  // No written_as_of: a live letter is sealed on its day, not written "as of" one.
  const selfMetrics: MetricDefinitionV1[] = [];
  const selfFigures: PayloadV1["figures"] = [];
  selfReported.forEach((row, index) => {
    const entry = selfReportedEntry(row, index, input.sealedAt ?? "");
    selfMetrics.push(entry.metric);
    selfFigures.push(entry.figure);
  });

  const payload = payloadV1Schema.parse({
    format_version: 1,
    letter_text: text,
    metrics: [...metrics, ...selfMetrics],
    figures: [...payloadFigures, ...selfFigures],
    recall_questions,
  });

  return { ok: true, payload };
}
