import { describe, expect, it } from "vitest";
import { formatBits, versionBits } from "./matrix";

const bits = (value: number, width: number): string => value.toString(2).padStart(width, "0");

describe("formatBits", () => {
  it("gives the level M, mask 0 format information", () => {
    expect(bits(formatBits("M", 0), 15)).toBe("101010000010010");
  });

  it("gives the level L, mask 0 format information", () => {
    expect(bits(formatBits("L", 0), 15)).toBe("111011111000100");
  });

  it("rejects a mask outside 0 to 7", () => {
    expect(() => formatBits("M", 8)).toThrow(RangeError);
  });
});

describe("versionBits", () => {
  it("gives the version 7 information", () => {
    expect(bits(versionBits(7), 18)).toBe("000111110010010100");
  });

  it("rejects a version outside 1 to 10", () => {
    expect(() => versionBits(11)).toThrow(RangeError);
  });
});
