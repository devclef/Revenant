// The Seal_Page reads its figures from GET /api/figures (issue #202). These
// tests cover the pure mapping from that response to the picker and the sealed
// figures, and that a failed request leaves nothing to seal with.

import { describe, expect, it } from "vitest";

import { loadFigures, type FiguresState } from "@/components/reveal/figures-api";
import {
  figuresResponseFrom,
  figuresStateFrom,
} from "@/components/reveal/figures-stub";
import { DEMO_FIGURES } from "@/lib/figures/demo";
import { thenAndNow } from "@/lib/figures/then-now";
import type { FiguresResponseV1 } from "@/lib/figures/now";

import { loadedFiguresFromResponse, listPickableFromResponse, sealFiguresFrom } from "./catalogue-list";

const FIRST_ID = [...DEMO_FIGURES.series.keys()][0]!;
const TODAY = "2026-11-06";

function withoutSeries(response: FiguresResponseV1, metricId: string) {
  return {
    ...response,
    series: response.series.filter((s) => s.metric.id !== metricId),
  } as FiguresResponseV1;
}

describe("the picker reads from the Figures_API response", () => {
  it("lists the series in the response and nothing else", async () => {
    const response = figuresResponseFrom(DEMO_FIGURES);
    const trimmed = withoutSeries(response, FIRST_ID);

    const ids = listPickableFromResponse(trimmed).map((s) => s.metricId);

    expect(ids).not.toContain(FIRST_ID);
    expect(ids).toHaveLength(response.series.length - 1);
  });

  it("shows the latest period of each series as the response gives it", () => {
    const response = figuresResponseFrom(DEMO_FIGURES);

    for (const item of listPickableFromResponse(response)) {
      const entry = response.series.find((s) => s.metric.id === item.metricId)!;
      expect(item.latestPeriod).toBe(entry.figure!.period);
    }
  });

  it("leaves out a series whose figure is null", () => {
    const response = figuresResponseFrom(DEMO_FIGURES);
    const emptied = {
      ...response,
      series: response.series.map((s, i) =>
        i === 0 ? { ...s, figure: null } : s,
      ),
    } as FiguresResponseV1;

    const ids = listPickableFromResponse(emptied).map((s) => s.metricId);

    expect(ids).not.toContain(response.series[0]!.metric.id);
  });
});

describe("the sealed figures come from the same response", () => {
  it("picks the then figure from the response, the same one the reveal shows as now", () => {
    const response = figuresResponseFrom(DEMO_FIGURES);
    const loaded = loadedFiguresFromResponse(response);

    const then = thenAndNow(FIRST_ID, TODAY, loaded).then;
    const entry = response.series.find((s) => s.metric.id === FIRST_ID)!;

    expect(then.found).toBe(true);
    if (then.found) expect(then.figure).toEqual(entry.figure);
  });
});

describe("sealing is blocked when the figures request fails", () => {
  it("gives no figures when the request returns a non-2xx status", async () => {
    const failed = await loadFigures(
      (async () => new Response("nope", { status: 500 })) as unknown as typeof fetch,
    );

    const sealing = sealFiguresFrom(failed);

    expect(failed.status).toBe("failed");
    expect(sealing).toEqual({ status: "failed" });
  });

  it("gives no figures while the request is in flight", () => {
    const loading: FiguresState = { status: "loading" };

    expect(sealFiguresFrom(loading)).toEqual({ status: "loading" });
  });

  it("never falls back to the bundled figures", () => {
    const sealing = sealFiguresFrom({ status: "failed" });

    expect("pickable" in sealing).toBe(false);
    expect("figures" in sealing).toBe(false);
  });

  it("offers the figures once the response is ready", async () => {
    const ready = await figuresStateFrom(DEMO_FIGURES);

    const sealing = sealFiguresFrom(ready);

    expect(sealing.status).toBe("ready");
  });
});
