import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { buildRecallRecord, type Draft } from "@/lib/recall/record";
import {
  SCALE_MAX_VALUE,
  SCALE_MIN_VALUE,
  edgeValue,
  fineStepSize,
  positionInWindow,
  positionOf,
  snapToStep,
  stepDecade,
  stepFine,
  toPlainDecimal,
  valueAt,
  valueInWindow,
  zoomWindow,
} from "./scale-math";

// Feature: 05-reveal-ceremony, Task 8 (Recall_Scale, pure math).
//
// Example tests pin the worked cases from design.md. Property tests cover the
// round-trips, the value bounds and the record acceptance, each with at least
// 100 generated runs.

const NUM_RUNS = 100;
const NUMBER_PATTERN = /^[0-9]+(\.[0-9]+)?$/;

/**
 * The question type the record builder takes. Derived from its signature so
 * this file never names the generate module (the reveal import boundary).
 */
type RecallQuestion = Parameters<typeof buildRecallRecord>[0][number];

/** A number question with the given id, as the record builder expects. */
function question(id: string): RecallQuestion {
  return {
    id,
    answer_type: "number",
    metric_id: `metric-${id}`,
    text: `What do you think thing ${id} cost then?`,
  };
}

/** Build a record from one scale string and assert it is accepted. */
function recordFor(text: string) {
  const drafts: Record<string, Draft> = {
    q1: { text, noAnswer: false },
  };
  return buildRecallRecord([question("q1")], drafts);
}

// --- Example tests ----------------------------------------------------------

describe("toPlainDecimal — examples from design.md", () => {
  it("rounds 3.4719 to '3.47'", () => {
    expect(toPlainDecimal(3.4719)).toBe("3.47");
  });

  it("rounds 1712.4 to '1710' with no exponent", () => {
    expect(toPlainDecimal(1712.4)).toBe("1710");
  });

  it("rounds 0.012345 to '0.0123'", () => {
    expect(toPlainDecimal(0.012345)).toBe("0.0123");
  });

  it("writes the track ends as plain numbers", () => {
    expect(toPlainDecimal(SCALE_MIN_VALUE)).toBe("0.01");
    expect(toPlainDecimal(SCALE_MAX_VALUE)).toBe("100000");
  });

  it("writes 0 as '0'", () => {
    expect(toPlainDecimal(0)).toBe("0");
  });

  it("drops a trailing fractional zero that rounding leaves behind", () => {
    expect(toPlainDecimal(9.996)).toBe("10");
    expect(toPlainDecimal(2)).toBe("2");
  });

  it("throws for values outside the track range", () => {
    expect(() => toPlainDecimal(-1)).toThrow(RangeError);
    expect(() => toPlainDecimal(100001)).toThrow(RangeError);
    expect(() => toPlainDecimal(Number.NaN)).toThrow(RangeError);
  });
});

describe("track mapping — examples", () => {
  it("maps the ends of the track to 0.01 and 100,000", () => {
    expect(valueAt(0)).toBe(0.01);
    expect(valueAt(1)).toBe(100000);
    expect(positionOf(0.01)).toBe(0);
    expect(positionOf(100000)).toBe(1);
  });

  it("clamps positions outside [0, 1]", () => {
    expect(valueAt(-5)).toBe(0.01);
    expect(valueAt(5)).toBe(100000);
  });

  it("puts each decade mark at the expected fraction of the track", () => {
    expect(positionOf(1)).toBeCloseTo(2 / 7, 10);
    expect(positionOf(10)).toBeCloseTo(3 / 7, 10);
    expect(positionOf(1000)).toBeCloseTo(5 / 7, 10);
  });

  it("clamps typed values below 0.01 and above 100,000 to the ends", () => {
    expect(positionOf(0)).toBe(0);
    expect(positionOf(0.001)).toBe(0);
    expect(positionOf(1e9)).toBe(1);
  });
});

describe("fine and decade steps — examples", () => {
  it("steps 3.47 down to 3.46 and up to 3.48", () => {
    expect(toPlainDecimal(stepFine(3.47, -1))).toBe("3.46");
    expect(toPlainDecimal(stepFine(3.47, 1))).toBe("3.48");
  });

  it("steps 1,710 down to 1,700", () => {
    expect(toPlainDecimal(stepFine(1710, -1))).toBe("1700");
  });

  it("uses 10^(k-2) as the fine step for a value in decade k", () => {
    expect(fineStepSize(3.47)).toBeCloseTo(0.01, 12);
    expect(fineStepSize(1710)).toBeCloseTo(10, 12);
  });

  it("moves one decade with Page Up and Page Down", () => {
    expect(toPlainDecimal(stepDecade(1000, 1))).toBe("10000");
    expect(toPlainDecimal(stepDecade(1000, -1))).toBe("100");
  });

  it("sends Home and End to the track ends", () => {
    expect(edgeValue("start")).toBe(0.01);
    expect(edgeValue("end")).toBe(100000);
  });

  it("stays on the track at the ends", () => {
    expect(stepFine(0.01, -1)).toBe(0.01);
    expect(stepFine(100000, 1)).toBe(100000);
    expect(stepDecade(100000, 1)).toBe(100000);
  });
});

describe("zoom windows — examples", () => {
  it("level 0 is the whole log track", () => {
    expect(zoomWindow(0, 3.47)).toEqual({
      level: 0,
      min: 0.01,
      max: 100000,
      scale: "log",
      step: null,
    });
  });

  it("level 1 is the decade under the marker, with a 10^(k-1) step", () => {
    expect(zoomWindow(1, 3.47)).toEqual({
      level: 1,
      min: 1,
      max: 10,
      scale: "linear",
      step: 0.1,
    });
  });

  it("level 2 is the tenth of that decade under the marker", () => {
    expect(zoomWindow(2, 3.47)).toEqual({
      level: 2,
      min: 3,
      max: 4,
      scale: "linear",
      step: 0.1,
    });
  });

  it("keeps the top decade on the track", () => {
    expect(zoomWindow(1, 100000)).toMatchObject({ min: 10000, max: 100000 });
    expect(zoomWindow(2, 100000)).toMatchObject({ min: 90000, max: 100000 });
  });

  it("keeps the bottom decade on the track", () => {
    expect(zoomWindow(2, 0.01)).toMatchObject({ min: 0.01, max: 0.02 });
  });

  it("snaps a drag onto the level 2 step", () => {
    const window = zoomWindow(2, 3.47);
    expect(toPlainDecimal(snapToStep(3.47, window))).toBe("3.5");
  });
});

// --- Property tests ---------------------------------------------------------

/** A value anywhere on the track, including the ends. */
const trackValue = fc.double({
  min: SCALE_MIN_VALUE,
  max: SCALE_MAX_VALUE,
  noNaN: true,
});

/** A track position in [0, 1]. */
const trackPosition = fc.double({ min: 0, max: 1, noNaN: true });

describe("Recall_Scale math — properties", () => {
  it("every track value writes a plain decimal within 40 characters", () => {
    fc.assert(
      fc.property(trackValue, (value) => {
        const text = toPlainDecimal(value);
        expect(text).toMatch(NUMBER_PATTERN);
        expect(text.length).toBeLessThanOrEqual(40);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("every track position maps to a value on the track", () => {
    fc.assert(
      fc.property(trackPosition, (x) => {
        const value = valueAt(x);
        expect(value).toBeGreaterThanOrEqual(SCALE_MIN_VALUE);
        expect(value).toBeLessThanOrEqual(SCALE_MAX_VALUE);
        expect(toPlainDecimal(value)).toMatch(NUMBER_PATTERN);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("valueAt and positionOf round-trip within the 3-sig-fig rounding", () => {
    fc.assert(
      fc.property(trackPosition, (x) => {
        const back = positionOf(valueAt(x));
        // 3 sig figs is at most 0.5% in value, or about 0.0002 of the track.
        expect(Math.abs(back - x)).toBeLessThan(0.0005);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("the decimal string parses back to the value it was written from", () => {
    fc.assert(
      fc.property(trackValue, (value) => {
        const text = toPlainDecimal(value);
        const parsed = Number(text);
        // Written at 3 sig figs, so the parsed value is within 0.5% of input.
        expect(Math.abs(parsed - value) / value).toBeLessThanOrEqual(0.005);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("positionOf is monotonic in the value", () => {
    fc.assert(
      fc.property(trackValue, trackValue, (a, b) => {
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        expect(positionOf(lo)).toBeLessThanOrEqual(positionOf(hi));
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("a fine step keeps the value on the track and in plain form", () => {
    fc.assert(
      fc.property(
        trackValue,
        fc.constantFrom(1 as const, -1 as const),
        (value, direction) => {
          const next = stepFine(value, direction);
          expect(next).toBeGreaterThanOrEqual(SCALE_MIN_VALUE);
          expect(next).toBeLessThanOrEqual(SCALE_MAX_VALUE);
          expect(toPlainDecimal(next)).toMatch(NUMBER_PATTERN);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("every zoom window stays on the track and keeps the marker inside it", () => {
    fc.assert(
      fc.property(
        trackValue,
        fc.constantFrom(0 as const, 1 as const, 2 as const),
        (value, level) => {
          const window = zoomWindow(level, value);
          expect(window.min).toBeGreaterThanOrEqual(SCALE_MIN_VALUE);
          expect(window.max).toBeLessThanOrEqual(SCALE_MAX_VALUE);
          expect(window.min).toBeLessThan(window.max);
          if (level > 0) {
            // The marker sits inside its linear window, so the step count is 10 or 90.
            expect(value).toBeGreaterThanOrEqual(window.min * (1 - 1e-9));
            expect(value).toBeLessThanOrEqual(window.max * (1 + 1e-9));
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it("a value in a linear window writes a plain decimal and stays in the window", () => {
    fc.assert(
      fc.property(trackPosition, fc.constantFrom(1 as const, 2 as const), (x, level) => {
        const window = zoomWindow(level, 3.47);
        const value = valueInWindow(x, window);
        expect(value).toBeGreaterThanOrEqual(window.min);
        expect(value).toBeLessThanOrEqual(window.max);
        expect(toPlainDecimal(value)).toMatch(NUMBER_PATTERN);
        const back = positionInWindow(value, window);
        expect(Math.abs(back - x)).toBeLessThan(0.01);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("every scale-written value is accepted by buildRecallRecord, unchanged", () => {
    fc.assert(
      fc.property(trackPosition, (x) => {
        const text = toPlainDecimal(valueAt(x));
        const result = recordFor(text);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.record.answers).toEqual([
            { question_id: "q1", kind: "number", value: text },
          ]);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it("every stepped value is accepted by buildRecallRecord", () => {
    fc.assert(
      fc.property(
        trackValue,
        fc.constantFrom(1 as const, -1 as const),
        (value, direction) => {
          const text = toPlainDecimal(stepFine(value, direction));
          expect(recordFor(text).ok).toBe(true);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
