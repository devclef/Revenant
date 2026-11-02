// Test-only helpers that read a QR matrix back the way a scanner would.
// Imported only by *.test.ts files. It is not exported
// from src/lib/cards/index.ts.
//
// The reader checks the symbol independently of the encoder: format
// information is decoded from the matrix and checked against the BCH
// remainder, and codewords are read along the zigzag path and unmasked here.
// Function-pattern positions come from the encoder's own layout.

import { expect } from "vitest";
import type { QrMatrix } from "./encode";
import { EXP, gfMul } from "./gf256";
import { maskBit } from "./mask";
import { createGrid, drawFormatBits, drawFunctionPatterns } from "./matrix";
import { alignmentCentres, blockLayout, charCountBits, dataCodewords, type QrLevel } from "./tables";

export type Modules = readonly (readonly boolean[])[];

const FORMAT_GENERATOR = 0x537;
const FORMAT_MASK = 0x5412;
const LEVEL_FROM_INDICATOR: Readonly<Record<number, QrLevel>> = { 0b01: "L", 0b00: "M" };

/** Reads the 15 format bits from the copy beside the top-left finder. */
function readFormatCopy(modules: Modules): number {
  const positions: [number, number][] = [];
  for (let i = 0; i <= 5; i++) positions.push([i, 8]);
  positions.push([7, 8], [8, 8], [8, 7]);
  for (let i = 9; i <= 14; i++) positions.push([8, 14 - i]);
  return positions.reduce((value, [row, col], i) => value | ((modules[row][col] ? 1 : 0) << i), 0);
}

/** Reads the second format copy, split between the top-right and bottom-left finders. */
function readFormatSplitCopy(modules: Modules): number {
  const size = modules.length;
  const positions: [number, number][] = [];
  for (let i = 0; i <= 7; i++) positions.push([8, size - 1 - i]);
  for (let i = 8; i <= 14; i++) positions.push([size - 15 + i, 8]);
  return positions.reduce((value, [row, col], i) => value | ((modules[row][col] ? 1 : 0) << i), 0);
}

/**
 * Decodes the level and mask from the format information. Both copies must
 * agree, the BCH remainder must be zero, and the level indicator must be L or M.
 */
export function readFormatInfo(modules: Modules): { level: QrLevel; mask: number } {
  const first = readFormatCopy(modules);
  const second = readFormatSplitCopy(modules);
  if (first !== second) throw new Error("format information copies differ");

  const value = first ^ FORMAT_MASK;
  let rem = value;
  for (let bit = 14; bit >= 10; bit--) {
    if ((rem >>> bit) & 1) rem ^= FORMAT_GENERATOR << (bit - 10);
  }
  if (rem !== 0) throw new Error("format information has a bad BCH remainder");

  const data = value >>> 10;
  const level = LEVEL_FROM_INDICATOR[data >>> 3];
  if (level === undefined) throw new Error("format information has an unknown level");
  return { level, mask: data & 0b111 };
}

/** Version from the side length, which must be 17 + 4 * version. */
export function versionFromSize(size: number): number {
  const version = (size - 17) / 4;
  if (!Number.isInteger(version) || version < 1) throw new Error("side length is not 17 + 4 * version");
  return version;
}

/**
 * Reads every codeword along the zigzag path, unmasking data modules first.
 * Returns the codewords in stream order (data and error correction together).
 */
export function extractCodewords(modules: Modules, mask: number): number[] {
  const version = versionFromSize(modules.length);
  const { level } = readFormatInfo(modules);
  const size = modules.length;
  const reserved = createGrid(version);
  drawFunctionPatterns(reserved, version);
  drawFormatBits(reserved, level, mask);
  const isReserved = (row: number, col: number): boolean => reserved.reserved[row][col];

  const total = totalCodewords(version, level);
  const bits: number[] = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const col = right - j;
        const upward = ((right + 1) & 2) === 0;
        const row = upward ? size - 1 - vert : vert;
        if (isReserved(row, col) || bits.length >= total * 8) continue;
        const flip = maskBit(mask, row, col);
        bits.push((modules[row][col] !== flip ? 1 : 0));
      }
    }
  }

  const codewords: number[] = [];
  for (let i = 0; i < total; i++) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i * 8 + j];
    codewords.push(byte);
  }
  return codewords;
}

/** Codewords (data plus error correction) in one symbol, from the block layout. */
export function totalCodewords(version: number, level: QrLevel): number {
  const { dataLengths, ecPerBlock } = blockLayout(version, level);
  return dataLengths.reduce((sum, n) => sum + n, 0) + dataLengths.length * ecPerBlock;
}

/** Splits interleaved stream codewords back into data and error correction blocks. */
export function deinterleave(
  codewords: readonly number[],
  version: number,
  level: QrLevel,
): { dataBlocks: number[][]; ecBlocks: number[][]; ecPerBlock: number } {
  const { dataLengths, ecPerBlock } = blockLayout(version, level);
  const dataBlocks: number[][] = dataLengths.map(() => []);
  const ecBlocks: number[][] = dataLengths.map(() => []);
  let index = 0;
  const longest = Math.max(...dataLengths);
  for (let i = 0; i < longest; i++) {
    dataLengths.forEach((length, b) => {
      if (i < length) dataBlocks[b].push(codewords[index++]);
    });
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (let b = 0; b < dataLengths.length; b++) ecBlocks[b].push(codewords[index++]);
  }
  return { dataBlocks, ecBlocks, ecPerBlock };
}

/** True when the block polynomial vanishes at alpha^0 .. alpha^(ecCount - 1). */
export function hasZeroSyndromes(block: readonly number[], ecCount: number): boolean {
  for (let i = 0; i < ecCount; i++) {
    let s = 0;
    for (const c of block) s = gfMul(s, EXP[i]) ^ c;
    if (s !== 0) return false;
  }
  return true;
}

/** Reads byte mode data codewords and returns the text. Throws on any other mode or a bad length. */
export function parseByteMode(data: readonly number[], version: number, level: QrLevel): string {
  const capacityBits = dataCodewords(version, level) * 8;
  const bits: number[] = [];
  for (const byte of data) for (let i = 7; i >= 0; i--) bits.push((byte >>> i) & 1);
  const read = (start: number, width: number): number => {
    let value = 0;
    for (let i = 0; i < width; i++) value = (value << 1) | bits[start + i];
    return value;
  };
  if (read(0, 4) !== 0b0100) throw new Error("mode indicator is not byte mode");
  const count = read(4, charCountBits(version));
  const dataStart = 4 + charCountBits(version);
  if (dataStart + count * 8 > capacityBits) throw new Error("character count overruns the data");
  const bytes = new Uint8Array(count);
  for (let i = 0; i < count; i++) bytes[i] = read(dataStart + i * 8, 8);
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

/**
 * Checks the function patterns of a symbol: three finders with separators,
 * timing patterns, alignment patterns and the dark module.
 */
export function assertFunctionPatterns(modules: Modules, version: number): void {
  const n = modules.length;
  expect(n).toBe(17 + 4 * version);

  for (const [r0, c0] of [
    [0, 0],
    [0, n - 7],
    [n - 7, 0],
  ]) {
    // The 7x7 finder, its light separator, and the surrounding light ring.
    for (let dy = -1; dy <= 7; dy++) {
      for (let dx = -1; dx <= 7; dx++) {
        const row = r0 + dy;
        const col = c0 + dx;
        if (row < 0 || col < 0 || row >= n || col >= n) continue;
        const inside = dy >= 0 && dy <= 6 && dx >= 0 && dx <= 6;
        const expected =
          inside && (dy === 0 || dy === 6 || dx === 0 || dx === 6 || (dy >= 2 && dy <= 4 && dx >= 2 && dx <= 4));
        expect(modules[row][col], `finder at ${row},${col}`).toBe(expected);
      }
    }
  }

  for (let i = 8; i <= n - 9; i++) {
    expect(modules[6][i], `horizontal timing at ${i}`).toBe(i % 2 === 0);
    expect(modules[i][6], `vertical timing at ${i}`).toBe(i % 2 === 0);
  }

  expect(modules[n - 8][8], "dark module").toBe(true);

  const centres = alignmentCentres(version);
  const last = centres[centres.length - 1];
  for (const r of centres) {
    for (const c of centres) {
      // Skip the centres that would sit on a finder.
      if ((r === 6 && c === 6) || (r === 6 && c === last) || (r === last && c === 6)) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const ring = Math.max(Math.abs(dy), Math.abs(dx));
          expect(modules[r + dy][c + dx], `alignment at ${r},${c} offset ${dy},${dx}`).toBe(ring !== 1);
        }
      }
    }
  }
}

/**
 * Reads a symbol back: format information, codewords, zero syndromes for
 * every block, and the byte-mode text. Returns the decoded text.
 */
export function readBack(modules: Modules): string {
  const version = versionFromSize(modules.length);
  const { level, mask } = readFormatInfo(modules);
  const codewords = extractCodewords(modules, mask);
  const { dataBlocks, ecBlocks, ecPerBlock } = deinterleave(codewords, version, level);
  dataBlocks.forEach((block, b) => {
    expect(hasZeroSyndromes([...block, ...ecBlocks[b]], ecPerBlock), `block ${b} syndromes`).toBe(true);
  });
  return parseByteMode(dataBlocks.flat(), version, level);
}

/** Runs every Property 21 check on an encoder result. */
export function assertValidSymbol(qr: QrMatrix, text: string): void {
  assertFunctionPatterns(qr.modules, qr.version);
  const { level, mask } = readFormatInfo(qr.modules);
  expect(level).toBe(qr.level);
  expect(mask).toBe(qr.mask);
  expect(readBack(qr.modules)).toBe(text);
}
