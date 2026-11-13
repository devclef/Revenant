import { describe, expect, it } from "vitest";

import { narrowSections } from "../../tools/qa/layout-check.mjs";

/**
 * Unit tests for the H1.6 threshold in tools/qa/layout-check.mjs: every section's
 * content box on / must be at least 60% of the viewport width at 1440x900.
 */

const VIEWPORT = 1440;

describe("narrowSections (H1.6)", () => {
  it("passes a section wider than 60% of the viewport", () => {
    const sections = [{ name: "ritual-title", width: 1000 }];
    expect(narrowSections(sections, VIEWPORT)).toEqual([]);
  });

  it("passes a section exactly at 60% of the viewport", () => {
    const sections = [{ name: "exact", width: VIEWPORT * 0.6 }];
    expect(narrowSections(sections, VIEWPORT)).toEqual([]);
  });

  it("fails a section just under 60% of the viewport", () => {
    const sections = [{ name: "narrow", width: VIEWPORT * 0.6 - 0.5 }];
    expect(narrowSections(sections, VIEWPORT)).toEqual(sections);
  });

  it("returns only the narrow sections, in their original order", () => {
    const sections = [
      { name: "hero", width: 1200 },
      { name: "ritual-title", width: 500 },
      { name: "coven-title", width: 864 },
      { name: "no-seal-title", width: 100 },
    ];
    expect(
      narrowSections(sections, VIEWPORT).map((s: { name: string }) => s.name),
    ).toEqual(["ritual-title", "no-seal-title"]);
  });

  it("uses the viewport width it is given", () => {
    const sections = [{ name: "phone", width: 300 }];
    expect(narrowSections(sections, 390)).toEqual([]);
    expect(narrowSections(sections, 1440)).toEqual(sections);
  });

  it("returns an empty list when there are no sections", () => {
    expect(narrowSections([], VIEWPORT)).toEqual([]);
  });
});
