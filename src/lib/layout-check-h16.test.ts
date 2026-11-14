import { describe, expect, it } from "vitest";

import {
  narrowSections,
  write16Failures,
  write17Failures,
} from "../../tools/qa/layout-check.mjs";

/** A Write-step reading (WRITE_READ shape) with every W1.6 and W1.7 rule met. */
function writeReading(overrides: Record<string, unknown> = {}) {
  return {
    field: {
      top: 120,
      bottom: 500,
      topInView: true,
      lines: 20,
      linesInView: 10,
      lineHeight: 24,
    },
    chips: { count: 3, inView: true, top: 520, bottom: 560 },
    next: { top: 580, bottom: 620 },
    doc: { scrollWidth: 360, clientWidth: 360 },
    card: { scrollWidth: 328, clientWidth: 328 },
    ...overrides,
  };
}

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

describe("write16Failures (W1.6, 1440x900)", () => {
  it("passes when the field top, 10 lines and the chips are in view", () => {
    expect(write16Failures(writeReading())).toEqual([]);
  });

  it("passes with more than 10 lines in view", () => {
    expect(
      write16Failures(
        writeReading({ field: { ...writeReading().field, linesInView: 14 } }),
      ),
    ).toEqual([]);
  });

  it("fails when the field shows 9 lines in view", () => {
    const failures = write16Failures(
      writeReading({ field: { ...writeReading().field, linesInView: 9 } }),
    );
    expect(failures).toEqual(["Letter_Field shows 9 lines in view, need 10"]);
  });

  it("fails when the field top is outside the window", () => {
    const failures = write16Failures(
      writeReading({
        field: { ...writeReading().field, topInView: false, top: 900 },
      }),
    );
    expect(failures).toEqual(["Letter_Field top 900px is outside the window"]);
  });

  it("fails when an Occasion chip is below the window", () => {
    const failures = write16Failures(
      writeReading({
        chips: { count: 3, inView: false, top: 880, bottom: 920 },
      }),
    );
    expect(failures).toEqual([
      "Occasion chips 880px..920px are not all inside the window",
    ]);
  });

  it("names the missing chips when none are found", () => {
    const failures = write16Failures(
      writeReading({
        chips: { count: 0, inView: false, top: null, bottom: null },
      }),
    );
    expect(failures).toEqual(["Occasion chips not found"]);
  });

  it("does not assert Next's position (Next is a note only)", () => {
    expect(
      write16Failures(writeReading({ next: { top: 2000, bottom: 2040 } })),
    ).toEqual([]);
  });
});

describe("write17Failures (W1.7, 360x640)", () => {
  it("passes with no sideways scroll on the document or the Write card", () => {
    expect(write17Failures(writeReading())).toEqual([]);
  });

  it("fails when the document scrolls sideways", () => {
    const failures = write17Failures(
      writeReading({ doc: { scrollWidth: 372, clientWidth: 360 } }),
    );
    expect(failures).toEqual([
      "document scrollWidth 372px > clientWidth 360px",
    ]);
  });

  it("fails when the Write card scrolls sideways", () => {
    const failures = write17Failures(
      writeReading({ card: { scrollWidth: 340, clientWidth: 328 } }),
    );
    expect(failures).toEqual([
      "Write card scrollWidth 340px > clientWidth 328px",
    ]);
  });

  it("does not assert Next's bottom, even far below two window heights", () => {
    expect(
      write17Failures(writeReading({ next: { top: 1500, bottom: 1540 } })),
    ).toEqual([]);
  });
});
