// Markup tests for Stamp (05-reveal-ceremony, design.md "Stamps and counter",
// R9.1, R9.2, R9.8, R10.6, R11.2, R12.6). Rendered with `renderToStaticMarkup`
// and `createElement`: no DOM library and no JSX, matching the reveal tests.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FigureLine } from "@/components/reveal/FigureLine";
import type { FigureV1 } from "@/lib/seal-format";
import { MotionProvider } from "../motion";
import { COUNTER_ROLL_MS } from "../constants";
import { Stamp, dropsOnMount, type StampProps } from "./Stamp";
import styles from "./figures.module.css";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FIGURE: Readonly<FigureV1> = {
  kind: "official",
  metric_id: "fuel",
  value: "3.412",
  unit: "USD per gallon",
  region: "U.S. city average",
  period: "2024-10",
  source: "U.S. EIA",
  series_id: "EMM_EPMR_PTE_NUS_DPG",
  retrieved_at: "2024-10-30T14:02:11Z",
  source_url: "https://www.eia.gov/series",
};

const renderStamp = (props: StampProps): string =>
  renderToStaticMarkup(
    createElement(MotionProvider, null, createElement(Stamp, props)),
  );

describe("Stamp frames the existing FigureLine unchanged (R9.1, R9.8)", () => {
  it("contains the FigureLine markup byte for byte", () => {
    const html = renderStamp({ figure: FIGURE, role: "then" });
    const line = renderToStaticMarkup(
      createElement(FigureLine, { figure: FIGURE, role: "then" }),
    );
    expect(html).toContain(line);
  });

  it("keeps the then and now labels from FigureLine", () => {
    const then = renderStamp({ figure: FIGURE, role: "then" });
    const now = renderStamp({ figure: FIGURE, role: "now" });
    expect(then).toContain("historical record, retrieved 30 October 2024");
    expect(now).toContain("retrieved 30 October 2024");
    expect(now).not.toContain("historical record");
  });
});

describe("Stamp adds the face value and the source name as text (R9.2, R12.6)", () => {
  it("shows the face value through Counter, one digit cell per digit, hidden from screen readers", () => {
    const html = renderStamp({ figure: FIGURE, role: "then" });
    expect(html).toMatch(/<span class="[^"]*face[^"]*" aria-hidden="true">/);
    // 3.412 has four digits, so four [data-counter] cells (the point is text).
    expect(html.match(/data-counter="digit"/g)?.length).toBe(4);
  });

  it("keeps the unit outside Counter so its spaces survive", () => {
    const html = renderStamp({ figure: FIGURE, role: "then" });
    expect(html).toMatch(/<\/span> USD per gallon<\/span>/);
  });

  it("shows the source name as readable text", () => {
    const html = renderStamp({ figure: FIGURE, role: "now" });
    expect(html).toMatch(/<span class="[^"]*sourceName[^"]*">U\.S\. EIA<\/span>/);
  });

  it("shows the rescaled value and unit when the series rescales", () => {
    const html = renderStamp({
      figure: { ...FIGURE, value: "3412", unit: "USD per 1,000 litres" },
      role: "then",
      displayRescale: { divisor: 1000, unit: "USD per litre" },
    });
    expect(html.match(/data-counter="digit"/g)?.length).toBe(4);
    expect(html).toMatch(/<\/span> USD per litre<\/span>/);
  });
});

describe("the counter's digit strips roll only in full motion (R10.6, R11.2)", () => {
  it("rolls the digit strips in the full-motion render", () => {
    const html = renderStamp({ figure: FIGURE, role: "then" });
    expect(html).toContain(`animation-duration:${COUNTER_ROLL_MS}ms`);
  });
});

describe("Stamp drops on mount in full motion only (R10.6, R11.2)", () => {
  it("drops only in full motion", () => {
    expect(dropsOnMount("full")).toBe(true);
    expect(dropsOnMount("light")).toBe(false);
    expect(dropsOnMount("calm")).toBe(false);
  });

  it("carries the drop class and timing from constants in the full-motion render", () => {
    const html = renderStamp({ figure: FIGURE, role: "then" });
    expect(html).toContain(styles.drop);
    expect(html).toContain("animation-duration:520ms");
  });
});

describe("the reduced-motion guard lives in the stylesheet (R11.2)", () => {
  it("turns the drop animation off under prefers-reduced-motion", () => {
    const css = readFileSync(join(__dirname, "figures.module.css"), "utf8");
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.drop\s*\{\s*animation:\s*none;?\s*\}\s*\}/,
    );
  });
});

describe("then and now stamps share one frame (neutrality, R10.1)", () => {
  it("uses the same stamp class for both roles", () => {
    const then = renderStamp({ figure: FIGURE, role: "then" });
    const now = renderStamp({ figure: FIGURE, role: "now" });
    const cls = /class="([^"]*stamp[^"]*)"/;
    expect(then.match(cls)?.[1]).toBe(now.match(cls)?.[1]);
  });
});
