// Feature: 10 (spec 10 X1.1, X1.2, X1.3). Property 20: every tick touches the
// axis and reaches its label.

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { LINE_LABEL_TOP_REM, TICK_LABEL_GAP_PX } from "../constants";
import {
  LABEL_FONT_REM,
  STATIC_REM_PX,
  labelRowTopPx,
  tickLeaderPx,
} from "./tick-leader";

// The axis is a span at the top of the Number_Line, so its top edge is y = 0.
const AXIS_TOP_PX = 0;

const rowArb = fc.constantFrom(0, 1, 2);
const remArb = fc.integer({ min: 8, max: 32 });

describe("Property 20: every tick touches the axis and reaches its label", () => {
  it("starts on the axis top edge and ends TICK_LABEL_GAP_PX above its label row", () => {
    fc.assert(
      fc.property(rowArb, remArb, (row, remPx) => {
        const emPx = remPx * LABEL_FONT_REM;
        const top = AXIS_TOP_PX;
        const bottom = top + tickLeaderPx(row, remPx, emPx);
        expect(top).toBe(AXIS_TOP_PX);
        expect(labelRowTopPx(row, remPx, emPx) - bottom).toBeCloseTo(
          TICK_LABEL_GAP_PX,
          9,
        );
      }),
    );
  });

  it("gives every tick a positive height at every row and font size", () => {
    fc.assert(
      fc.property(rowArb, remArb, (row, remPx) => {
        expect(
          tickLeaderPx(row, remPx, remPx * LABEL_FONT_REM),
        ).toBeGreaterThan(0);
      }),
    );
  });

  it("makes each lower row's tick longer than the row above it", () => {
    fc.assert(
      fc.property(remArb, (remPx) => {
        const emPx = remPx * LABEL_FONT_REM;
        const heights = [0, 1, 2].map((row) => tickLeaderPx(row, remPx, emPx));
        expect(heights[1]).toBeGreaterThan(heights[0]);
        expect(heights[2]).toBeGreaterThan(heights[1]);
      }),
    );
  });
});

describe("tick heights at the static render (X1.2, 16 px root)", () => {
  const emPx = STATIC_REM_PX * LABEL_FONT_REM;

  it("reads the first row top from LINE_LABEL_TOP_REM at 16 px", () => {
    expect(labelRowTopPx(0, STATIC_REM_PX, emPx)).toBeCloseTo(
      LINE_LABEL_TOP_REM * STATIC_REM_PX,
      9,
    );
  });

  it("ends each static tick 4 px above its label row", () => {
    expect(tickLeaderPx(0, STATIC_REM_PX, emPx)).toBeCloseTo(16, 9);
    expect(tickLeaderPx(1, STATIC_REM_PX, emPx)).toBeCloseTo(49.28, 9);
    expect(tickLeaderPx(2, STATIC_REM_PX, emPx)).toBeCloseTo(82.56, 9);
  });
});
