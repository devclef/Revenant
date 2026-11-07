// Feature: 09-demo-polish (B3.4)
//
// SampleReceipt: the loader with a stubbed fetch (a figure, a Fallback_Figure,
// figure: null, a failed request) and the view's markup. No Accent class, no
// change or arrow on a figure element.

import type React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { REVEAL_COPY } from "@/components/reveal/copy";

import { LANDING_SECTION_COPY } from "./copy";
import { SampleReceiptView } from "./SampleReceiptView";
import {
  loadSampleFigure,
  sampleFromResponse,
  SAMPLE_URL,
  type SampleState,
} from "./sample-receipt";

const METRIC = {
  id: "us-gasoline",
  display_name: "Regular gasoline",
  unit: "USD per gallon",
  region: "U.S. city average",
  source: "U.S. EIA",
  series_id: "EMM_EPMR_PTE_NUS_DPG",
};

const FIGURE = {
  kind: "official",
  metric_id: "us-gasoline",
  value: "3.412",
  unit: "USD per gallon",
  region: "U.S. city average",
  period: "2026-09",
  source: "U.S. EIA",
  series_id: "EMM_EPMR_PTE_NUS_DPG",
  retrieved_at: "2026-10-30T14:02:11Z",
  source_url: "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?n=PET",
};

function body(entry: Record<string, unknown>) {
  return {
    format: "revenant-figures-v1",
    generated_at: "2026-10-30T14:02:11Z",
    source_mode: "db",
    series: [
      { metric: METRIC, period_type: "monthly", last_success_at: null, ...entry },
    ],
  };
}

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element).replace(/&#x27;/g, "'");
}

function viewOf(state: SampleState): string {
  return render(<SampleReceiptView state={state} />);
}

describe("loadSampleFigure", () => {
  it("makes one GET to /api/figures and reads a figure from the first series", async () => {
    const fetchStub = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => jsonResponse(body({ figure: FIGURE })));
    const state = await loadSampleFigure(fetchStub as unknown as typeof fetch);

    expect(fetchStub).toHaveBeenCalledTimes(1);
    expect(fetchStub.mock.calls[0]?.[0]).toBe(SAMPLE_URL);
    expect(state.status).toBe("ready");
    if (state.status !== "ready") return;
    expect(state.figure.value).toBe("3.412");
    expect(state.fallback).toBe(false);
  });

  it("marks a Fallback_Figure so the Fallback_Note can show", async () => {
    const fetchStub = vi.fn(async () =>
      jsonResponse(body({ figure: FIGURE, fallback: true })),
    );
    const state = await loadSampleFigure(fetchStub as unknown as typeof fetch);
    expect(state.status === "ready" && state.fallback).toBe(true);
  });

  it("gives none when the first series has figure: null", async () => {
    const fetchStub = vi.fn(async () => jsonResponse(body({ figure: null })));
    const state = await loadSampleFigure(fetchStub as unknown as typeof fetch);
    expect(state).toEqual({ status: "none" });
  });

  it("gives none when the request fails", async () => {
    const thrown = vi.fn(async () => {
      throw new TypeError("network down");
    });
    expect(await loadSampleFigure(thrown as unknown as typeof fetch)).toEqual({
      status: "none",
    });

    const serverError = vi.fn(async () => new Response("no", { status: 500 }));
    expect(await loadSampleFigure(serverError as unknown as typeof fetch)).toEqual({
      status: "none",
    });

    const badBody = vi.fn(async () => jsonResponse({ format: "other" }));
    expect(await loadSampleFigure(badBody as unknown as typeof fetch)).toEqual({
      status: "none",
    });
  });

  it("gives none for an empty series list", () => {
    expect(
      sampleFromResponse({
        format: "revenant-figures-v1",
        generated_at: "2026-10-30T14:02:11Z",
        source_mode: "db",
        series: [],
      }),
    ).toEqual({ status: "none" });
  });
});

describe("SampleReceiptView", () => {
  it("shows the heading and a reserved box while loading, with no number", () => {
    const html = viewOf({ status: "loading" });
    expect(html).toContain(LANDING_SECTION_COPY.receiptTitle);
    expect(html).toContain('data-block="sample-receipt"');
    expect(html).not.toContain("3.412");
  });

  it("shows value, unit, period, region, provenance and the source link for a figure", () => {
    const html = viewOf({
      status: "ready",
      metric: METRIC,
      figure: FIGURE as never,
      fallback: false,
    });
    expect(html).toContain("3.412");
    expect(html).toContain("USD per gallon");
    expect(html).toContain("Sept 2026");
    expect(html).toContain("U.S. city average");
    expect(html).toContain("U.S. EIA");
    expect(html).toContain("EMM_EPMR_PTE_NUS_DPG");
    expect(html).toContain("30 October 2026");
    expect(html).toContain(`href="${FIGURE.source_url}"`);
    expect(html).not.toContain(REVEAL_COPY.fallbackNote.split("{")[0]);
  });

  it("keeps value and unit in one line and period and region on the next", () => {
    const html = viewOf({
      status: "ready",
      metric: METRIC,
      figure: FIGURE as never,
      fallback: false,
    });
    expect(html).toMatch(/receiptValueLine[^"]*"><span[^>]*>3\.412<\/span> <span[^>]*>USD per gallon<\/span>/);
    expect(html).toMatch(/receiptMeta[^"]*">Sept 2026 · U\.S\. city average</);
  });

  it("shows the Fallback_Note with the retrieved date for a Fallback_Figure", () => {
    const html = viewOf({
      status: "ready",
      metric: METRIC,
      figure: FIGURE as never,
      fallback: true,
    });
    expect(html).toContain(
      REVEAL_COPY.fallbackNote.replace("{date}", "30 October 2026"),
    );
  });

  it("says no figure is available and shows no number for none", () => {
    const html = viewOf({ status: "none" });
    expect(html).toContain(LANDING_SECTION_COPY.receiptNone);
    expect(html).not.toMatch(/\b\d+\.\d{3}\b/);
    expect(html).not.toContain("<a ");
  });

  it("has no Accent class, arrow, or change wording on any figure element", () => {
    const html = viewOf({
      status: "ready",
      metric: METRIC,
      figure: FIGURE as never,
      fallback: true,
    });
    expect(html).not.toMatch(/accent/i);
    expect(html).not.toMatch(/[↑↓▲▼→←]/);
    expect(html).not.toMatch(/\b(rose|fell|unchanged|change)\b/i);
  });
});
