// Tests for formulaInput and the source-scan guard on the exact figure modules
// (spec 03-persona-demo, design.md).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { toDecimalString } from "./decimal";
import { formulaInput } from "./formula-input";

describe("formulaInput", () => {
  it("returns the stored value unchanged", () => {
    expect(formulaInput("3.412")).toEqual({ int: 3412n, scale: 3 });
    expect(toDecimalString(formulaInput("3.412"))).toBe("3.412");
  });

  it("keeps trailing zeros in the scale, so the published precision survives", () => {
    expect(formulaInput("3.100")).toEqual({ int: 3100n, scale: 3 });
  });

  it("keeps every digit of a long stored value", () => {
    expect(
      toDecimalString(formulaInput("12345678901234567890.123456789")),
    ).toBe("12345678901234567890.123456789");
  });

  it("rejects a value that is not a decimal string", () => {
    expect(() => formulaInput("3,412")).toThrow(RangeError);
    expect(() => formulaInput("")).toThrow(RangeError);
  });
});

describe("source scan", () => {
  // A conversion through the Number constructor or parseFloat would round or
  // lose digits, so the three new figure modules must never contain either.
  const files = ["decimal.ts", "published-precision.ts", "formula-input.ts"];
  const forbidden = [/Number\(/, /parseFloat/];

  for (const file of files) {
    it(`${file} contains no Number( or parseFloat`, () => {
      const source = readFileSync(
        fileURLToPath(new URL(`./${file}`, import.meta.url)),
        "utf8",
      );
      for (const pattern of forbidden) {
        expect(source).not.toMatch(pattern);
      }
    });
  }
});
