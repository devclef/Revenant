// Browser-side contract for last_success_at in GET /api/figures bodies (issue #400).
// last_success_at is a string from figure_fetch_runs, or null. parseFiguresResponse
// must accept both and reject any other type, so a bad value never reaches the
// reveal. All values here are fake test values, not published figures.

import { describe, expect, it } from "vitest";

import type { MetricDefinitionV1 } from "@/lib/seal-format";

import { parseFiguresResponse } from "./now";

const METRIC: MetricDefinitionV1 = {
  id: "us-gasoline-regular",
  display_name: "Regular gasoline",
  unit: "USD per gallon",
  region: "U.S.",
  source: "U.S. Energy Information Administration (EIA)",
  series_id: "EMM_EPMR_PTE_NUS_DPG",
};

function bodyWith(lastSuccessAt: unknown): unknown {
  return {
    format: "revenant-figures-v1",
    generated_at: "2026-11-13T10:00:00Z",
    source_mode: "db",
    series: [
      {
        metric: METRIC,
        period_type: "weekly",
        last_success_at: lastSuccessAt,
        figure: null,
      },
    ],
  };
}

describe("last_success_at in a figures body", () => {
  it("accepts an ISO UTC string from figure_fetch_runs", () => {
    const result = parseFiguresResponse(bodyWith("2026-11-13T09:00:00Z"));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.series[0].last_success_at).toBe(
        "2026-11-13T09:00:00Z",
      );
    }
  });

  it("accepts null when no successful run exists", () => {
    const result = parseFiguresResponse(bodyWith(null));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.series[0].last_success_at).toBeNull();
    }
  });

  it("rejects a Date object, since the body is JSON and carries strings only", () => {
    expect(
      parseFiguresResponse(bodyWith(new Date("2026-11-13T09:00:00Z"))).ok,
    ).toBe(false);
  });

  it("rejects a number in place of a timestamp string", () => {
    expect(parseFiguresResponse(bodyWith(1794579600)).ok).toBe(false);
  });

  it("rejects a body whose last_success_at key is missing", () => {
    const body = bodyWith("2026-11-13T09:00:00Z") as {
      series: Record<string, unknown>[];
    };
    delete body.series[0].last_success_at;

    expect(parseFiguresResponse(body).ok).toBe(false);
  });
});
