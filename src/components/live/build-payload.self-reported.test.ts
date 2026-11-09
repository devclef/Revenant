// Self-reported rows in the live payload (spec 08 later-tasks, R26.3, R26.6).
// A row becomes a metric and a self-reported figure after the official ones,
// with its text trimmed and its value kept as typed. It gets no recall question,
// and the format stays version 1.

import { describe, expect, it } from "vitest";

import { payloadV1Schema, type PayloadV1 } from "@/lib/seal-format";

import { buildLivePayload } from "./build-payload";
import { catalogueMetric, makeFigures } from "./test-figures";
import type { SelfReportedRow } from "./write-draft";

const SEALED_DATE = "2026-11-09";
const SEALED_AT = "2026-11-09T19:09:47.219Z";

const figures = makeFigures([
  {
    metric: catalogueMetric("us-gasoline-regular"),
    figures: [{ period: "2026-10-26", value: "3.412" }],
  },
]);

const rentRow: SelfReportedRow = {
  name: "  Rent  ",
  value: " 950.5 ",
  unit: " per month ",
  region: " My city ",
  period: " 2026-09 ",
};

function build(selfReported: SelfReportedRow[], sealedAt = SEALED_AT) {
  const result = buildLivePayload({
    text: "A letter.",
    metricIds: ["us-gasoline-regular"],
    authorQuestions: [],
    sealedDate: SEALED_DATE,
    figures,
    selfReported,
    sealedAt,
  });
  if (!result.ok) throw new Error(`unexpected ${result.metricId}`);
  return result.payload;
}

describe("buildLivePayload with self-reported rows", () => {
  it("writes row n as metric self-n with source self-reported, after the official metrics", () => {
    const payload = build([rentRow, { ...rentRow, name: "Commute" }]);
    expect(payload.metrics.map((m) => m.id)).toEqual([
      "us-gasoline-regular",
      "self-1",
      "self-2",
    ]);
    expect(payload.metrics[1]).toEqual({
      id: "self-1",
      display_name: "Rent",
      unit: "per month",
      region: "My city",
      source: "self-reported",
      series_id: "self-reported",
    });
  });

  it("writes a self-reported figure with the value as typed, trimmed, and no source_url", () => {
    const payload = build([rentRow]);
    const figure = payload.figures[1];
    expect(figure).toEqual({
      kind: "self-reported",
      metric_id: "self-1",
      value: "950.5",
      unit: "per month",
      region: "My city",
      period: "2026-09",
      source: "self-reported",
      series_id: "self-reported",
      retrieved_at: SEALED_AT,
    });
    expect(figure).not.toHaveProperty("source_url");
  });

  it("writes no recall question for a self-reported row", () => {
    const withRows = build([rentRow, rentRow]);
    const without = build([]);
    expect(withRows.recall_questions).toEqual(without.recall_questions);
    expect(withRows.recall_questions).toHaveLength(1);
    expect(withRows.recall_questions.every((q) => q.metric_id !== "self-1")).toBe(true);
  });

  it("keeps the format version at 1 and parses the payload", () => {
    const payload: PayloadV1 = build([rentRow]);
    expect(payload.format_version).toBe(1);
    expect(payloadV1Schema.safeParse(payload).success).toBe(true);
  });

  it("builds the same payload as before when there are no rows", () => {
    const omitted = buildLivePayload({
      text: "A letter.",
      metricIds: ["us-gasoline-regular"],
      authorQuestions: [],
      sealedDate: SEALED_DATE,
      figures,
    });
    expect(omitted).toEqual({ ok: true, payload: build([]) });
    expect(build([]).figures).toHaveLength(1);
  });

  it("needs sealedAt when there are rows, because the figure's retrieved_at is that instant", () => {
    const result = () =>
      buildLivePayload({
        text: "A letter.",
        metricIds: ["us-gasoline-regular"],
        authorQuestions: [],
        sealedDate: SEALED_DATE,
        figures,
        selfReported: [rentRow],
      });
    expect(result).toThrow(/sealedAt/);
  });
});
