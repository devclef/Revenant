import { describe, expect, it } from "vitest";

import { formatLocalDateTime, formatRemaining } from "./format";

describe("formatRemaining", () => {
  it("writes whole seconds, minutes and hours in plain words", () => {
    expect(formatRemaining(0)).toBe("0 seconds");
    expect(formatRemaining(1)).toBe("1 second");
    expect(formatRemaining(30)).toBe("30 seconds");
    expect(formatRemaining(60)).toBe("1 minute");
    expect(formatRemaining(65)).toBe("1 minute 5 seconds");
    expect(formatRemaining(3600)).toBe("1 hour");
    expect(formatRemaining(3661)).toBe("1 hour 1 minute 1 second");
  });

  it("drops fractions and reads negative or non-finite values as zero", () => {
    expect(formatRemaining(29.9)).toBe("29 seconds");
    expect(formatRemaining(-5)).toBe("0 seconds");
    expect(formatRemaining(Number.NaN)).toBe("0 seconds");
  });
});

describe("formatLocalDateTime", () => {
  it("formats a UTC ISO time with its year and month", () => {
    const text = formatLocalDateTime("2026-10-30T12:00:00.000Z");
    expect(text).toContain("2026");
    expect(text).toContain("October");
  });

  it("returns an empty string for input that is not a date", () => {
    expect(formatLocalDateTime("not a date")).toBe("");
  });
});
