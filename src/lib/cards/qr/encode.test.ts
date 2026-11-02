import { describe, expect, it } from "vitest";
import { encodeQr } from "./encode";
import { formatBits } from "./matrix";

const bit = (m: readonly (readonly boolean[])[], row: number, col: number): number => (m[row][col] ? 1 : 0);

/** Reads the 15 format bits from the copy around the top-left finder, in the order drawFormatBits writes them. */
function readFormatCopy(m: readonly (readonly boolean[])[]): number {
  const positions: [number, number][] = [];
  for (let i = 0; i <= 5; i++) positions.push([i, 8]);
  positions.push([7, 8], [8, 8], [8, 7]);
  for (let i = 9; i <= 14; i++) positions.push([8, 14 - i]);
  let value = 0;
  for (let i = 0; i <= 14; i++) {
    const [row, col] = positions[i];
    value |= bit(m, row, col) << i;
  }
  return value;
}

describe("encodeQr", () => {
  it("picks the smallest version that fits", () => {
    expect(encodeQr("hello").version).toBe(1);
    const long = "x".repeat(15);
    expect(encodeQr(long, "M").version).toBe(2);
  });

  it("returns a square matrix sized for its version", () => {
    const qr = encodeQr("https://revenant.devclef.se/l/abc");
    expect(qr.size).toBe(17 + 4 * qr.version);
    expect(qr.modules).toHaveLength(qr.size);
    expect(qr.modules.every((row) => row.length === qr.size)).toBe(true);
  });

  it("draws the three finder patterns", () => {
    const qr = encodeQr("finder check");
    const m = qr.modules;
    const n = qr.size;
    for (const [top, left] of [
      [0, 0],
      [0, n - 7],
      [n - 7, 0],
    ]) {
      expect(bit(m, top, left)).toBe(1);
      expect(bit(m, top + 6, left + 6)).toBe(1);
      expect(bit(m, top + 1, left + 1)).toBe(0);
      expect(bit(m, top + 3, left + 3)).toBe(1);
    }
  });

  it("writes the format information for the chosen level and mask", () => {
    const qr = encodeQr("format check", "M");
    expect(readFormatCopy(qr.modules)).toBe(formatBits("M", qr.mask));
  });

  it("throws RangeError when the text is too long for version 10", () => {
    expect(() => encodeQr("a".repeat(214), "M")).toThrow(RangeError);
    expect(() => encodeQr("a".repeat(214), "M")).toThrow(/213/);
  });

  it("accepts exactly the largest text at version 10", () => {
    expect(encodeQr("a".repeat(213), "M").version).toBe(10);
  });

  it("defaults to level M", () => {
    expect(encodeQr("default level").level).toBe("M");
  });
});
