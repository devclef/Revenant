import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FigureEntry, type FigureEntryProps } from "./FigureEntry";
import { REVEAL_COPY } from "./copy";
import { CEREMONY_COPY } from "@/components/ceremony/copy";
import { FIG_VALUE_SIZE } from "@/components/ceremony/constants";
import { computeChange, formatPeriod, type DisplayRescale } from "@/lib/figures";
import type { FigureV1 } from "@/lib/seal-format";
import { nowMessageFor } from "./now-message";

// Feature: 09-demo-polish, task 16 (issue #263). FigureEntry renders one
// Receipt_Card (C3.1 to C3.3). These tests replace the spec 07 FigureEntry
// markup tests: the old "figAnswer" line and YourAnswerLine no longer exist.

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

const count = (text: string, needle: string): number => text.split(needle).length - 1;

describe("FigureEntry draws one Receipt_Card in the C3.1 order (spec 09 C3.1)", () => {
  it("puts the name, Your answer, Then, Now, Number_Line, change line and source in order", () => {
    const html = plain(render({ markValue: "3.90" }));
    const at = (needle: string) => html.indexOf(needle);
    const order = [
      at("Regular gasoline · U.S. city average"),
      at(`>${REVEAL_COPY.yourAnswer}</span>`),
      at(`data-role="then"`),
      at(`data-role="now"`),
      at(`data-line-label="answer"`),
      at(`${REVEAL_COPY.formulaLabel}:`),
      at(`<summary>${REVEAL_COPY.sourceSummary}</summary>`),
    ];
    for (const index of order) expect(index).toBeGreaterThan(-1);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it("is a receipt card section with the desk class", () => {
    const html = render();
    expect(html).toMatch(/<section class="[^"]*fig[^"]*"[^>]*data-receipt-card=""/);
  });
});

describe("Then and Now share one type style (spec 09 C3.2)", () => {
  it("gives the then and now values the same class and the same inline size", () => {
    const html = render();
    const then = html.match(/<span class="([^"]*)"[^>]*style="font-size:([^"]*)"[^>]*data-role="then"/);
    const now = html.match(/<span class="([^"]*)"[^>]*style="font-size:([^"]*)"[^>]*data-role="now"/);
    expect(then).not.toBeNull();
    expect(now).not.toBeNull();
    expect(then?.[1]).toBe(now?.[1]);
    expect(then?.[2]).toBe(now?.[2]);
    expect(then?.[2]).toContain(FIG_VALUE_SIZE);
  });
});

describe("Your answer appears once, and the Number_Line label carries only the answer (spec 09 C3.3)", () => {
  // A rescaled EUR per 1,000 litres entry: the case the unscaled tests could not catch.
  const rescale: DisplayRescale = { divisor: 1000, unit: "EUR per litre" };
  const EU_THEN: Readonly<FigureV1> = {
    ...THEN,
    value: "3412",
    unit: "EUR per 1,000 litres",
    region: "EU average",
    period: "2024-10",
  };
  const EU_NOW: Readonly<FigureV1> = { ...EU_THEN, value: "3900", period: "2026-10" };
  const euRender = (overrides: Partial<FigureEntryProps> = {}) =>
    render({
      then: EU_THEN,
      now: EU_NOW,
      change: comparable(EU_THEN, EU_NOW),
      rescale,
      ...overrides,
    });

  it("shows Your answer once as a visible label, with the answer in the card row", () => {
    const html = plain(euRender({ markValue: "1.50" }));
    expect(count(html, `>${REVEAL_COPY.yourAnswer}</span>`)).toBe(1);
    expect(html).toContain(`>1.50 EUR per litre</span>`);
  });

  it("shows No answer in the card row when the judge gave none", () => {
    const html = plain(euRender());
    expect(count(html, `>${REVEAL_COPY.yourAnswer}</span>`)).toBe(1);
    expect(html).toContain(`>${REVEAL_COPY.noAnswer}</span>`);
  });

  it("draws the Mark only when there is an answer", () => {
    const mark = CEREMONY_COPY.markAnswer
      .replace("{value}", "1.50")
      .replace("{unit}", "EUR per litre");
    expect(plain(euRender({ markValue: "1.50" }))).toContain(mark);
    expect(plain(euRender())).not.toContain(mark);
  });
});

describe("FigureEntry shows the figures in the display rescale (R11.10)", () => {
  const rescale: DisplayRescale = {
    divisor: 1000,
    unit: "EUR per litre",
  };
  const EU_THEN: Readonly<FigureV1> = {
    ...THEN,
    value: "3412",
    unit: "EUR per 1,000 litres",
    region: "EU average",
    period: "2024-10",
  };
  const EU_NOW: Readonly<FigureV1> = {
    ...EU_THEN,
    value: "3900",
    period: "2026-10",
  };

  it("shows the rescaled value and unit with the rescale note under each figure", () => {
    const html = plain(
      render({
        then: EU_THEN,
        now: EU_NOW,
        change: comparable(EU_THEN, EU_NOW),
        rescale,
      }),
    );
    // Display precision for fuel per litre (P5.1): 3.412 reads 3.41, 3.9 reads 3.90.
    expect(html).toContain("3.41<");
    expect(html).toContain("3.90<");
    expect(html).toContain("EUR per litre");
    const note = REVEAL_COPY.rescaledNote
      .replace("{toUnit}", "EUR per litre")
      .replace("{fromUnit}", "EUR per 1,000 litres");
    // Under the then row, under the now row, and on the change line (C8.4).
    expect(count(html, note)).toBe(3);
  });
});

describe("FigureEntry shows a rescaled answer once, in the shown unit (C8.3)", () => {
  // The answer is typed per litre and stored per litre. A 1.50 answer must read
  // 1.50 EUR per litre, not 0.0015 (the double-rescale bug).
  const rescale: DisplayRescale = {
    divisor: 1000,
    unit: "EUR per litre",
  };
  const EU_THEN: Readonly<FigureV1> = {
    ...THEN,
    value: "3412",
    unit: "EUR per 1,000 litres",
    region: "EU average",
    period: "2024-10",
  };
  const EU_NOW: Readonly<FigureV1> = {
    ...EU_THEN,
    value: "3900",
    period: "2026-10",
  };

  it("shows Your answer as 1.50 EUR per litre for a per-litre answer of 1.50", () => {
    const html = plain(
      render({
        then: EU_THEN,
        now: EU_NOW,
        change: comparable(EU_THEN, EU_NOW),
        rescale,
        markValue: "1.50",
      }),
    );
    expect(html).toContain(">1.50 EUR per litre</span>");
    expect(html).not.toContain("0.0015");
  });

  it("draws the Number_Line mark as 1.50 EUR per litre for the same answer", () => {
    const mark = CEREMONY_COPY.markAnswer
      .replace("{value}", "1.50")
      .replace("{unit}", "EUR per litre");
    const html = plain(
      render({
        then: EU_THEN,
        now: EU_NOW,
        change: comparable(EU_THEN, EU_NOW),
        rescale,
        markValue: "1.50",
      }),
    );
    expect(html).toContain(mark);
    expect(html).not.toContain("0.0015");
  });
});

describe("FigureEntry carries its own source, the nowNote and the primary hook", () => {
  it("shows one source control for a comparable pair, with its series and source link", () => {
    const html = render();
    expect(count(html, "<details")).toBe(1);
    expect(html).toContain(`${REVEAL_COPY.seriesLabel}: EMM_EPMR_PTE_NUS_DPG`);
    expect(html).toContain('href="https://www.eia.gov/series"');
  });

  it("renders the nowNote under the now row when one is given", () => {
    const html = plain(render({ nowNote: "Revenant hasn't fetched a newer figure yet." }));
    expect(html).toContain("Revenant hasn&#x27;t fetched a newer figure yet.");
  });

  it("marks the card as the primary control only when asked", () => {
    expect(render({ primary: true })).toContain('data-primary-control=""');
    expect(render()).not.toContain("data-primary-control");
  });
});

// Issue #339 (X3): a Now_Figure that is a bundled fallback shows its own period
// and retrieved date through the Bundled_Note. Reason for this block: the
// fallback path was rendered by FigureEntry but had no test pinning the now
// period and the note to the now row. FigureEntry itself is unchanged.
describe("FigureEntry shows a fallback Now_Figure with its own period and the Bundled_Note", () => {
  const FALLBACK_NOW: Readonly<FigureV1> = {
    ...NOW,
    period: "2026-09",
    retrieved_at: "2026-10-30T14:02:11Z",
  };
  const BUNDLED_NOTE = nowMessageFor({
    kind: "found",
    fallback: true,
    retrievedAt: FALLBACK_NOW.retrieved_at,
  });

  it("shows the fallback figure's own period, not the then period, in the now row", () => {
    const html = plain(
      render({
        now: FALLBACK_NOW,
        change: comparable(THEN, FALLBACK_NOW),
        nowNote: BUNDLED_NOTE ?? undefined,
      }),
    );
    expect(html).toContain(formatPeriod(FALLBACK_NOW.period, FALLBACK_NOW.region));
    expect(html).toContain(formatPeriod(THEN.period, THEN.region));
  });

  it("draws the Bundled_Note under the now row, after it", () => {
    const html = plain(
      render({
        now: FALLBACK_NOW,
        change: comparable(THEN, FALLBACK_NOW),
        nowNote: BUNDLED_NOTE ?? undefined,
      }),
    );
    expect(BUNDLED_NOTE).not.toBeNull();
    // Static markup entity-encodes the apostrophe in "hasn't".
    const noteAt = html.indexOf((BUNDLED_NOTE ?? "").replace(/'/g, "&#x27;"));
    expect(noteAt).toBeGreaterThan(-1);
    expect(noteAt).toBeGreaterThan(html.indexOf('data-role="now"'));
    expect(html).toContain("30 October 2026");
  });

  it("keeps the then figure and its period when the now figure is a fallback", () => {
    const html = plain(
      render({
        now: FALLBACK_NOW,
        change: comparable(THEN, FALLBACK_NOW),
        nowNote: BUNDLED_NOTE ?? undefined,
      }),
    );
    expect(html).toContain('data-role="then"');
    expect(html).toContain(REVEAL_COPY.then);
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

  it("the receipt card sets desk text tokens only", () => {
    const rule = ruleBody(".fig");
    expect(rule).toMatch(/color:\s*var\(--text\)/);
    expect(rule).not.toMatch(/--paper|--ink/);
  });
});

describe("FigureEntry shows the change line in the rescaled unit (C8.4, eu-tomas)", () => {
  // The eu-tomas case: the petrol figure is sealed per 1,000 litres and shown
  // per litre. Then 1800.00, now 1900.00, both in the same series.
  const rescale: DisplayRescale = { divisor: 1000, unit: "EUR per litre" };
  const TOMAS_THEN: Readonly<FigureV1> = {
    ...THEN,
    value: "1800.00",
    unit: "EUR per 1,000 litres",
    region: "European Union",
    period: "2024-05",
  };
  const TOMAS_NOW: Readonly<FigureV1> = {
    ...TOMAS_THEN,
    value: "1900.00",
    period: "2026-05",
  };

  it("builds the formula from the per-litre inputs and shows the rescale note", () => {
    const html = plain(
      render({
        then: TOMAS_THEN,
        now: TOMAS_NOW,
        change: comparable(TOMAS_THEN, TOMAS_NOW),
        rescale,
      }),
    );
    expect(html).toContain(`${REVEAL_COPY.formulaLabel}: (1.9 - 1.8) / 1.8 x 100`);
    expect(html).not.toContain("(1900.00 - 1800.00)");
    expect(html).toContain(
      REVEAL_COPY.rescaledNote
        .replace("{toUnit}", "EUR per litre")
        .replace("{fromUnit}", "EUR per 1,000 litres"),
    );
  });
});
