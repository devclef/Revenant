// Tests for the figure-file loader (spec 02-demo-figures).
//
// The loader is the guard that keeps invented or malformed figures out of the
// demo (data-integrity.md). These tests prove a valid file loads, groups and
// sorts without ever rescaling or touching a value string, and is deep-frozen;
// and that each rule break throws a FigureDataError naming the broken rule.
// No network.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { loadFigureFile, FigureDataError } from "./load";
import type { FigureDataRule } from "./load";
import { CATALOGUE } from "./catalogue";
import type { FigureFile } from "./types";
import type { FigureV1, MetricDefinitionV1 } from "@/lib/seal-format";

// --- Test helpers ------------------------------------------------------------

// The fixture file's own FIXTURE-prefixed series: one weekly, one monthly.
const FIXTURE_WEEKLY_METRIC: MetricDefinitionV1 = {
  id: "fixture-weekly",
  display_name: "Fixture weekly series",
  unit: "FIXTURE unit",
  region: "FIXTURE region",
  source: "FIXTURE source weekly",
  series_id: "FIXTURE-WEEKLY",
};

const FIXTURE_MONTHLY_METRIC: MetricDefinitionV1 = {
  id: "fixture-monthly",
  display_name: "Fixture monthly series",
  unit: "FIXTURE unit",
  region: "FIXTURE region",
  source: "FIXTURE source monthly",
  series_id: "FIXTURE-MONTHLY",
};

// The official branch of the FigureV1 union. The loader's test figures are all
// official, and this concrete type keeps spread-overrides (…, unit: x) inside
// the official branch so TypeScript does not widen them out of FigureV1.
type OfficialFigure = Extract<FigureV1, { kind: "official" }>;

// Build one FIXTURE figure for a given metric and period.
function fixtureFigure(
  metric: MetricDefinitionV1,
  period: string,
  value: string,
): OfficialFigure {
  return {
    kind: "official",
    metric_id: metric.id,
    value,
    unit: metric.unit,
    region: metric.region,
    period,
    source: metric.source,
    series_id: metric.series_id,
    retrieved_at: "2026-10-30T14:02:11Z",
    source_url: "https://example.invalid/fixture",
  };
}

// Apply field overrides to a figure, keeping it in the official branch so the
// result stays assignable to FigureV1 (the test figures are all official).
function editFigure(
  fig: FigureV1,
  overrides: Partial<OfficialFigure>,
): OfficialFigure {
  return { ...(fig as OfficialFigure), ...overrides };
}

// A minimal valid fixture file. fixture:true, its two FIXTURE-prefixed series,
// and a few figures given deliberately out of period order so the loader's
// sort is observable. Rebuilt per call so a mutation never leaks between tests.
function buildValidFile(): FigureFile {
  return {
    fixture: true,
    note: "minimal valid fixture file for loader tests",
    series: [
      { metric: { ...FIXTURE_WEEKLY_METRIC }, period_type: "weekly" },
      { metric: { ...FIXTURE_MONTHLY_METRIC }, period_type: "monthly" },
    ],
    figures: [
      // Out of order on purpose (middle, newest, oldest) for the weekly series.
      fixtureFigure(FIXTURE_WEEKLY_METRIC, "2024-02-12", "2.000"),
      fixtureFigure(FIXTURE_WEEKLY_METRIC, "2024-03-04", "3.000"),
      fixtureFigure(FIXTURE_WEEKLY_METRIC, "2024-01-01", "1.000"),
      // Monthly series, also out of order.
      fixtureFigure(FIXTURE_MONTHLY_METRIC, "2024-03", "30.00"),
      fixtureFigure(FIXTURE_MONTHLY_METRIC, "2024-01", "10.00"),
    ],
  };
}

// --- Happy path --------------------------------------------------------------

describe("loadFigureFile: valid file", () => {
  it("loads and groups figures by series", () => {
    const loaded = loadFigureFile(buildValidFile(), CATALOGUE);

    // Every catalogue series is present, then the two fixture series.
    for (const series of CATALOGUE) {
      expect(loaded.series.has(series.metric.id)).toBe(true);
    }
    expect(loaded.series.has("fixture-weekly")).toBe(true);
    expect(loaded.series.has("fixture-monthly")).toBe(true);

    const weekly = loaded.series.get("fixture-weekly");
    const monthly = loaded.series.get("fixture-monthly");
    expect(weekly?.figures).toHaveLength(3);
    expect(monthly?.figures).toHaveLength(2);
    expect(loaded.fixture).toBe(true);
  });

  it("sorts each series by period end, oldest first, regardless of input order", () => {
    const loaded = loadFigureFile(buildValidFile(), CATALOGUE);

    expect(
      loaded.series.get("fixture-weekly")?.figures.map((f) => f.period),
    ).toEqual(["2024-01-01", "2024-02-12", "2024-03-04"]);
    expect(
      loaded.series.get("fixture-monthly")?.figures.map((f) => f.period),
    ).toEqual(["2024-01", "2024-03"]);
  });

  it("keeps every value string exactly as given and never rescales", () => {
    const loaded = loadFigureFile(buildValidFile(), CATALOGUE);

    expect(
      loaded.series.get("fixture-weekly")?.figures.map((f) => f.value),
    ).toEqual(["1.000", "2.000", "3.000"]);
    expect(
      loaded.series.get("fixture-monthly")?.figures.map((f) => f.value),
    ).toEqual(["10.00", "30.00"]);
    // Units are the published units; a display_rescale never touches value/unit.
    for (const f of loaded.series.get("fixture-weekly")?.figures ?? []) {
      expect(f.unit).toBe("FIXTURE unit");
    }
  });

  it("includes catalogue series with no figures as empty series", () => {
    const loaded = loadFigureFile(buildValidFile(), CATALOGUE);

    for (const series of CATALOGUE) {
      expect(loaded.series.get(series.metric.id)?.figures).toEqual([]);
    }
  });

  it("deep-freezes the result, the series map, its entries and the figures", () => {
    const loaded = loadFigureFile(buildValidFile(), CATALOGUE);

    expect(Object.isFrozen(loaded)).toBe(true);
    expect(Object.isFrozen(loaded.series)).toBe(true);

    const weekly = loaded.series.get("fixture-weekly");
    expect(weekly).toBeDefined();
    expect(Object.isFrozen(weekly)).toBe(true);
    expect(Object.isFrozen(weekly?.figures)).toBe(true);
    expect(Object.isFrozen(weekly?.figures[0])).toBe(true);
    expect(Object.isFrozen(weekly?.metric)).toBe(true);
  });
});

// --- Rejection: one example per rule -----------------------------------------

describe("loadFigureFile: rejections", () => {
  it("R1.4 metric_mismatch: a figure field differs from its metric", () => {
    const file = buildValidFile();
    file.figures[0] = editFigure(file.figures[0], {
      unit: "a different unit", // no longer matches the weekly metric
    });
    try {
      loadFigureFile(file, CATALOGUE);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(FigureDataError);
      expect((err as FigureDataError).rule).toBe("metric_mismatch");
    }
  });

  it("R3.3 bad_period: a malformed period", () => {
    const file = buildValidFile();
    file.figures[3] = editFigure(file.figures[3], {
      period: "2024-13", // month out of range for a monthly series
    });
    try {
      loadFigureFile(file, CATALOGUE);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(FigureDataError);
      expect((err as FigureDataError).rule).toBe("bad_period");
    }
  });

  it("R3.5 duplicate_period: two figures share a period in one series", () => {
    const file = buildValidFile();
    // Add a second weekly figure on an existing weekly period.
    file.figures.push(fixtureFigure(FIXTURE_WEEKLY_METRIC, "2024-01-01", "9.999"));
    try {
      loadFigureFile(file, CATALOGUE);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(FigureDataError);
      expect((err as FigureDataError).rule).toBe("duplicate_period");
    }
  });

  it("R5.4 fixture_flag: fixture:true but one entry is missing the prefix", () => {
    const file = buildValidFile();
    // Drop the FIXTURE prefix from one figure's source and series_id.
    file.figures[0] = editFigure(file.figures[0], {
      source: "Real source",
      series_id: "REAL-WEEKLY",
    });
    // The metric must still match, or metric_mismatch would fire first.
    file.series[0] = {
      ...file.series[0],
      metric: {
        ...file.series[0].metric,
        source: "Real source",
        series_id: "REAL-WEEKLY",
      },
    };
    try {
      loadFigureFile(file, CATALOGUE);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(FigureDataError);
      expect((err as FigureDataError).rule).toBe("fixture_flag");
    }
  });

  it("R5.4 fixture_flag: fixture:false but one entry carries the prefix", () => {
    const file = buildValidFile();
    file.fixture = false;
    try {
      loadFigureFile(file, CATALOGUE);
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(FigureDataError);
      expect((err as FigureDataError).rule).toBe("fixture_flag");
    }
  });
});

// --- Property 10 -------------------------------------------------------------

// Generators use FIXTURE sources, round values and Monday or YYYY-MM periods,
// so a freshly generated file is always valid; each sample then applies exactly
// one mutation and asserts the matching rule fires.

// Mondays in 2024 so weekly periods are real dates (the loader only needs them
// to be real dates; "Monday" is a convention for figure data).
const mondayArb = fc
  .integer({ min: 0, max: 51 })
  .map((w) => {
    // 2024-01-01 is a Monday. Add w weeks.
    const base = Date.UTC(2024, 0, 1) + w * 7 * 86_400_000;
    const d = new Date(base);
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });

const monthArb = fc
  .integer({ min: 1, max: 12 })
  .map((m) => `2024-${String(m).padStart(2, "0")}`);

const valueArb = fc.integer({ min: 1, max: 9999 }).map((n) => `${n}.000`);

// A valid generated file: a fixture:true file with a weekly and a monthly
// FIXTURE series and distinct-period figures in each.
const validFileArb = fc
  .record({
    weeklyPeriods: fc.uniqueArray(mondayArb, { minLength: 1, maxLength: 4 }),
    monthlyPeriods: fc.uniqueArray(monthArb, { minLength: 1, maxLength: 4 }),
    weeklyValues: fc.array(valueArb, { minLength: 4, maxLength: 4 }),
    monthlyValues: fc.array(valueArb, { minLength: 4, maxLength: 4 }),
  })
  .map(({ weeklyPeriods, monthlyPeriods, weeklyValues, monthlyValues }) => {
    const file: FigureFile = {
      fixture: true,
      series: [
        { metric: { ...FIXTURE_WEEKLY_METRIC }, period_type: "weekly" },
        { metric: { ...FIXTURE_MONTHLY_METRIC }, period_type: "monthly" },
      ],
      figures: [
        ...weeklyPeriods.map((p, i) =>
          fixtureFigure(FIXTURE_WEEKLY_METRIC, p, weeklyValues[i] ?? "1.000"),
        ),
        ...monthlyPeriods.map((p, i) =>
          fixtureFigure(FIXTURE_MONTHLY_METRIC, p, monthlyValues[i] ?? "1.000"),
        ),
      ],
    };
    return file;
  });

type Mutation =
  | "metric_mismatch"
  | "bad_period"
  | "duplicate_period"
  | "unknown_metric"
  | "duplicate_metric_id"
  | "fixture_flag_true"
  | "fixture_flag_false";

const mutationArb = fc.constantFrom<Mutation>(
  "metric_mismatch",
  "bad_period",
  "duplicate_period",
  "unknown_metric",
  "duplicate_metric_id",
  "fixture_flag_true",
  "fixture_flag_false",
);

// Apply one mutation to a valid file and return the rule it must trigger.
function mutate(file: FigureFile, mutation: Mutation): FigureDataRule {
  switch (mutation) {
    case "metric_mismatch":
      file.figures[0] = editFigure(file.figures[0], {
        region: "a different region",
      });
      return "metric_mismatch";
    case "bad_period":
      file.figures[0] = editFigure(file.figures[0], { period: "2024-13-99" });
      return "bad_period";
    case "duplicate_period":
      file.figures.push(editFigure(file.figures[0], {}));
      return "duplicate_period";
    case "unknown_metric":
      file.figures[0] = editFigure(file.figures[0], {
        metric_id: "no-such-metric",
      });
      return "unknown_metric";
    case "duplicate_metric_id":
      // A second series re-using the weekly metric's id.
      file.series.push({
        metric: { ...FIXTURE_WEEKLY_METRIC },
        period_type: "weekly",
      });
      return "duplicate_metric_id";
    case "fixture_flag_true":
      // fixture stays true, but one figure drops the prefix (and its metric
      // matches, so fixture_flag is the first rule to fire).
      file.series[0] = {
        ...file.series[0],
        metric: {
          ...file.series[0].metric,
          source: "Real source",
          series_id: "REAL-WEEKLY",
        },
      };
      file.figures = file.figures.map((f) =>
        f.metric_id === "fixture-weekly"
          ? editFigure(f, { source: "Real source", series_id: "REAL-WEEKLY" })
          : f,
      );
      return "fixture_flag";
    case "fixture_flag_false":
      file.fixture = false;
      return "fixture_flag";
  }
}

// Feature: 02-demo-figures, Property 10: The loader rejects every rule break
describe("Property 10: The loader rejects every rule break", () => {
  it("every single mutation of a valid file throws FigureDataError with the matching rule", () => {
    fc.assert(
      fc.property(validFileArb, mutationArb, (baseFile, mutation) => {
        // Sanity: the unmutated file loads.
        const clean = loadFigureFile(baseFile, CATALOGUE);
        expect(clean.fixture).toBe(true);

        // Mutate a fresh deep copy so the valid-load check above is independent.
        const file: FigureFile = JSON.parse(JSON.stringify(baseFile));
        const expectedRule = mutate(file, mutation);

        try {
          loadFigureFile(file, CATALOGUE);
          throw new Error(`expected throw for mutation ${mutation}`);
        } catch (err) {
          expect(err).toBeInstanceOf(FigureDataError);
          expect((err as FigureDataError).rule).toBe(expectedRule);
        }
      }),
      { numRuns: 100 },
    );
  });
});
