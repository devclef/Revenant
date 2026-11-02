// Persona consistency tests for the demo figures (spec 04-real-figures, Task 7;
// issue #81; issue #83 removes the fixture-payload identity checks).
//
// Every persona metric must resolve to a found "then" figure at the persona's
// written_as_of date in DEMO_FIGURES. No network, no database.

import { describe, expect, it } from "vitest";

import { PERSONAS } from "@/lib/personas";

import { thenAndNow } from "../then-now";

import { DEMO_FIGURES } from ".";

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
