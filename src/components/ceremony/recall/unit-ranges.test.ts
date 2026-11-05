import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { CATALOGUE } from "@/lib/figures/catalogue";
import { CEREMONY_COPY } from "../copy";
import {
  FALLBACK_RANGE,
  UNIT_HELPER_UNIT,
  UNIT_RANGE_TABLE,
  scaleRangeFor,
  unitHelperFor,
} from "./unit-ranges";

// Feature: 08-judge-polish, Task 1 (Unit_Range_Table, unit helper line).
//
// Example tests pin the approved values (R7.10). Property tests cover Property 2
// (the range depends only on the exact unit string) and the unit-level part of
// Property 9 (the helper line depends only on the exact unit string).

const NUM_RUNS = 100;

describe("UNIT_RANGE_TABLE — approved values (R7.10)", () => {
  it("holds exactly the two approved keys and no Sweden unit", () => {
    expect(Object.keys(UNIT_RANGE_TABLE).sort()).toEqual([
      "EUR per 1,000 litres",
      "USD per gallon",
    ]);
    for (const key of Object.keys(UNIT_RANGE_TABLE)) {
      expect(key).not.toContain("SEK");
    }
  });

  it("USD per gallon is 0 to 10, linear, ticks every 2", () => {
    expect(UNIT_RANGE_TABLE["USD per gallon"]).toEqual({
      min: 0,
      max: 10,
      scale: "linear",
      ticks: [0, 2, 4, 6, 8, 10],
    });
  });

  it("EUR per 1,000 litres is 0 to 3,000, linear, ticks every 500", () => {
    expect(UNIT_RANGE_TABLE["EUR per 1,000 litres"]).toEqual({
      min: 0,
      max: 3000,
      scale: "linear",
      ticks: [0, 500, 1000, 1500, 2000, 2500, 3000],
    });
  });

  it("the Fallback_Range is the 10^-2 to 10^5 log track", () => {
    expect(FALLBACK_RANGE).toEqual({
      min: 0.01,
      max: 100000,
      scale: "log",
      ticks: [0.01, 0.1, 1, 10, 100, 1000, 10000, 100000],
    });
  });
});

describe("scaleRangeFor — examples", () => {
  it("returns the table entry for each exact key", () => {
    expect(scaleRangeFor("USD per gallon")).toBe(
      UNIT_RANGE_TABLE["USD per gallon"],
    );
    expect(scaleRangeFor("EUR per 1,000 litres")).toBe(
      UNIT_RANGE_TABLE["EUR per 1,000 litres"],
    );
  });

  it("returns the Fallback_Range for an unknown unit", () => {
    expect(scaleRangeFor("SEK per litre")).toBe(FALLBACK_RANGE);
    expect(scaleRangeFor("")).toBe(FALLBACK_RANGE);
  });

  it("returns the Fallback_Range for prototype property names", () => {
    expect(scaleRangeFor("toString")).toBe(FALLBACK_RANGE);
    expect(scaleRangeFor("__proto__")).toBe(FALLBACK_RANGE);
    expect(scaleRangeFor("constructor")).toBe(FALLBACK_RANGE);
  });
});

// Property 2: The Recall_Scale range depends only on the exact unit string.
// Validates: Requirements 7.3, 7.4, 7.5
describe("Property 2: the range depends only on the exact unit string", () => {
  const keys = Object.keys(UNIT_RANGE_TABLE);

  it("every whitespace or case variant of a key falls back", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...keys),
        fc.constantFrom(
          (k: string) => ` ${k}`,
          (k: string) => `${k} `,
          (k: string) => `\t${k}\n`,
          (k: string) => k.toUpperCase(),
          (k: string) => k.toLowerCase(),
        ),
        (key, variant) => {
          const changed = variant(key);
          fc.pre(changed !== key);
          expect(scaleRangeFor(changed)).toBe(FALLBACK_RANGE);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("any string that is not an own key gets the Fallback_Range", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !Object.hasOwn(UNIT_RANGE_TABLE, s)),
        (unit) => {
          expect(scaleRangeFor(unit)).toBe(FALLBACK_RANGE);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

// Coverage (R7.1): every unit the Catalogue and the sealed personas use has a
// table entry. The persona units come from the figures each persona names.
describe("unit coverage (R7.1)", () => {
  it("every Catalogue unit has its own key in UNIT_RANGE_TABLE", () => {
    for (const series of CATALOGUE) {
      expect(
        Object.hasOwn(UNIT_RANGE_TABLE, series.metric.unit),
        `missing range for "${series.metric.unit}"`,
      ).toBe(true);
    }
  });

  it("every unit a persona entry names has its own key in UNIT_RANGE_TABLE", () => {
    const personasUrl = new URL(
      "../../../../content/personas/personas.json",
      import.meta.url,
    );
    const personas = JSON.parse(readFileSync(personasUrl, "utf8")) as {
      personas: { metrics: { metric_id: string }[] }[];
    };
    const unitById = new Map(
      CATALOGUE.map((s) => [s.metric.id, s.metric.unit]),
    );

    for (const persona of personas.personas) {
      for (const metric of persona.metrics) {
        const unit = unitById.get(metric.metric_id);
        expect(unit, `no Catalogue unit for ${metric.metric_id}`).toBeDefined();
        expect(
          Object.hasOwn(UNIT_RANGE_TABLE, unit as string),
          `missing range for "${unit}"`,
        ).toBe(true);
      }
    }
  });
});

describe("unitHelperFor — examples and Property 9 (unit level)", () => {
  it("returns the constant for the euro-per-1,000-litres unit", () => {
    expect(unitHelperFor(UNIT_HELPER_UNIT)).toBe(
      CEREMONY_COPY.unitHelperEurPer1000L,
    );
    expect(unitHelperFor("EUR per 1,000 litres")).toBe(
      "1,000 here means 1 euro per litre.",
    );
  });

  it("returns null for every other unit", () => {
    expect(unitHelperFor("USD per gallon")).toBeNull();
    expect(unitHelperFor("SEK per litre")).toBeNull();
    expect(unitHelperFor("")).toBeNull();
  });

  // Property 9: The Unit_Helper_Line depends only on the unit string.
  // Validates: Requirements 7.8, 7.9
  it("never appears for a changed case or added whitespace", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(
          (k: string) => k.toLowerCase(),
          (k: string) => k.toUpperCase(),
          (k: string) => ` ${k}`,
          (k: string) => `${k} `,
          (k: string) => k.replace(/,/g, ""),
        ),
        (variant) => {
          const changed = variant(UNIT_HELPER_UNIT);
          fc.pre(changed !== UNIT_HELPER_UNIT);
          expect(unitHelperFor(changed)).toBeNull();
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
