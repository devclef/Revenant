// Feature: spec 15 (11.2): the Recall_Scale range is the fixed range for the
// displayed unit in unit-ranges.ts. It never reads a sealed figure, a Now_Figure
// or a Sample_Answer (spec 15 Requirement 11.3).

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { scaleRangeFor, UNIT_RANGE_TABLE } from "./unit-ranges";

const pager = readFileSync(
  new URL("./RecallPager.tsx", import.meta.url),
  "utf8",
);
const scale = readFileSync(
  new URL("./RecallScale.tsx", import.meta.url),
  "utf8",
);

/** Every import specifier in a source file. */
function importsOf(source: string): string[] {
  return [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]);
}

describe("the Recall_Scale range (spec 15, 11.3)", () => {
  it("is passed only from the unit-keyed scaleRangeFor call", () => {
    const ranges = [...pager.matchAll(/range=\{([^}]*)\}/g)].map((m) =>
      m[1].trim(),
    );
    expect(ranges).toEqual(["scaleRangeFor(unit)"]);
  });

  it("is looked up by the displayed unit, not by any figure or answer", () => {
    expect(pager).toMatch(/scaleRangeFor\(unit\)/);
    expect(pager).not.toMatch(/scaleRangeFor\((?!unit\))/);
  });

  it("is a fixed literal per unit, the same for every call with that unit", () => {
    for (const unit of Object.keys(UNIT_RANGE_TABLE)) {
      expect(scaleRangeFor(unit)).toBe(scaleRangeFor(unit));
      expect(scaleRangeFor(unit)).toEqual(UNIT_RANGE_TABLE[unit]);
    }
  });

  it("does not import figure, Now-figure, sample or payload code into the scale", () => {
    const forbidden = [
      /figures/,
      /samples?/i,
      /persona/i,
      /payload/i,
      /OpenedPayload/,
      /now/i,
    ];
    for (const specifier of importsOf(scale)) {
      for (const pattern of forbidden) {
        expect(specifier, `${specifier} in RecallScale.tsx`).not.toMatch(
          pattern,
        );
      }
    }
  });

  it("is given no sample or figure prop by the pager", () => {
    const scaleOpen = pager.indexOf("<RecallScale");
    const scaleEnd = pager.indexOf("/>", scaleOpen);
    const props = pager.slice(scaleOpen, scaleEnd);
    expect(props).not.toMatch(/sample/i);
    expect(props).not.toMatch(/figure/i);
    expect(props).not.toMatch(/payload/i);
  });
});
