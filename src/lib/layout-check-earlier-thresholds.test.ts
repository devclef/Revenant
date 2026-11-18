import { describe, expect, it } from "vitest";

import {
  phTopbarMaxPx,
  write16Failures,
  write17Failures,
} from "../../tools/qa/layout-check.mjs";

/**
 * Spec 11 and spec 12 Write-step thresholds in tools/qa/layout-check.mjs, asserted by value.
 *
 * The W row (spec 13 W1.3, W4.4) and the retirements that came with spec 14 (W1.1, W1.2, W3.3,
 * W7.2 and PH4's persona limit) do not read any of these rows, so each one below is unchanged:
 *   - W1.6 (spec 12) at 1440x900: the Letter_Field top is in the window, the field shows
 *     10 lines in view (W16_LINES_DESKTOP), and every Occasion chip is in view. Unchanged.
 *   - W1.6 phone form (spec 12, checked by PH1 at 390x844 and 360x640): the field top and
 *     6 lines in view (W16_LINES_PHONE). Unchanged. The phone form is inside checkPhone and
 *     is not exported, so this file asserts only the desktop values.
 *   - W1.7 (spec 12) at 360x640: no sideways scroll on the document or the Write card.
 *     Unchanged.
 *
 * Spec 11 Write-step rows: none remain. The spec 11 L3 thresholds (every primary control,
 * Next included, in view at phone sizes) were replaced by W1.6 and W1.7 in spec 12, as
 * tools/qa/layout-check.mjs (around line 95) says. Nothing in src/ or tools/qa/ still
 * asserts L3, so this file asserts no spec 11 value.
 *
 * Retired tests: none. Nothing in this file replaces an earlier threshold.
 */

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

describe("spec 12 W1.6 desktop threshold (1440x900), unchanged by the W row", () => {
  it("passes at exactly 10 lines in view", () => {
    expect(write16Failures(writeReading())).toEqual([]);
  });

  it("fails at 9 lines in view, one below the 10-line minimum", () => {
    const failures = write16Failures(
      writeReading({ field: { ...writeReading().field, linesInView: 9 } }),
    );
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("need 10");
  });

  it("fails when the Letter_Field top is outside the window", () => {
    const failures = write16Failures(
      writeReading({ field: { ...writeReading().field, topInView: false, top: 900 } }),
    );
    expect(failures.some((f) => f.includes("Letter_Field top"))).toBe(true);
  });

  it("fails when the Occasion chips are not all inside the window", () => {
    const failures = write16Failures(
      writeReading({ chips: { count: 3, inView: false, top: 880, bottom: 920 } }),
    );
    expect(failures.some((f) => f.includes("Occasion chips"))).toBe(true);
  });
});

describe("spec 12 W1.7 no sideways scroll (360x640), unchanged by the W row", () => {
  it("passes when the document and the Write card do not scroll sideways", () => {
    expect(write17Failures(writeReading())).toEqual([]);
  });

  it("fails when the document scrolls sideways", () => {
    const failures = write17Failures(
      writeReading({ doc: { scrollWidth: 400, clientWidth: 360 } }),
    );
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("document scrollWidth");
  });

  it("fails when the Write card scrolls sideways", () => {
    const failures = write17Failures(
      writeReading({ card: { scrollWidth: 340, clientWidth: 328 } }),
    );
    expect(failures).toHaveLength(1);
    expect(failures[0]).toContain("Write card scrollWidth");
  });
});

describe("PH4 Top_Bar height limit (P5.1; persona page 96 px per B1.5)", () => {
  it("keeps 56 px on the landing, index and live pages", () => {
    expect(phTopbarMaxPx("landing")).toBe(56);
    expect(phTopbarMaxPx("index")).toBe(56);
    expect(phTopbarMaxPx("live")).toBe(56);
    expect(phTopbarMaxPx("other")).toBe(56);
  });

  it("allows 96 px on the persona page, where the notice and Skip sit in the bar", () => {
    expect(phTopbarMaxPx("persona")).toBe(96);
  });
});
