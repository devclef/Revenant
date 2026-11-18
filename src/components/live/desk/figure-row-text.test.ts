import { describe, expect, it } from "vitest";

import { CATALOGUE } from "@/lib/figures/catalogue";

import { SHORT_PUBLISHERS } from "./short-publishers";
import { shortUnit } from "./short-units";
import {
  figureRowName,
  figureRowPeriod,
  shortPublisher,
  sourcesLine,
} from "./figure-row-text";

const CATALOGUE_SOURCES = [...new Set(CATALOGUE.map((c) => c.metric.source))];

const CATALOGUE_UNITS = [
  ...new Set(
    CATALOGUE.flatMap((c) => [
      c.metric.unit,
      ...(c.display_rescale ? [c.display_rescale.unit] : []),
    ]),
  ),
];

describe("SHORT_PUBLISHERS", () => {
  it("has a short name for every catalogue source", () => {
    expect(CATALOGUE_SOURCES.length).toBeGreaterThan(0);
    for (const source of CATALOGUE_SOURCES) {
      expect(SHORT_PUBLISHERS.get(source)).toBeTruthy();
    }
  });
});

describe("shortUnit", () => {
  it("has a short form for every catalogue unit", () => {
    for (const unit of CATALOGUE_UNITS) {
      expect(shortUnit(unit)).not.toBe("");
      expect(shortUnit(unit)).not.toBe(unit);
    }
  });

  it("returns an unlisted unit as it was published", () => {
    expect(shortUnit("SEK per litre")).toBe("SEK per litre");
  });

  it("does not return inherited object properties", () => {
    expect(shortUnit("constructor")).toBe("constructor");
  });
});

describe("shortPublisher", () => {
  it("shortens every catalogue source", () => {
    expect(shortPublisher(CATALOGUE_SOURCES[0])).toBe("U.S. EIA");
    expect(shortPublisher(CATALOGUE_SOURCES[1])).toBe("EU Weekly Oil Bulletin");
  });

  it("returns a source with no short name in full", () => {
    expect(shortPublisher("Swedish National Board of Housing")).toBe(
      "Swedish National Board of Housing",
    );
  });
});

describe("figureRowPeriod", () => {
  it("reads a weekly day as its week, without the year", () => {
    expect(figureRowPeriod("2026-11-09", "weekly")).toBe("week of 9 Nov");
  });

  it("reads a monthly period as its month and year", () => {
    expect(figureRowPeriod("2026-10-01", "monthly")).toBe("Oct 2026");
    expect(figureRowPeriod("2024-09", "monthly")).toBe("Sep 2024");
  });

  it("returns a period that does not parse as it was published", () => {
    expect(figureRowPeriod("2026-13-40", "weekly")).toBe("2026-13-40");
    expect(figureRowPeriod("2026-Q4", "monthly")).toBe("2026-Q4");
  });
});

describe("sourcesLine", () => {
  it("names each publisher once, with a middle dot between them", () => {
    expect(sourcesLine([CATALOGUE_SOURCES[0], CATALOGUE_SOURCES[1]])).toBe(
      "Sources: U.S. EIA · EU Weekly Oil Bulletin.",
    );
    expect(sourcesLine([CATALOGUE_SOURCES[0], CATALOGUE_SOURCES[0]])).toBe(
      "Sources: U.S. EIA.",
    );
  });

  it("is empty when there are no sources", () => {
    expect(sourcesLine([])).toBe("");
  });
});

describe("figureRowName", () => {
  it("holds the full unit and the row's own region", () => {
    expect(
      figureRowName({
        displayName: "No. 2 diesel, retail price",
        unit: "EUR per 1,000 litres",
        region: "EU27, weighted average",
      }),
    ).toBe(
      "No. 2 diesel, retail price, EUR per 1,000 litres, EU27, weighted average",
    );
  });
});
