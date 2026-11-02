import { describe, expect, it } from "vitest";
import { alignmentCentres, blockLayout, byteCapacity, dataCodewords, symbolSize } from "./tables";

describe("tables", () => {
  it("has symbol sizes from 21 to 57 modules", () => {
    expect(symbolSize(1)).toBe(21);
    expect(symbolSize(10)).toBe(57);
  });

  it("gives the data codewords for level M and L", () => {
    expect(dataCodewords(1, "M")).toBe(16);
    expect(dataCodewords(5, "M")).toBe(86);
    expect(dataCodewords(10, "L")).toBe(274);
    expect(dataCodewords(10, "M")).toBe(216);
  });

  it("splits the 9-M data into 3 short and 2 long blocks", () => {
    expect(blockLayout(9, "M").dataLengths).toEqual([36, 36, 36, 37, 37]);
  });

  it("holds 14 bytes at version 1 and 213 bytes at version 10 at level M", () => {
    expect(byteCapacity(1, "M")).toBe(14);
    expect(byteCapacity(10, "M")).toBe(213);
  });

  it("lists alignment centres for version 7", () => {
    expect(alignmentCentres(7)).toEqual([6, 22, 38]);
    expect(alignmentCentres(1)).toEqual([]);
  });
});
