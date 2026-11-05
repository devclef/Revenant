import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FigureEntry, type FigureEntryProps } from "./FigureEntry";
import { REVEAL_COPY } from "./copy";
import { FIG_VALUE_SIZE } from "@/components/ceremony/constants";
import { computeChange, formatPeriod, type DisplayRescale } from "@/lib/figures";
import type { FigureV1 } from "@/lib/seal-format";

/**
 * Markup tests for FigureEntry (spec 07 R14.3 item order, R14.1 desk surface,
 * R14.12 type styles). Rendered with `renderToStaticMarkup` and `createElement`,
 * matching the other reveal tests. No DOM library, no JSX.
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
    name: "Regular gasoline",
    then: THEN,
    now: NOW,
    change: comparable(THEN, NOW),
    ...overrides,
  };
  return renderToStaticMarkup(createElement(FigureEntry, props));
}

// Remove React's text-node separators so text checks read the visible string.
const plain = (html: string): string => html.replace(/<!-- -->/g, "");

describe("FigureEntry draws the R14.3 items in order (spec 07 R14.3)", () => {
  it("shows the name and region first, then the answer line", () => {
    const html = plain(render({ markValue: "3.50" }));
    const name = html.indexOf("Regular gasoline · U.S. city average");
    const answer = html.indexOf("Your answer: ");
    expect(name).toBeGreaterThan(-1);
    expect(answer).toBeGreaterThan(name);
  });

  it("orders the items: name, then row, now row, the answer, Number_Line, change, formula, source", () => {
    const html = plain(render({ markValue: "3.50" }));
    const at = (needle: string): number => {
      const index = html.indexOf(needle);
      expect(index, needle).toBeGreaterThan(-1);
      return index;
    };
    const order = [
      at("Regular gasoline · U.S. city average"),
      at(`${REVEAL_COPY.then}:`),
      at(`data-role="then">3.412<`),
      at(REVEAL_COPY.labelHistoricalRecord.replace("{date}", "30 October 2024")),
      at(`${REVEAL_COPY.now}:`),
      at(`data-role="now">3.9<`),
      at("_numberLine"),
      at("Your answer: 3.50 USD per gallon"),
      at(REVEAL_COPY.periodRange),
      at(REVEAL_COPY.formulaLabel),
      at(REVEAL_COPY.sourceSummary),
    ];
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("the then and now values are .figValue spans at the same size, with no Accent or direction class", () => {
    const html = render();
    expect(html).toMatch(/class="[^"]*figValue[^"]*"[^>]*data-role="then">3\.412</);
    expect(html).toMatch(/class="[^"]*figValue[^"]*"[^>]*data-role="now">3\.9</);
    expect(html).toContain(`font-size:${FIG_VALUE_SIZE}`);
    expect(html).not.toMatch(/class="[^"]*(big|youLine|youValue|accent)[^"]*"/);
  });


  it("the now row shows the now value, unit, both periods and the retrieved date", () => {
    const text = plain(render()).replace(/<[^>]+>/g, "");
    expect(text).toContain("Now: 3.9 USD per gallon");
    expect(text).toContain(formatPeriod("2026-10", NOW.region));
    expect(text).toContain("retrieved 27 October 2026");
  });

  it("shows the source, the series ID and the source_url in the source control", () => {
    const html = render();
    expect(html).toContain("U.S. EIA");
    expect(html).toContain(`${REVEAL_COPY.seriesLabel}: EMM_EPMR_PTE_NUS_DPG`);
    expect(html).toContain("https://www.eia.gov/series");
  });
});

describe("FigureEntry draws the Mark only when there is an answer (R12.1)", () => {
  it("shows No answer on the figAnswer line and no Mark for an unanswered figure", () => {
    const html = render({ markValue: undefined });
    expect(plain(html)).toContain(`${REVEAL_COPY.yourAnswer}: ${REVEAL_COPY.noAnswer}`);
    expect(html.match(/Your answer/g) ?? []).toHaveLength(1);
    expect(html).toMatch(/class="[^"]*figAnswer[^"]*"/);
    expect(html).not.toMatch(/class="[^"]*markLabel/);
    expect(html).not.toMatch(/class="[^"]*markWrap/);
  });

  it("shows the typed answer once as the Number_Line label and in the Mark's hidden text", () => {
    const html = plain(render({ markValue: "3.50" }));
    expect(html).toContain("Your answer: 3.50 USD per gallon");
    expect(html).toMatch(/class="[^"]*markLabel[^"]*"/);
    expect(html).toMatch(/class="[^"]*markWrap/);
    expect(html).not.toMatch(/class="[^"]*figAnswer/);
  });

  it("the figure items other than the answer are identical with or without a Mark", () => {
    const strip = (html: string): string =>
      plain(html)
        .replace(/<p class="[^"]*figAnswer[^"]*">[\s\S]*?<\/p>/, "")
        .replace(/<span class="[^"]*markLabel[^"]*"[^>]*>[\s\S]*?<\/span>/, "")
        .replace(/--pos-mark:[^;"]+;?/, "")
        .replace(/;"/g, '"')
        .replace(/<span class="[^"]*markWrap[^"]*">[\s\S]*?<\/span><\/span>/, "");
    expect(strip(render({ markValue: "9.99" }))).toBe(
      strip(render({ markValue: undefined })),
    );
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

describe("FigureEntry sits on the dark desk, never on paper (spec 07 R14.1)", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const revealCss = readFileSync(resolve(here, "reveal.module.css"), "utf8");

  // Every declaration body whose selector list names `selector`, so a grouped
  // rule (".letterCol, .figuresCol { ... }") is found too.
  function ruleBody(selector: string): string {
    const bodies = [...revealCss.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^}]*)\}/g)]
      .filter(([, selectors]) =>
        selectors.split(",").some((sel) => sel.trim() === selector),
      )
      .map(([, , body]) => body);
    if (bodies.length === 0) throw new Error(`test setup: ${selector} rule not found`);
    return bodies.join("\n");
  }

  it("the figures column sets the desk surface and desk text, not paper", () => {
    const rule = ruleBody(".figuresCol");
    expect(rule).toMatch(/background-color:\s*var\(--bg\)/);
    expect(rule).toMatch(/color:\s*var\(--text\)/);
    expect(rule).not.toMatch(/--paper|--ink/);
  });

  it("the figure entry sets desk text tokens only", () => {
    const rule = ruleBody(".fig");
    expect(rule).toMatch(/color:\s*var\(--text\)/);
    expect(rule).not.toMatch(/--paper|--ink/);
  });

  it("wraps the comparable entry in its figure section", () => {
    const html = render();
    expect(html).toMatch(/<section class="[^"]*fig[^"]*"/);
  });
});
