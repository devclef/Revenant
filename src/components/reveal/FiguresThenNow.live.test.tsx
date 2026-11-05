import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { FiguresThenNow } from "./FiguresThenNow";
import { REVEAL_COPY } from "./copy";
import { DEMO_FIGURES } from "@/lib/figures/demo";
import { thenAndNow } from "@/lib/figures/then-now";
import { formatPeriod } from "@/lib/figures";
import { numberLineGeometry } from "@/components/ceremony/figures/number-line";
import type { Opened } from "./opening-machine";
import type { FigureV1, MetricDefinitionV1, PayloadV1 } from "@/lib/seal-format";

/**
 * Live letters on stage 3 (spec 06, R18.2). A live letter whose then figure is
 * the same figure as the now figure (same period and value) shows both figures
 * with their own periods, a change of zero, the formula line, and no extra
 * words. Both Number_Line pins sit at the centre.
 */

// The same mock as FiguresThenNow.test.tsx: the reveal reads the fixture
// through a mocked DEMO_FIGURES, never the real figure file.
vi.mock("@/lib/figures/demo", async () => {
  const { loadFigureFile } = await import("@/lib/figures/load");
  const { CATALOGUE } = await import("@/lib/figures/catalogue");
  const fixture = await import("@/lib/figures/demo/us-fuel.fixture.json");
  return { DEMO_FIGURES: loadFigureFile(fixture.default, CATALOGUE) };
});

const SEALED_AT = "2026-10-27T00:00:00.000Z";

// The latest now figure in the series, taken from the loaded catalogue.
const NOW_FIGURE: Readonly<FigureV1> = (() => {
  const { now } = thenAndNow(
    "fixture-us-gasoline-regular",
    "2026-10-27",
    DEMO_FIGURES,
  );
  if (!now.found) throw new Error("test setup: gasoline now must be found");
  return now.figure;
})();

// The then figure is the same figure: same value, period, series and unit.
const SAME_THEN: Readonly<FigureV1> = { ...NOW_FIGURE };

const METRIC: MetricDefinitionV1 = {
  id: "fixture-us-gasoline-regular",
  display_name: "Regular gasoline (live test)",
  unit: NOW_FIGURE.unit,
  region: NOW_FIGURE.region,
  source: NOW_FIGURE.source,
  series_id: NOW_FIGURE.series_id,
};

const PAYLOAD = {
  format_version: 1,
  letter_text: "A live letter.",
  metrics: [METRIC],
  figures: [SAME_THEN],
  recall_questions: [],
} as unknown as PayloadV1;

const OPENED: Opened = {
  letterId: "letter-live-2",
  header: { sealedAt: SEALED_AT, opensAt: "2026-11-05T00:00:00.000Z" },
  payload: PAYLOAD,
  openingKey: {} as unknown as CryptoKey,
  envelopeHash:
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
};

function render(allowSamePeriod?: boolean): string {
  return renderToStaticMarkup(
    createElement(FiguresThenNow, { opened: OPENED, allowSamePeriod }),
  );
}

describe("FiguresThenNow, live same-figure zero change (R18.2)", () => {
  it("shows the change line and formula with a zero change", () => {
    const html = render(true);
    const v = NOW_FIGURE.value;
    // The formula line uses the same value on both sides, so it reads 0 change.
    expect(html).toContain(
      `${REVEAL_COPY.formulaLabel}: (${v} - ${v}) / ${v} x 100`,
    );
    expect(html).toContain("unchanged");
    expect(html).not.toContain(REVEAL_COPY.notComparable);
  });

  it("shows both figures with their own periods", () => {
    const html = render(true);
    expect(html).toContain(REVEAL_COPY.then);
    expect(html).toContain(REVEAL_COPY.now);
    expect(html).toContain(formatPeriod(NOW_FIGURE.period, NOW_FIGURE.region));
  });

  it("without allowSamePeriod the same figure is not comparable", () => {
    const html = render(false);
    // The apostrophe in the copy is escaped in markup, so match the reason copy.
    expect(html).toContain(REVEAL_COPY.reason.no_newer_figure);
    expect(html).not.toContain(REVEAL_COPY.formulaLabel);
    expect(html).not.toContain("unchanged");
  });

  it("draws both Number_Line pins at the centre", () => {
    const geometry = numberLineGeometry(SAME_THEN.value, NOW_FIGURE.value);
    expect(geometry.posThen).toBeCloseTo(0.5, 12);
    expect(geometry.posNow).toBeCloseTo(0.5, 12);

    // The rendered custom properties carry the same centred positions.
    const html = render(true);
    const then = /--pos-then:([0-9.eE+-]+)/.exec(html);
    const now = /--pos-now:([0-9.eE+-]+)/.exec(html);
    expect(then).not.toBeNull();
    expect(now).not.toBeNull();
    expect(Number(then?.[1])).toBeCloseTo(0.5, 12);
    expect(Number(now?.[1])).toBeCloseTo(0.5, 12);
  });
});
