// Feature: 15-the-flow, requirement 4.4 and 12.6: a persona's "now" figures come
// from the server, not from GET /api/figures.
//
// When Reveal receives `personaNow`, stage 3 reads the figures from that prop and
// sends no request. The test stubs fetch and fails if anything calls it, then
// checks that the "now" period from the prop is shown next to the sealed then.
//
// Markup test, rendered with renderToStaticMarkup like the other reveal tests.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Reveal, type RevealProps } from "./Reveal";
import { MotionProvider } from "@/components/ceremony/motion";
import { SkipProvider } from "@/components/ceremony/skip";
import { LiveRegionProvider } from "@/components/ceremony/LiveRegion";
import { LocalViewProvider } from "@/components/ceremony/local-view";
import type { Opened } from "./opening-machine";
import type { OpenedPayload } from "./opened-payload";
import { PERSONAS } from "@/lib/personas";
import { CATALOGUE } from "@/lib/figures/catalogue";
import { DEMO_FIGURES } from "@/lib/figures/demo";
import { formatPeriod, personaNowResponse } from "@/lib/figures";
import { thenAndNow } from "@/lib/figures/then-now";
import type { FigureV1 } from "@/lib/seal-format";

const MAYA = PERSONAS.find((p) => p.key === "us-maya");
if (MAYA === undefined) throw new Error("test setup: no us-maya persona");

const METRIC_ID = "us-gasoline-regular";

function metricOf(metricId: string) {
  const series = CATALOGUE.find((s) => s.metric.id === metricId);
  if (series === undefined)
    throw new Error(`test setup: no series ${metricId}`);
  return series.metric;
}

// The sealed then figure: the record for the written-as-of date, as sealing
// stores it.
const then = thenAndNow(
  METRIC_ID,
  MAYA.written_as_of.slice(0, 10),
  DEMO_FIGURES,
).then;
if (!then.found) throw new Error("test setup: no then figure for Maya");
const SEALED_THEN: FigureV1 = then.figure;

// The "now" response the persona page builds on the server.
const PERSONA_NOW = personaNowResponse(
  { opens_at: MAYA.opens_at, metrics: [{ metric_id: METRIC_ID }] },
  DEMO_FIGURES,
  "2026-11-21T00:00:00.000Z",
);
const NOW_ENTRY = PERSONA_NOW.series.find((s) => s.metric.id === METRIC_ID);
const NOW_FIGURE = NOW_ENTRY?.figure;
if (NOW_FIGURE === null || NOW_FIGURE === undefined) {
  throw new Error("test setup: no now figure for Maya at her opening date");
}

const OPENED: Opened = {
  letterId: "letter-persona-now",
  header: {
    sealedAt: "2024-10-01T00:00:00.000Z",
    opensAt: MAYA.opens_at,
  },
  openingKey: {} as unknown as CryptoKey,
  envelopeHash:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  payload: {
    letter_text: "A short letter with one figure in it.",
    metrics: [metricOf(METRIC_ID)],
    figures: [SEALED_THEN],
    recall_questions: [],
  } as unknown as OpenedPayload,
};

function renderReveal(extra: Partial<RevealProps> = {}): string {
  return renderToStaticMarkup(
    createElement(
      MotionProvider,
      null,
      createElement(
        SkipProvider,
        null,
        createElement(
          LiveRegionProvider,
          null,
          createElement(
            LocalViewProvider,
            null,
            createElement(Reveal, {
              opened: OPENED,
              record: { version: 2, answers: [] },
              personaName: "Maya",
              stage: 3,
              onAdvance: () => {},
              onShowAll: () => {},
              letterKind: "persona",
              variant: "persona",
              phone: false,
              ...extra,
            } as RevealProps),
          ),
        ),
      ),
    ),
  );
}

describe("Reveal: persona now figures come from the server (spec 15 R4.4, R12.6)", () => {
  const fetchSpy = vi.fn(() => {
    throw new Error("Reveal tried to fetch the figures");
  });

  beforeEach(() => {
    fetchSpy.mockClear();
    vi.stubGlobal("fetch", fetchSpy);
  });

  it("shows the server's now period and makes no figures request", () => {
    const html = renderReveal({ personaNow: PERSONA_NOW });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(html).toContain(formatPeriod(NOW_FIGURE.period, NOW_FIGURE.region));
  });

  it("still shows the sealed then figure when the server gives no now figure", () => {
    const empty = {
      ...PERSONA_NOW,
      series: PERSONA_NOW.series.map((s) => ({ ...s, figure: null })),
    };
    const html = renderReveal({ personaNow: empty });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(html).toContain(
      formatPeriod(SEALED_THEN.period, SEALED_THEN.region),
    );
  });
});
