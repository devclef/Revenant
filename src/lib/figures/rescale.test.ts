// Tests for display-only decimal-point rescale (spec 03-persona-demo, design.md).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import { displayRescaleForUnit, rescaleForDisplay } from "./rescale";

describe("rescaleForDisplay", () => {
  it("shifts the decimal point left by the power of ten", () => {
    expect(rescaleForDisplay("1234", 1000)).toBe("1.234");
    expect(rescaleForDisplay("3412", 1000)).toBe("3.412");
    expect(rescaleForDisplay("50", 100)).toBe("0.5");
  });

  it("rescales by every allowed power of ten (10..1_000_000)", () => {
    expect(rescaleForDisplay("25", 10)).toBe("2.5");
    expect(rescaleForDisplay("1234567", 1000000)).toBe("1.234567");
  });

  it("is exact for a value that already carries a long fraction", () => {
    // A long fraction is preserved digit-for-digit: no rounding, no float error.
    expect(rescaleForDisplay("12345678901234567890", 1000)).toBe(
      "12345678901234567.89",
    );
    expect(rescaleForDisplay("1.23456789", 100)).toBe("0.0123456789");
  });

  it("canonicalises the result (trims trailing fractional zeros, no -0)", () => {
    // 1000 / 1000 = 1 exactly; scale shift gives "1.000" -> canonical "1".
    expect(rescaleForDisplay("1000", 1000)).toBe("1");
    // 0 stays 0 and never becomes -0.
    expect(rescaleForDisplay("0", 1000)).toBe("0");
    expect(rescaleForDisplay("-0", 100)).toBe("0");
    // A negative value keeps its sign.
    expect(rescaleForDisplay("-3412", 1000)).toBe("-3.412");
  });

  it("throws RangeError when the divisor is not an exact power of ten", () => {
    for (const bad of [1, 2, 5, 3, 250, 1024, 1500, 10000000]) {
      expect(() => rescaleForDisplay("1234", bad)).toThrow(RangeError);
    }
  });

  it("throws RangeError when the divisor is not an integer power of ten", () => {
    for (const bad of [10.5, 100.1, NaN, Infinity]) {
      expect(() => rescaleForDisplay("1234", bad)).toThrow(RangeError);
    }
  });

  it("throws RangeError when the value is not a canonical decimal string", () => {
    expect(() => rescaleForDisplay("", 1000)).toThrow(RangeError);
    expect(() => rescaleForDisplay("abc", 1000)).toThrow(RangeError);
    expect(() => rescaleForDisplay("1e3", 1000)).toThrow(RangeError);
  });
});

// Property 8: the display rescale is exact and keyed on the sealed unit.
describe("displayRescaleForUnit (Property 8)", () => {
  it("returns the EUR per litre display for exactly \"EUR per 1,000 litres\"", () => {
    const display = displayRescaleForUnit("EUR per 1,000 litres");
    expect(display).not.toBeNull();
    expect(display).toEqual({
      displayUnit: "EUR per litre",
      divisor: 1000,
      note: "Published per 1,000 litres, shown per litre.",
    });
  });

  it("returns null for near-miss and unrelated units", () => {
    const nearMisses = [
      "eur per 1,000 litres", // case
      "EUR PER 1,000 LITRES", // case
      "EUR per 1000 litres", // missing thousands separator
      "EUR per 1 000 litres", // space as separator
      "EUR per 1,000 liters", // spelling
      "EUR per 1,000 litres ", // trailing space
      " EUR per 1,000 litres", // leading space
      "EUR per 1,000\u00a0litres", // non-breaking space
      "EUR per 1,000 litre", // singular
      "EUR per litre", // already per litre
      "USD per gallon",
      "EUR per kilogram",
      "",
    ];
    for (const unit of nearMisses) {
      expect(displayRescaleForUnit(unit), JSON.stringify(unit)).toBeNull();
    }
  });

  it("does not match inherited object properties", () => {
    for (const unit of ["constructor", "toString", "__proto__", "hasOwnProperty"]) {
      expect(displayRescaleForUnit(unit), unit).toBeNull();
    }
  });

  it("returns a fresh object, so a caller cannot change the next lookup", () => {
    const first = displayRescaleForUnit("EUR per 1,000 litres");
    if (first === null) {
      throw new Error("expected a display rescale for EUR per 1,000 litres");
    }
    first.divisor = 1;
    first.displayUnit = "changed";
    expect(displayRescaleForUnit("EUR per 1,000 litres")).toEqual({
      displayUnit: "EUR per litre",
      divisor: 1000,
      note: "Published per 1,000 litres, shown per litre.",
    });
  });

  it("converts values exactly with the rescale divisor, with no floating-point drift", () => {
    const divisor = displayRescaleForUnit("EUR per 1,000 litres")?.divisor;
    expect(divisor).toBe(1000);
    if (divisor === undefined) {
      throw new Error("missing divisor");
    }
    // Classic float traps: 0.1 + 0.2 style values must stay exact.
    expect(rescaleForDisplay("1856.7", divisor)).toBe("1.8567");
    expect(rescaleForDisplay("1700.3", divisor)).toBe("1.7003");
    expect(rescaleForDisplay("3412", divisor)).toBe("3.412");
    expect(rescaleForDisplay("1", divisor)).toBe("0.001");
    expect(rescaleForDisplay("1000000000000000000001", divisor)).toBe(
      "1000000000000000000.001",
    );
  });

  it("does not read the Catalogue when resolving a unit", async () => {
    // Replace the Catalogue with a module that fails if anything touches it.
    vi.resetModules();
    vi.doMock("./catalogue", () => {
      throw new Error("rescale must not read the Catalogue");
    });
    const isolated = await import("./rescale");
    expect(isolated.displayRescaleForUnit("EUR per 1,000 litres")).not.toBeNull();
    expect(isolated.displayRescaleForUnit("USD per gallon")).toBeNull();
    vi.doUnmock("./catalogue");
  });

  it("does not import the Catalogue at all (source check)", () => {
    const source = readFileSync(fileURLToPath(new URL("./rescale.ts", import.meta.url)), "utf8");
    expect(source).not.toMatch(/from\s+["']\.\/catalogue["']/);
    expect(source).not.toMatch(/from\s+["']\.\/load["']/);
  });

  it("leaves the stored value string unchanged", () => {
    const stored = "3412";
    const shown = rescaleForDisplay(stored, 1000);
    expect(shown).toBe("3.412");
    // Strings are immutable and the display value is a new string.
    expect(stored).toBe("3412");
    expect(rescaleForDisplay(stored, 1000)).toBe("3.412");
  });
});
