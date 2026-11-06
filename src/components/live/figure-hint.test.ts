// Tests for the picker hint (spec 09, A4.1 to A4.3) and Property 5: the picker
// never states a zero limit (design.md, "Correctness Properties"). The property
// renders FigurePicker itself, so it checks the markup a judge reads.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import type { PickableSeries } from "./catalogue-list";
import { LIVE_COPY } from "./copy";
import { pickerHint } from "./figure-hint";
import { FigurePicker } from "./FigurePicker";
import { MAX_FIGURES } from "./constants";
import { figureLimit } from "./form";

const SERIES: PickableSeries = {
  metricId: "us-gasoline-regular",
  displayName: "Regular gasoline",
  unit: "USD per gallon",
  region: "U.S.",
  latestPeriod: "2026-10-26",
  isFixture: false,
};

function seriesOf(count: number): PickableSeries[] {
  return Array.from({ length: count }, (_, i) => ({
    ...SERIES,
    metricId: `m-${i}`,
  }));
}

function renderPicker(count: number): string {
  return renderToStaticMarkup(
    createElement(FigurePicker, {
      series: seriesOf(count),
      selected: [],
      atLimit: false,
      onToggle: () => undefined,
    }),
  );
}

describe("pickerHint", () => {
  it("is none for a maximum of 0", () => {
    expect(pickerHint(0)).toEqual({ key: "none" });
  });

  it("is the singular form for a maximum of 1", () => {
    expect(pickerHint(1)).toEqual({ key: "one" });
  });

  it("carries the maximum for two or more", () => {
    expect(pickerHint(2)).toEqual({ key: "many", max: 2 });
    expect(pickerHint(MAX_FIGURES)).toEqual({ key: "many", max: MAX_FIGURES });
  });

  it("never returns a zero or negative maximum", () => {
    fc.assert(
      fc.property(fc.double({ min: -100, max: 100, noNaN: true }), (value) => {
        const hint = pickerHint(value);
        if (hint.key === "many") {
          expect(hint.max).toBeGreaterThanOrEqual(2);
        }
      }),
    );
  });
});

describe("Property 5: the picker never states a zero limit", () => {
  it("for any Sealable_Count from 0 to 10, states no range or limit with 0 in it", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10 }), (count) => {
        const html = renderPicker(count);

        expect(html).not.toContain("between 1 and 0");
        expect(html).not.toContain("no more than 0");
        expect(html).not.toMatch(/Choose between 1 and 0\b/);
      }),
    );
  });

  it("uses the singular form exactly when the stated maximum is 1", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10 }), (count) => {
        const html = renderPicker(count);
        const max = figureLimit(count);

        if (max === 1) {
          expect(html).toContain(LIVE_COPY.figuresHintOne);
          expect(html).not.toContain("between 1 and");
        } else if (max === 0) {
          expect(html).toContain(
            LIVE_COPY.figuresNoneAvailable.split("{link}")[0],
          );
          expect(html).not.toContain(LIVE_COPY.figuresHintOne);
          expect(html).not.toContain("between 1 and");
          expect(html).not.toContain("no more than");
        } else {
          expect(html).toContain(
            LIVE_COPY.figuresHint.replace("{max}", String(max)),
          );
        }
      }),
    );
  });

  it("states the stated maximum as the smaller of MAX_FIGURES and the count", () => {
    for (let count = 0; count <= 10; count += 1) {
      const html = renderPicker(count);
      const max = Math.min(MAX_FIGURES, count);
      if (max >= 2) {
        expect(html).toContain(`between 1 and ${max}.`);
      }
    }
  });
});

describe("pickerHint against the picker copy", () => {
  it("shows the none message with a link to /demo and no range", () => {
    const html = renderPicker(0);

    expect(html).toContain("No figure can be sealed right now.");
    expect(html).toContain('href="/demo"');
    expect(html).toContain(LIVE_COPY.figuresNoneLink);
    expect(html).not.toContain("between");
  });
});
