// Tests for the fixture predicates (spec 02-demo-figures).

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { FIXTURE_PREFIX, isFixtureFigure, isFixtureMetric } from "./fixture";

describe("FIXTURE_PREFIX", () => {
  it("is the exact, upper-case prefix", () => {
    expect(FIXTURE_PREFIX).toBe("FIXTURE");
  });
});

describe("isFixtureFigure", () => {
  it("is true when source starts with FIXTURE", () => {
    expect(
      isFixtureFigure({ source: "FIXTURE source", series_id: "EIA-123" }),
    ).toBe(true);
  });

  it("is true when series_id starts with FIXTURE", () => {
    expect(
      isFixtureFigure({ source: "U.S. EIA", series_id: "FIXTURE-SERIES" }),
    ).toBe(true);
  });

  it("is true when both start with FIXTURE", () => {
    expect(
      isFixtureFigure({ source: "FIXTURE source", series_id: "FIXTURE-SERIES" }),
    ).toBe(true);
  });

  it("is false when neither starts with FIXTURE", () => {
    expect(
      isFixtureFigure({ source: "U.S. EIA", series_id: "EMM_EPMR_PTE" }),
    ).toBe(false);
  });

  it("is case-sensitive: lowercase fixture is not a fixture", () => {
    expect(
      isFixtureFigure({ source: "fixture source", series_id: "fixture-series" }),
    ).toBe(false);
  });

  it("is false for a leading space before FIXTURE", () => {
    expect(
      isFixtureFigure({ source: " FIXTURE source", series_id: " FIXTURE-X" }),
    ).toBe(false);
  });

  it("is false when FIXTURE appears but not at the start", () => {
    expect(
      isFixtureFigure({ source: "a FIXTURE source", series_id: "x-FIXTURE" }),
    ).toBe(false);
  });
});

describe("isFixtureMetric", () => {
  it("is true when source starts with FIXTURE", () => {
    expect(
      isFixtureMetric({ source: "FIXTURE source", series_id: "EIA-123" }),
    ).toBe(true);
  });

  it("is true when series_id starts with FIXTURE", () => {
    expect(
      isFixtureMetric({ source: "U.S. EIA", series_id: "FIXTURE-SERIES" }),
    ).toBe(true);
  });

  it("is true when both start with FIXTURE", () => {
    expect(
      isFixtureMetric({ source: "FIXTURE source", series_id: "FIXTURE-SERIES" }),
    ).toBe(true);
  });

  it("is false when neither starts with FIXTURE", () => {
    expect(
      isFixtureMetric({ source: "U.S. EIA", series_id: "EMM_EPMR_PTE" }),
    ).toBe(false);
  });

  it("is case-sensitive: lowercase fixture is not a fixture", () => {
    expect(
      isFixtureMetric({ source: "fixture source", series_id: "fixture-series" }),
    ).toBe(false);
  });

  it("is false for a leading space before FIXTURE", () => {
    expect(
      isFixtureMetric({ source: " FIXTURE source", series_id: " FIXTURE-X" }),
    ).toBe(false);
  });

  it("is false when FIXTURE appears but not at the start", () => {
    expect(
      isFixtureMetric({ source: "a FIXTURE source", series_id: "x-FIXTURE" }),
    ).toBe(false);
  });
});

// A generator that mixes ordinary strings with the edge cases the predicate
// must get right: the FIXTURE prefix, lowercase fixture, a leading space, and
// FIXTURE embedded inside a longer string.
const fieldArb = fc.oneof(
  fc.string(),
  fc.string().map((s) => `FIXTURE${s}`),
  fc.string().map((s) => `fixture${s}`),
  fc.string().map((s) => ` FIXTURE${s}`),
  fc.string().map((s) => `${s}FIXTURE${s}`),
);

// Feature: 02-demo-figures, Property 3: Fixture predicates match their definition exactly
describe("Property 3: Fixture predicates match their definition exactly", () => {
  it("isFixtureFigure equals source.startsWith('FIXTURE') || series_id.startsWith('FIXTURE')", () => {
    fc.assert(
      fc.property(fieldArb, fieldArb, (source, series_id) => {
        const expected =
          source.startsWith("FIXTURE") || series_id.startsWith("FIXTURE");
        expect(isFixtureFigure({ source, series_id })).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  it("isFixtureMetric equals source.startsWith('FIXTURE') || series_id.startsWith('FIXTURE')", () => {
    fc.assert(
      fc.property(fieldArb, fieldArb, (source, series_id) => {
        const expected =
          source.startsWith("FIXTURE") || series_id.startsWith("FIXTURE");
        expect(isFixtureMetric({ source, series_id })).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });
});
