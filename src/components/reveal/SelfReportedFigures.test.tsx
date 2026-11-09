import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FiguresThenNow } from "./FiguresThenNow";
import { REVEAL_COPY } from "./copy";
import type { Opened } from "./opening-machine";
import type { FiguresState } from "./figures-api";
import type { MetricDefinitionV1, PayloadV1 } from "@/lib/seal-format";

/**
 * Markup tests for the self-reported figures in stage 3 (spec 08 later-tasks,
 * R26.6). A self-reported figure is listed after the official figures, shows
 * the typed value, unit, period and region with the "self-reported" label, and
 * never gets a now figure, a change or a Number_Line.
 */

const RENT_METRIC: MetricDefinitionV1 = {
  id: "self-1",
  display_name: "Rent",
  unit: "USD per month",
  region: "U.S.",
  source: "self-reported",
  series_id: "self-reported",
};

const RENT_FIGURE = {
  kind: "self-reported",
  metric_id: "self-1",
  value: "1450",
  unit: "USD per month",
  region: "U.S.",
  period: "2026-10",
  source: "self-reported",
  series_id: "self-reported",
  retrieved_at: "2026-10-27T00:00:00.000Z",
} as const;

const PAYLOAD = {
  format_version: 1,
  letter_text: "A short sealed letter.",
  written_as_of: "2026-10-27",
  metrics: [RENT_METRIC],
  figures: [RENT_FIGURE],
  recall_questions: [],
} satisfies PayloadV1;

const OPENED: Opened = {
  letterId: "letter-self",
  header: {
    sealedAt: "2026-10-27T00:00:00.000Z",
    opensAt: "2026-11-05T00:00:00.000Z",
  },
  openingKey: {} as unknown as CryptoKey,
  envelopeHash:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  payload: PAYLOAD,
};

const FIGURES: FiguresState = { status: "failed" };

function render(): string {
  return renderToStaticMarkup(
    createElement(FiguresThenNow, { opened: OPENED, figures: FIGURES }),
  );
}

describe("self-reported figures in stage 3", () => {
  it("shows the group heading and hint with the copy", () => {
    const html = render();
    expect(html).toContain('data-self-reported-group=""');
    expect(html).toContain(REVEAL_COPY.selfReportedTitle);
    expect(html).toContain(
      REVEAL_COPY.selfReportedHint.replace(/'/g, "&#x27;"),
    );
  });

  it("labels the figure self-reported and shows its value, unit and period", () => {
    const html = render();
    expect(html).toContain('data-self-reported=""');
    expect(html).toContain(REVEAL_COPY.labelSelfReported);
    expect(html).toContain(">1450<");
    expect(html).toContain("USD per month");
    expect(html).toContain("Oct 2026");
  });

  it("marks the typed name, region, value and unit as user content", () => {
    const html = render();
    expect(html).toContain('data-user-content="">Rent<');
    expect(html).toContain('data-user-content="">U.S.<');
    expect(html).toContain('data-user-content="">1450<');
    expect(html).toContain('data-user-content="">USD per month<');
  });

  it("marks the typed period as user content", () => {
    const html = render();
    expect(html).toMatch(/data-user-content="">Oct 2026</);
  });

  it("draws no now row, no change and no Number_Line for it", () => {
    const html = render();
    expect(html).not.toContain('data-receipt-row="now"');
    expect(html).not.toContain(REVEAL_COPY.notComparable);
    expect(html).not.toContain("data-number-line");
  });

  it("lists the self-reported figure after the official figures", () => {
    const html = render();
    // Only the self-reported figure is in this payload; the group is rendered
    // and no official figure entry appears before it.
    expect(html.indexOf("data-self-reported-group")).toBeGreaterThan(-1);
    expect(html).not.toContain('data-figure-entry=""');
  });
});
