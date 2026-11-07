import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { CATALOGUE } from "@/lib/figures/catalogue";
import { displayRescaleForUnit } from "@/lib/figures/rescale";
import * as unitRanges from "./unit-ranges";
import {
  FALLBACK_RANGE,
  UNIT_RANGE_TABLE,
  displayUnitFor,
  rescaleNoteFor,
  scaleRangeFor,
} from "./unit-ranges";

// Feature: 09-demo-polish, C8 (EU display unit, option b). This file replaces the
// spec 08 R7.8 to R7.10 tests: the Unit_Helper_Line is gone, and the unit table
// now holds the displayed unit `EUR per litre`.
//
// Example tests pin the approved values. Property tests cover Property 2 (the
// range depends only on the exact displayed unit string) and the C8 rule that
// the display unit depends only on the exact sealed unit string.

const NUM_RUNS = 100;
const SEALED_EUR = "EUR per 1,000 litres";
const NOTE = "Published per 1,000 litres, shown per litre.";

describe("UNIT_RANGE_TABLE — approved values", () => {
  it("holds exactly the two displayed units and no Sweden unit", () => {
    expect(Object.keys(UNIT_RANGE_TABLE).sort()).toEqual([
      "EUR per litre",
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

  it("EUR per litre is 0 to 3, linear, ticks every 0.5", () => {
    expect(UNIT_RANGE_TABLE["EUR per litre"]).toEqual({
      min: 0,
      max: 3,
      scale: "linear",
      ticks: [0, 0.5, 1, 1.5, 2, 2.5, 3],
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
  it("returns the table entry for each exact displayed unit", () => {
    expect(scaleRangeFor("USD per gallon")).toBe(UNIT_RANGE_TABLE["USD per gallon"]);
    expect(scaleRangeFor("EUR per litre")).toBe(UNIT_RANGE_TABLE["EUR per litre"]);
  });

  it("returns the Fallback_Range for an unknown unit", () => {
    expect(scaleRangeFor("SEK per litre")).toBe(FALLBACK_RANGE);
    expect(scaleRangeFor("")).toBe(FALLBACK_RANGE);
  });

  it("returns the Fallback_Range for the sealed unit, which is resolved first", () => {
    // Callers pass the displayed unit. The sealed string is not a table key.
    expect(scaleRangeFor(SEALED_EUR)).toBe(FALLBACK_RANGE);
  });

  it("returns the Fallback_Range for prototype property names", () => {
    expect(scaleRangeFor("toString")).toBe(FALLBACK_RANGE);
    expect(scaleRangeFor("__proto__")).toBe(FALLBACK_RANGE);
    expect(scaleRangeFor("constructor")).toBe(FALLBACK_RANGE);
  });
});

describe("displayUnitFor and the rescale note (C8) — examples", () => {
  it("shows the sealed EUR per 1,000 litres as EUR per litre, with the note", () => {
    expect(displayUnitFor(SEALED_EUR)).toBe("EUR per litre");
    expect(rescaleNoteFor(SEALED_EUR)).toBe(NOTE);
  });

  it("shows a unit with no display rescale as sealed, with no note", () => {
    expect(displayUnitFor("USD per gallon")).toBe("USD per gallon");
    expect(rescaleNoteFor("USD per gallon")).toBeNull();
  });

  it("does not match a case or spacing variant of the sealed unit", () => {
    expect(displayUnitFor("eur per 1,000 litres")).toBe("eur per 1,000 litres");
    expect(displayUnitFor(" EUR per 1,000 litres")).toBe(" EUR per 1,000 litres");
    expect(rescaleNoteFor("EUR per 1,000 litres ")).toBeNull();
  });

  it("agrees with displayRescaleForUnit, so the scale and the figures use one unit", () => {
    expect(displayUnitFor(SEALED_EUR)).toBe(displayRescaleForUnit(SEALED_EUR)?.displayUnit);
  });

  it("exports no Unit_Helper_Line any more (C8.5)", () => {
    expect("unitHelperFor" in unitRanges).toBe(false);
    expect("UNIT_HELPER_UNIT" in unitRanges).toBe(false);
  });
});

// Property 2: The Recall_Scale range depends only on the exact displayed unit.
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

// C8.2: the display unit depends only on the exact sealed unit string.
describe("C8.2: the display unit depends only on the exact sealed unit string", () => {
  it("any sealed unit other than the EUR per 1,000 litres string is shown as sealed", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => s !== SEALED_EUR),
        (unit) => {
          expect(displayUnitFor(unit)).toBe(unit);
          expect(rescaleNoteFor(unit)).toBeNull();
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

// Coverage (R7.1): every unit the Catalogue and the sealed personas use is shown
// with a table entry, after its display unit is resolved.
describe("unit coverage (R7.1)", () => {
  it("every Catalogue unit has a table entry under its displayed unit", () => {
    for (const series of CATALOGUE) {
      const shown = displayUnitFor(series.metric.unit);
      expect(
        Object.hasOwn(UNIT_RANGE_TABLE, shown),
        `missing range for "${shown}" (sealed "${series.metric.unit}")`,
      ).toBe(true);
    }
  });

  it("every unit a persona entry names has a table entry under its displayed unit", () => {
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
        const shown = displayUnitFor(unit as string);
        expect(
          Object.hasOwn(UNIT_RANGE_TABLE, shown),
          `missing range for "${shown}"`,
        ).toBe(true);
      }
    }
  });
});
