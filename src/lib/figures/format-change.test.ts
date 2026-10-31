// Tests for display formatting of figures and the then-vs-now change
// (spec 03-persona-demo, design.md; R11.7–R11.9, R12.9).

import { describe, expect, it } from "vitest";

import type { FigureV1 } from "@/lib/seal-format";

import { computeChange, type ChangeResult } from "./change";
import { formatChange, formatPeriod, formatValue } from "./format-change";

const MINUS = "\u2212"; // U+2212 MINUS SIGN.

// A valid official figure with every provenance field present. Overrides let a
// test vary one field at a time while every other field stays comparable.
function official(overrides: Partial<FigureV1> = {}): FigureV1 {
  return {
    kind: "official",
    metric_id: "us-gasoline",
    value: "2.00",
    unit: "USD per gallon",
    region: "U.S. city average",
    period: "2024-09",
    source: "U.S. EIA",
    series_id: "EMM_EPMR_PTE_NUS_DPG",
    retrieved_at: "2026-10-30T14:02:11Z",
    source_url: "https://www.eia.gov/series",
    ...overrides,
  } as FigureV1;
}

// Compute a comparable change or fail the test loudly. Narrows the union so the
// caller gets the comparable branch directly.
function comparableChange(
  then: FigureV1,
  now: FigureV1,
): Extract<ChangeResult, { comparable: true }> {
  const result = computeChange(then, now);
  if (!result.comparable) {
    throw new Error(`expected a comparable change, got ${result.reason}`);
  }
  return result;
}

describe("formatChange", () => {
  it("renders a rise as +3.00 and +150.0% (gasoline 2.00 -> 5.00)", () => {
    const result = comparableChange(
      official({ value: "2.00", period: "2024-09" }),
      official({ value: "5.00", period: "2026-09" }),
    );

    const display = formatChange(result, "U.S.");

    expect(display.direction).toBe("rose");
    expect(display.difference).toBe("+3.00");
    expect(display.percent).toBe("+150.0%");
  });

  it("renders a fall with U+2212 as −3.00 and −33.3% (diesel 9.00 -> 6.00)", () => {
    const result = comparableChange(
      official({ value: "9.00", period: "2024-09" }),
      official({ value: "6.00", period: "2026-09" }),
    );

    const display = formatChange(result, "U.S.");

    expect(display.direction).toBe("fell");
    expect(display.difference).toBe(`${MINUS}3.00`);
    expect(display.percent).toBe(`${MINUS}33.3%`);
    // The sign is the real minus sign, never the hyphen-minus.
    expect(display.difference.charCodeAt(0)).toBe(0x2212);
    expect(display.difference.includes("-")).toBe(false);
    expect(display.percent?.charCodeAt(0)).toBe(0x2212);
  });

  it("renders an unchanged value with no sign and direction 'unchanged'", () => {
    const result = comparableChange(
      official({ value: "3.00", period: "2024-09" }),
      official({ value: "3.00", period: "2026-09" }),
    );

    const display = formatChange(result, "U.S.");

    expect(display.direction).toBe("unchanged");
    // No leading sign on an unchanged difference.
    expect(display.difference).toBe("0.00");
    expect(display.difference.startsWith("+")).toBe(false);
    expect(display.difference.includes(MINUS)).toBe(false);
    expect(display.difference.includes("-")).toBe(false);
    // Percent is exactly zero to one digit, with no sign.
    expect(display.percent).toBe("0.0%");
  });

  it("gives the difference the larger fraction-digit count of the two inputs", () => {
    // then has 1 fractional digit, now has 3: the larger is 3.
    const result = comparableChange(
      official({ value: "2.5", period: "2024-09" }),
      official({ value: "5.125", period: "2026-09" }),
    );

    const display = formatChange(result, "U.S.");

    // 5.125 - 2.5 = 2.625, shown to 3 fraction digits.
    expect(display.difference).toBe("+2.625");
  });

  it("always shows the percent with exactly one fraction digit", () => {
    // 1.00 -> 2.00 is +100%, still rendered to one fraction digit.
    const result = comparableChange(
      official({ value: "1.00", period: "2024-09" }),
      official({ value: "2.00", period: "2026-09" }),
    );

    const display = formatChange(result, "U.S.");

    expect(display.percent).toBe("+100.0%");
  });

  it("formats a null percent (then value zero) as null", () => {
    const result = comparableChange(
      official({ value: "0", period: "2024-09" }),
      official({ value: "5.00", period: "2026-09" }),
    );

    const display = formatChange(result, "U.S.");

    expect(result.percent).toBeNull();
    expect(display.percent).toBeNull();
    // A zero "then" has no fractional digits; now has two, so the larger is two.
    expect(display.difference).toBe("+5.00");
  });

  it("uses only rose/fell/unchanged/to and month names in the rendered text", () => {
    // Build the human sentence the copy layer would assemble from the parts
    // this module produces, and assert it contains no forbidden vocabulary
    // (no interpretation words, no 'and', etc.) — only the allowed joiners.
    const rose = formatChange(
      comparableChange(
        official({ value: "2.00", period: "2024-09" }),
        official({ value: "5.00", period: "2026-09" }),
      ),
      "U.S.",
    );

    const text = `${rose.difference} rose from ${rose.thenPeriod} to ${rose.nowPeriod}`;
    // Direction word and the only connector words allowed in the sentence.
    expect(["rose", "fell", "unchanged"]).toContain(rose.direction);
    // Period text is month names and digits only — no interpretation words.
    expect(rose.thenPeriod).toBe("September 2024");
    expect(rose.nowPeriod).toBe("September 2026");
    // No judgement words leaked into any rendered part.
    for (const word of ["soared", "plunged", "surged", "crashed", "good", "bad"]) {
      expect(text.toLowerCase()).not.toContain(word);
    }
  });
});

describe("formatValue", () => {
  it("renders a decimal string at its own precision when no digits are forced", () => {
    expect(formatValue("3.412", "U.S.")).toBe("3.412");
  });

  it("pads and rounds half away from zero to the requested fraction digits", () => {
    expect(formatValue("3", "U.S.", 2)).toBe("3.00");
    expect(formatValue("33.333333333333333333", "U.S.", 1)).toBe("33.3");
    expect(formatValue("2.5", "U.S.", 0)).toBe("3");
  });

  // The three regions the product supports (product.md). Each test asserts the
  // locale-formatted zero for that region rather than a hardcoded "0"/"0.00",
  // so a future locale change can't make these pass against the wrong text.
  const REGIONS = ["U.S.", "EU", "Sweden"] as const;

  describe.each(REGIONS)("in %s", (region) => {
    // A value that rounds to zero at the requested digits displays with no
    // sign — the three ticket cases (issue #66), proven against the locale's
    // own formatting of a true zero at the same digits.
    it("drops the sign when -0.4 rounds to zero at 0 digits", () => {
      const zero = formatValue("0", region, 0);
      expect(formatValue("-0.4", region, 0)).toBe(zero);
      expect(formatValue("-0.4", region, 0)).not.toContain("-");
      expect(formatValue("-0.4", region, 0)).not.toContain(MINUS);
    });

    it("drops the sign when -0.001 rounds to zero at 0 digits", () => {
      const zero = formatValue("0", region, 0);
      expect(formatValue("-0.001", region, 0)).toBe(zero);
      expect(formatValue("-0.001", region, 0)).not.toContain("-");
      expect(formatValue("-0.001", region, 0)).not.toContain(MINUS);
    });

    it("drops the sign when -0.0004 rounds to zero at 2 digits", () => {
      const zero = formatValue("0", region, 2);
      expect(formatValue("-0.0004", region, 2)).toBe(zero);
      expect(formatValue("-0.0004", region, 2)).not.toContain("-");
      expect(formatValue("-0.0004", region, 2)).not.toContain(MINUS);
    });

    // A non-zero negative still carries its minus sign, so the fix only
    // touches values that genuinely round to zero.
    it("keeps the minus sign on a non-zero negative at 0 digits", () => {
      const result = formatValue("-0.6", region, 0);
      // -0.6 rounds half away from zero to -1, which is not zero.
      expect(result).not.toBe(formatValue("0", region, 0));
      expect(result).toContain("-");
      expect(result.startsWith("-")).toBe(true);
    });

    it("keeps the minus sign on a non-zero negative at 2 digits", () => {
      const result = formatValue("-3.41", region, 2);
      expect(result).not.toBe(formatValue("0", region, 2));
      expect(result).toContain("-");
      expect(result.startsWith("-")).toBe(true);
    });
  });
});

describe("formatPeriod", () => {
  it("renders a YYYY-MM period as month and year under UTC", () => {
    expect(formatPeriod("2024-09", "U.S.")).toBe("September 2024");
    expect(formatPeriod("2022-09", "Sweden")).toBe("September 2022");
  });

  it("renders a YYYY-MM-DD period as a full date under UTC", () => {
    expect(formatPeriod("2024-10-26", "U.S.")).toBe("October 26, 2024");
  });

  it("returns an unrecognised period string verbatim", () => {
    // Anything that is not YYYY-MM or YYYY-MM-DD shaped is returned as stored.
    expect(formatPeriod("sometime in the autumn", "U.S.")).toBe(
      "sometime in the autumn",
    );
    expect(formatPeriod("2024", "U.S.")).toBe("2024");
    expect(formatPeriod("Q3 2024", "U.S.")).toBe("Q3 2024");
    expect(formatPeriod("2024-09-01T00:00:00Z", "U.S.")).toBe(
      "2024-09-01T00:00:00Z",
    );
  });
});
