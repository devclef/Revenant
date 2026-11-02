import { alignmentCentres, assertVersion, symbolSize, type QrLevel } from "./tables";

/** A square grid of modules. `modules[row][col]` is true for a dark module. */
export interface QrGrid {
  readonly size: number;
  readonly modules: boolean[][];
  /** True for function patterns and format or version areas, which data never overwrites. */
  readonly reserved: boolean[][];
}

const FORMAT_GENERATOR = 0x537;
const FORMAT_MASK = 0x5412;
const VERSION_GENERATOR = 0x1f25;

/** Error correction indicator bits used in the format information. */
const LEVEL_BITS: Readonly<Record<QrLevel, number>> = { L: 0b01, M: 0b00 };

/** Polynomial division over GF(2): the remainder of `value` by `generator`, shifted into place. */
function bchCodeword(data: number, generator: number, generatorDegree: number): number {
  const original = data << generatorDegree;
  let rem = original;
  for (let bit = 31; bit >= generatorDegree; bit--) {
    if ((rem >>> bit) & 1) rem ^= generator << (bit - generatorDegree);
  }
  return original | rem;
}

/** The 15-bit format information for a level and mask pattern (0 to 7). */
export function formatBits(level: QrLevel, mask: number): number {
  if (!Number.isInteger(mask) || mask < 0 || mask > 7) {
    throw new RangeError("mask must be an integer from 0 to 7");
  }
  const data = (LEVEL_BITS[level] << 3) | mask;
  return bchCodeword(data, FORMAT_GENERATOR, 10) ^ FORMAT_MASK;
}

/** The 18-bit version information, present from version 7 on. */
export function versionBits(version: number): number {
  assertVersion(version);
  return bchCodeword(version, VERSION_GENERATOR, 12);
}

function filled(size: number, value: boolean): boolean[][] {
  return Array.from({ length: size }, () => new Array<boolean>(size).fill(value));
}

export function createGrid(version: number): QrGrid {
  const size = symbolSize(version);
  return { size, modules: filled(size, false), reserved: filled(size, false) };
}

function put(grid: QrGrid, row: number, col: number, dark: boolean): void {
  grid.modules[row][col] = dark;
  grid.reserved[row][col] = true;
}

function drawFinder(grid: QrGrid, top: number, left: number): void {
  // Covers the 7x7 finder plus its one-module light separator.
  for (let dy = -1; dy <= 7; dy++) {
    for (let dx = -1; dx <= 7; dx++) {
      const row = top + dy;
      const col = left + dx;
      if (row < 0 || col < 0 || row >= grid.size || col >= grid.size) continue;
      const inside = dy >= 0 && dy <= 6 && dx >= 0 && dx <= 6;
      const dark =
        inside &&
        (dy === 0 || dy === 6 || dx === 0 || dx === 6 || (dy >= 2 && dy <= 4 && dx >= 2 && dx <= 4));
      put(grid, row, col, dark);
    }
  }
}

function drawAlignment(grid: QrGrid, centreRow: number, centreCol: number): void {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const ring = Math.max(Math.abs(dy), Math.abs(dx));
      put(grid, centreRow + dy, centreCol + dx, ring !== 1);
    }
  }
}

/**
 * Draws finder, timing, alignment and dark module patterns, reserves the
 * format areas, and writes the version information for version 7 and up.
 */
export function drawFunctionPatterns(grid: QrGrid, version: number): void {
  const { size } = grid;
  assertVersion(version);
  if (size !== symbolSize(version)) throw new RangeError("grid does not match the version");

  drawFinder(grid, 0, 0);
  drawFinder(grid, 0, size - 7);
  drawFinder(grid, size - 7, 0);

  for (let i = 0; i < size; i++) {
    // Timing patterns: row 6 and column 6, dark on even indices, drawn between the finders.
    if (i >= 8 && i <= size - 9) {
      put(grid, 6, i, i % 2 === 0);
      put(grid, i, 6, i % 2 === 0);
    }
  }
  // Row 6 and column 6 are function modules everywhere, including inside finders.
  for (let i = 0; i < size; i++) {
    grid.reserved[6][i] = true;
    grid.reserved[i][6] = true;
  }

  const centres = alignmentCentres(version);
  const last = centres.length - 1;
  centres.forEach((row, ri) => {
    centres.forEach((col, ci) => {
      const overlapsFinder = (ri === 0 && ci === 0) || (ri === 0 && ci === last) || (ri === last && ci === 0);
      if (!overlapsFinder) drawAlignment(grid, row, col);
    });
  });

  // Format areas are reserved here and filled by drawFormatBits after masking.
  for (let i = 0; i <= 8; i++) {
    grid.reserved[8][i] = true;
    grid.reserved[i][8] = true;
  }
  for (let i = 0; i < 8; i++) {
    grid.reserved[8][size - 1 - i] = true;
  }
  for (let i = 0; i < 7; i++) {
    grid.reserved[size - 1 - i][8] = true;
  }
  put(grid, size - 8, 8, true);

  if (version >= 7) {
    const bits = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const dark = ((bits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      put(grid, b, a, dark);
      put(grid, a, b, dark);
    }
  }
}

/** Writes the two copies of the format information for a level and mask. */
export function drawFormatBits(grid: QrGrid, level: QrLevel, mask: number): void {
  const { size } = grid;
  const bits = formatBits(level, mask);
  const bit = (i: number): boolean => ((bits >>> i) & 1) === 1;
  // Copy around the top-left finder.
  for (let i = 0; i <= 5; i++) put(grid, i, 8, bit(i));
  put(grid, 7, 8, bit(6));
  put(grid, 8, 8, bit(7));
  put(grid, 8, 7, bit(8));
  for (let i = 9; i <= 14; i++) put(grid, 8, 14 - i, bit(i));
  // Copy split between the top-right and bottom-left finders.
  for (let i = 0; i <= 7; i++) put(grid, 8, size - 1 - i, bit(i));
  for (let i = 8; i <= 14; i++) put(grid, size - 15 + i, 8, bit(i));
}

/**
 * Writes codeword bits into unreserved modules in the zigzag order from the
 * bottom-right corner. Leftover modules (remainder bits) stay light.
 */
export function placeCodewords(grid: QrGrid, codewords: readonly number[]): void {
  const { size, modules, reserved } = grid;
  const totalBits = codewords.length * 8;
  let index = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const col = right - j;
        const upward = ((right + 1) & 2) === 0;
        const row = upward ? size - 1 - vert : vert;
        if (reserved[row][col] || index >= totalBits) continue;
        const byte = codewords[index >>> 3];
        modules[row][col] = ((byte >>> (7 - (index & 7))) & 1) === 1;
        index++;
      }
    }
  }
}
