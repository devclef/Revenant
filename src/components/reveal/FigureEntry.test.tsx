import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FigureEntry, type FigureEntryProps } from "./FigureEntry";
import { FigureLine } from "./FigureLine";
import { REVEAL_COPY } from "./copy";
import { computeChange, type DisplayRescale } from "@/lib/figures";
import type { FigureV1 } from "@/lib/seal-format";

/**
 * Markup tests for FigureEntry (05-reveal-ceremony task 4, design.md
 * "Number_Line geometry", "Stamps and counter", R9.1, R9.2, R9.3, R9.8, R12.1,
 * R12.2). Rendered with `renderToStaticMarkup` and `createElement`, matching the
 * other reveal tests. No DOM library, no JSX.
 */

const THEN: Readonly<FigureV1> = {
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

const NOW: Readonly<FigureV1> = {
  ...THEN,
  value: "3.900",
  period: "2026-10",
  retrieved_at: "2026-10-27T09:00:00Z",
};

function comparable(then: Readonly<FigureV1>, now: Readonly<FigureV1>) {
  const change = computeChange(then, now);
  if (!change.comparable) throw new Error("test setup: pair must be comparable");
  return change;
}

function render(overrides: Partial<FigureEntryProps> = {}): string {
  const props: FigureEntryProps = {
    then: THEN,
    now: NOW,
    change: comparable(THEN, NOW),
    ...overrides,
  };
  return renderToStaticMarkup(createElement(FigureEntry, props));
}

describe("FigureEntry renders the two stamps, the line and the change (R9.1)", () => {
  it("renders the then and now FigureLines unchanged, inside their stamps", () => {
    const html = render();
    const thenLine = renderToStaticMarkup(
      createElement(FigureLine, { figure: THEN, role: "then" }),
    );
    const nowLine = renderToStaticMarkup(
      createElement(FigureLine, { figure: NOW, role: "now" }),
    );
    expect(html).toContain(thenLine);
    expect(html).toContain(nowLine);
  });

  it("draws the then stamp before the now stamp (R9.3 order)", () => {
    const html = render();
    const thenAt = html.indexOf('data-role="then"');
    const nowAt = html.indexOf('data-role="now"');
    expect(thenAt).toBeGreaterThan(-1);
    expect(nowAt).toBeGreaterThan(thenAt);
  });

  it("includes the one neutral change line and its formula", () => {
    const html = render();
    expect(html).toContain(REVEAL_COPY.formulaLabel);
    expect(html).toContain(REVEAL_COPY.periodRange);
  });

  it("labels the then and now rows with the reveal copy", () => {
    const html = render();
    expect(html).toContain(REVEAL_COPY.then);
    expect(html).toContain(REVEAL_COPY.now);
  });
});

describe("FigureEntry draws the Mark only when there is an answer (R12.1)", () => {
  it("draws no Mark element for No answer", () => {
    const html = render({ markValue: undefined });
    expect(html).not.toContain("Your answer");
    expect(html).not.toMatch(/class="[^"]*markWrap/);
  });

  it("draws the Mark with the typed answer in its hidden text", () => {
    const html = render({ markValue: "3.50" });
    expect(html).toContain("Your answer: 3.50 USD per gallon");
    expect(html).toMatch(/class="[^"]*markWrap/);
  });

  it("leaves both stamps' markup the same whether or not there is a Mark (R12.2)", () => {
    const withoutMark = render({ markValue: undefined });
    const withMark = render({ markValue: "9.99" });
    const stampOf = (html: string, role: "then" | "now"): string => {
      const start = html.indexOf(`data-role="${role}"`);
      const open = html.lastIndexOf("<div", start);
      // Each stamp holds one FigureLine <div> and ends with its closing </div>.
      const lineEnd = html.indexOf("</details></div>", start);
      return html.slice(open, lineEnd + "</details></div>".length);
    };
    expect(stampOf(withMark, "then")).toBe(stampOf(withoutMark, "then"));
    expect(stampOf(withMark, "now")).toBe(stampOf(withoutMark, "now"));
  });
});

describe("FigureEntry shows the figures in the display rescale (R11.10)", () => {
  it("shows the rescaled face value and unit when the series has a rescale", () => {
    const rescale: DisplayRescale = {
      divisor: 1000,
      unit: "USD per 1,000 gallons",
    };
    const html = render({ rescale });
    expect(html).toContain("USD per 1,000 gallons");
  });
});

describe("FigureEntry sits on its own paper surface (tone.md, Property 22)", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const figuresCss = readFileSync(
    resolve(here, "..", "ceremony", "figures", "figures.module.css"),
    "utf8",
  );

  // The rule body for `.paperPanel`, read from the CSS module so the test
  // tracks the real declarations.
  function paperPanelRule(): string {
    const match = figuresCss.match(/\.paperPanel\s*\{([^}]*)\}/);
    if (!match) throw new Error("test setup: .paperPanel rule not found");
    return match[1];
  }

  it("wraps the comparable entry in a paper panel class", () => {
    const html = render();
    expect(html).toMatch(/class=\"[^\"]*paperPanel[^\"]*\"/);
  });

  it("the panel sets its own text colour and paper background", () => {
    const rule = paperPanelRule();
    expect(rule).toMatch(/color:\s*var\(--ink\)/);
    expect(rule).toMatch(/background-color:\s*var\(--paper\)/);
  });

  it("the panel's text colour is the paper ink token, not a desk token", () => {
    const rule = paperPanelRule();
    expect(rule).not.toMatch(/--desk/);
  });

  it("keeps the then and now labels, change line and formula inside the panel", () => {
    const html = render();
    const start = html.indexOf("paperPanel");
    const panelOpen = html.lastIndexOf("<div", start);
    const inside = html.slice(panelOpen);
    expect(inside).toContain(REVEAL_COPY.then);
    expect(inside).toContain(REVEAL_COPY.now);
    expect(inside).toContain(REVEAL_COPY.formulaLabel);
  });
});
