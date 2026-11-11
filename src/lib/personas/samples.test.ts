// Property 15: every stored Sample_Candidate is a valid answer (spec 10
// design.md; requirements C5.1 to C5.3, C5.11). Also covers the strict loader
// in samples.ts: a file with a missing, unknown or malformed entry must fail.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { parseRecallNumber } from "@/components/ceremony/recall/parse-number";
import {
  displayUnitFor,
  scaleRangeFor,
} from "@/components/ceremony/recall/unit-ranges";
import { numberAnswerSchema } from "@/lib/recall/record";
import { DEMO_FIGURES } from "@/lib/figures/demo";
import { thenAndNow } from "@/lib/figures/then-now";
import {
  rescaleForDisplay,
  displayRescaleForUnit,
} from "@/lib/figures/rescale";

import { PERSONAS, type Persona } from "./index";
import {
  SAMPLE_CANDIDATES,
  SAMPLE_CANDIDATES_MAX,
  SAMPLE_CANDIDATES_MIN,
  SAMPLE_DECIMALS,
  parseSampleCandidates,
  sampleCandidatesFor,
} from "./samples";
import { classifyCandidate } from "./spread";
import { recordCandidate } from "./record-candidate";

/** Every persona Figure_Question with its sealed Then_Figure. */
function questions() {
  return PERSONAS.flatMap((persona) =>
    persona.metrics.map((metric) => {
      const result = thenAndNow(
        metric.metric_id,
        persona.written_as_of,
        DEMO_FIGURES,
      );
      if (!result.then.found) {
        throw new Error(`no then figure for ${metric.metric_id}`);
      }
      return {
        persona,
        metricId: metric.metric_id,
        candidates: SAMPLE_CANDIDATES[persona.key][metric.metric_id],
        figure: result.then.figure,
      };
    }),
  );
}

/** The Then_Value as the Testify field shows it, rescaled when the unit has one. */
function shownThen(value: string, unit: string): string {
  const rescale = displayRescaleForUnit(unit);
  return rescale === null ? value : rescaleForDisplay(value, rescale.divisor);
}

describe("persona Sample_Candidates file (Property 15)", () => {
  const all = questions();

  it("covers every persona Figure_Question with a list", () => {
    expect(all.length).toBe(4);
    for (const q of all) {
      expect(q.candidates).toBeDefined();
    }
  });

  // Property 15, as a fast-check property (G2.2): for any persona Figure_Question
  // and any stored candidate, the candidate is written with two decimals inside
  // the Unit_Range_Table range, and reads back as itself through the recall
  // parser and the Recall_Record rule.
  it("Property 15: every stored candidate is a valid answer (numRuns 100)", () => {
    const withCandidates = all.filter((q) => q.candidates.length > 0);
    fc.assert(
      fc.property(fc.constantFrom(...withCandidates), fc.nat(), (q, pick) => {
        const range = scaleRangeFor(displayUnitFor(q.figure.unit));
        const c = q.candidates[pick % q.candidates.length];
        expect(c).toMatch(new RegExp(`^[0-9]+\\.[0-9]{${SAMPLE_DECIMALS}}$`));
        const n = Number(c);
        expect(n).toBeGreaterThanOrEqual(range.min);
        expect(n).toBeLessThanOrEqual(range.max);
        expect(parseRecallNumber(c)).toEqual({
          kind: "value",
          value: c,
          format: "point",
        });
        expect(numberAnswerSchema.safeParse(c).success).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  for (const q of all) {
    describe(`${q.persona.key} ${q.metricId}`, () => {
      const then = shownThen(q.figure.value, q.figure.unit);
      const list = q.candidates;

      it("holds 3 to 5 distinct candidates", () => {
        expect(list.length).toBeGreaterThanOrEqual(SAMPLE_CANDIDATES_MIN);
        expect(list.length).toBeLessThanOrEqual(SAMPLE_CANDIDATES_MAX);
        expect(new Set(list).size).toBe(list.length);
      });

      it("meets the Spread_Rule against the sealed Then_Value", () => {
        const classes = new Set(list.map((c) => classifyCandidate(c, then)));
        expect(classes.has("near")).toBe(true);
        expect(classes.has("below")).toBe(true);
        expect(classes.has("above")).toBe(true);
      });

      it("holds no Record_Candidate: no candidate equals the sealed Then_Value", () => {
        const record = recordCandidate(q.figure);
        expect(list.filter((c) => c === record)).toHaveLength(0);
      });
    });
  }

  it("gives every persona metric a list through sampleCandidatesFor", () => {
    for (const persona of PERSONAS) {
      const byMetric = sampleCandidatesFor(persona.key);
      for (const metric of persona.metrics) {
        expect(byMetric[metric.metric_id]).toBeDefined();
      }
    }
    expect(sampleCandidatesFor("no-such-persona")).toEqual({});
  });
});

describe("parseSampleCandidates strictness (C5.1, C5.3)", () => {
  const personas: readonly Persona[] = PERSONAS;
  const valid = structuredClone(SAMPLE_CANDIDATES) as Record<
    string,
    Record<string, string[]>
  >;

  function withList(
    personaKey: string,
    metricId: string,
    list: unknown,
  ): Record<string, unknown> {
    const copy = structuredClone(valid) as Record<
      string,
      Record<string, unknown>
    >;
    copy[personaKey] = { ...copy[personaKey], [metricId]: list };
    return copy;
  }

  it("accepts the committed file", () => {
    expect(() => parseSampleCandidates(valid, personas)).not.toThrow();
  });

  it("fails when a persona metric has no list", () => {
    const copy = structuredClone(valid);
    delete copy["us-maya"]["us-diesel"];
    expect(() => parseSampleCandidates(copy, personas)).toThrow(/us-diesel/);
  });

  it("fails when a persona has no entry at all", () => {
    const copy = structuredClone(valid);
    delete copy["eu-tomas"];
    expect(() => parseSampleCandidates(copy, personas)).toThrow(/eu-tomas/);
  });

  it("fails when a list names a metric the persona does not track", () => {
    const copy = withList("us-maya", "eu-diesel", ["1.00", "1.01", "1.02"]);
    expect(() => parseSampleCandidates(copy, personas)).toThrow(
      /does not track/,
    );
  });

  it("fails for an unknown persona key", () => {
    const copy = { ...valid, "ghost-persona": valid["us-maya"] };
    expect(() => parseSampleCandidates(copy, personas)).toThrow(
      /unknown persona/,
    );
  });

  it("fails for fewer than 3 or more than 5 candidates", () => {
    const two = withList("us-maya", "us-diesel", ["3.89", "3.19"]);
    const six = withList("us-maya", "us-diesel", [
      "3.89",
      "3.79",
      "3.95",
      "3.19",
      "4.59",
      "4.00",
    ]);
    expect(() => parseSampleCandidates(two, personas)).toThrow();
    expect(() => parseSampleCandidates(six, personas)).toThrow();
  });

  it("fails for a duplicate candidate", () => {
    const dup = withList("us-maya", "us-diesel", [
      "3.89",
      "3.89",
      "3.19",
      "4.59",
    ]);
    expect(() => parseSampleCandidates(dup, personas)).toThrow();
  });

  it("fails for a candidate that is not written with exactly two decimals", () => {
    for (const bad of ["3.9", "3.890", "3", "3,89", "-3.89", " 3.89", "3.8x"]) {
      const copy = withList("us-maya", "us-diesel", [bad, "3.79", "3.95"]);
      expect(() => parseSampleCandidates(copy, personas)).toThrow();
    }
  });
});

// Property 16: no sample answer equals the Then_Value at display precision after
// the Display_Rescale (spec 10 design.md, "C5. Sample answers"; requirements
// C5.2, C5.11). The four Then_Values are the design's values for the four
// persona Figure_Questions.
describe("Property 16: no sample answer equals the Then_Value at display precision", () => {
  const DESIGN_THEN_VALUES = ["1.65", "1.79", "3.64", "3.89"];

  it("writes the four persona Then_Values at display precision as the design names them", () => {
    const shown = questions()
      .map((q) => recordCandidate(q.figure))
      .sort();
    expect(shown).toEqual(DESIGN_THEN_VALUES);
  });

  it("holds no candidate equal to its Then_Value in any of the four lists", () => {
    for (const q of questions()) {
      const then = recordCandidate(q.figure);
      expect(DESIGN_THEN_VALUES).toContain(then);
      expect(q.candidates).not.toContain(then);
    }
  });
});

describe("a typed value equal to the Then_Value is an ordinary answer", () => {
  for (const q of questions()) {
    it(`${q.persona.key} ${q.metricId}: the Then_Value parses as a plain value and is near`, () => {
      const then = recordCandidate(q.figure);
      const shownThenText = shownThen(q.figure.value, q.figure.unit);
      expect(parseRecallNumber(then)).toEqual({
        kind: "value",
        value: then,
        format: "point",
      });
      // Classified by the same Spread_Rule as any other typed number.
      expect(classifyCandidate(then, shownThenText)).toBe("near");
    });
  }
});
