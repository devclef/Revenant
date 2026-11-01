// Persona consistency and payload identity tests for the demo figures
// (spec 04-real-figures, Task 7; issue #81).
//
// Every persona metric must resolve to a found "then" figure at the persona's
// written_as_of date in DEMO_FIGURES. The payload identity tests check that the
// fixture series Maya's letter relies on are the merged set's own frozen
// objects, and that their values match a fresh load of the fixture file. No
// network, no database.

import { describe, expect, it } from "vitest";

import { PERSONAS } from "@/lib/personas";

import { CATALOGUE } from "../catalogue";
import { loadFigureFile } from "../load";
import { thenAndNow } from "../then-now";

import { DEMO_FIGURES } from ".";
import fixture from "./us-fuel.fixture.json";

const MAYA_KEY = "us-maya";
const MAYA_WRITTEN_AS_OF = "2024-05-12";

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
  const mayaMetricIds = maya.metrics.map((m) => m.metric_id);

  // A fresh fixture-only load, validated against the same catalogue.
  const fixtureOnly = loadFigureFile(fixture, CATALOGUE);

  it("Maya's written_as_of is the date these identity checks use", () => {
    expect(maya.written_as_of).toBe(MAYA_WRITTEN_AS_OF);
  });

  it("every fixture metric Maya tracks is in the fixture file", () => {
    for (const id of mayaMetricIds) {
      expect(fixtureOnly.series.has(id)).toBe(true);
    }
  });

  it("thenAndNow returns the figure objects the merged set holds (===)", () => {
    for (const id of mayaMetricIds) {
      const merged = DEMO_FIGURES.series.get(id);
      expect(merged).toBeDefined();
      const result = thenAndNow(id, MAYA_WRITTEN_AS_OF, DEMO_FIGURES);
      if (!result.then.found || !result.now.found) {
        throw new Error(`no then/now figure for ${id}`);
      }
      expect(merged!.figures).toContain(result.then.figure);
      expect(merged!.figures).toContain(result.now.figure);
    }
  });

  it("the merged series for each fixture metric matches a fresh fixture-only load", () => {
    // loadFigureFile does not cache, so each load creates new objects. Object
    // identity with a separate load is not possible. Value identity is.
    for (const id of mayaMetricIds) {
      const merged = DEMO_FIGURES.series.get(id);
      const alone = fixtureOnly.series.get(id);
      expect(merged).toBeDefined();
      expect(alone).toBeDefined();
      expect(merged!.metric).toEqual(alone!.metric);
      expect(merged!.period_type).toBe(alone!.period_type);
      expect(merged!.figures).toEqual(alone!.figures);
    }
  });
});
