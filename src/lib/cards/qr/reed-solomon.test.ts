import { describe, expect, it } from "vitest";
import { generatorExponents, generatorPoly, rsEncode } from "./reed-solomon";

describe("generatorPoly", () => {
  it("has the 10-EC generator exponents from ISO/IEC 18004", () => {
    expect(generatorExponents(10)).toEqual([0, 251, 67, 46, 61, 118, 70, 64, 94, 32, 45]);
  });

  it("is monic with degree n", () => {
    const g = generatorPoly(7);
    expect(g).toHaveLength(8);
    expect(g[0]).toBe(1);
  });

  it("rejects a count outside 1 to 255", () => {
    expect(() => generatorPoly(0)).toThrow(RangeError);
    expect(() => generatorPoly(256)).toThrow(RangeError);
  });
});

describe("rsEncode", () => {
  it("gives the HELLO WORLD 1-M error correction codewords", () => {
    const data = [32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17];
    expect(rsEncode(data, 10)).toEqual([196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
  });

  it("returns zeros for empty data", () => {
    expect(rsEncode([], 4)).toEqual([0, 0, 0, 0]);
  });

  it("rejects values that are not bytes", () => {
    expect(() => rsEncode([256], 2)).toThrow(RangeError);
  });
});
