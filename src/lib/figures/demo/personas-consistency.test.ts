// Persona consistency and payload identity tests for the demo figures
// (spec 04-real-figures, Task 7; issue #81).
//
// Every persona metric must resolve to a found "then" figure at the persona's
// written_as_of date in DEMO_FIGURES. The payload identity tests check that
// Maya's fixture series and figures in DEMO_FIGURES are the exact objects of
// the fixture-only set (DEMO_FIXTURE_FIGURES). No network, no database.

import { describe, expect, it } from "vitest";

import { PERSONAS } from "@/lib/personas";

import { thenAndNow } from "../then-now";

import { DEMO_FIGURES, DEMO_FIXTURE_FIGURES } from ".";

const MAYA_KEY = "us-maya";
const MAYA_WRITTEN_AS_OF = "2024-05-12";
// Fixed fixture IDs, not read from PERSONAS: task 8 moves Maya to the catalogue
// metrics, and these identity checks must keep passing after that.
const MAYA_FIXTURE_METRIC_IDS = [
  "fixture-us-gasoline-regular",
  "fixture-us-diesel",
] as const;

describe("demo figures: every persona metric has a then figure", () => {
  it("loads at least one persona", () => {
    expect(PERSONAS.length).toBeGreaterThan(0);
  });

  for (const persona of PERSONAS) {
    for (const metric of persona.metrics) {
      it(`${persona.key}: then figure found at written_as_of for ${metric.metric_id}`, () => {
        const result = thenAndNow(
          metric.metric_id,
          persona.written_as_of,
          DEMO_FIGURES,
        );
        expect(result.then.found).toBe(true);
      });
    }
  }
});

describe("demo figures: payload identity for Maya's fixture metrics", () => {
  const maya = PERSONAS.find((p) => p.key === MAYA_KEY);
  if (maya === undefined) {
    throw new Error(`persona ${MAYA_KEY} is missing from PERSONAS`);
  }
  it("Maya's written_as_of is the date these identity checks use", () => {
    expect(maya.written_as_of).toBe(MAYA_WRITTEN_AS_OF);
  });

  it("every fixture metric used by the identity checks is in the fixture-only set", () => {
    for (const id of MAYA_FIXTURE_METRIC_IDS) {
      expect(DEMO_FIXTURE_FIGURES.series.has(id)).toBe(true);
    }
  });

  it("DEMO_FIGURES.series.get(id) is === the fixture-only LoadedSeries", () => {
    for (const id of MAYA_FIXTURE_METRIC_IDS) {
      const merged = DEMO_FIGURES.series.get(id);
      const fixtureOnly = DEMO_FIXTURE_FIGURES.series.get(id);
      expect(fixtureOnly).toBeDefined();
      expect(merged).toBe(fixtureOnly);
    }
  });

  it("thenAndNow on DEMO_FIGURES returns figure objects === the fixture-only ones", () => {
    for (const id of MAYA_FIXTURE_METRIC_IDS) {
      const fixtureOnly = DEMO_FIXTURE_FIGURES.series.get(id);
      if (fixtureOnly === undefined) {
        throw new Error(`fixture-only set has no series ${id}`);
      }
      const result = thenAndNow(id, MAYA_WRITTEN_AS_OF, DEMO_FIGURES);
      if (!result.then.found || !result.now.found) {
        throw new Error(`no then/now figure for ${id}`);
      }
      // The returned objects are the exact frozen figures of the fixture-only
      // series, found by identity (not by period or by value).
      expect(
        fixtureOnly.figures.indexOf(result.then.figure),
      ).toBeGreaterThanOrEqual(0);
      expect(
        fixtureOnly.figures.indexOf(result.now.figure),
      ).toBeGreaterThanOrEqual(0);
    }
  });
});
