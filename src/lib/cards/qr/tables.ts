// QR code tables for versions 1 to 10, error correction levels L and M.
// Byte mode only. Values follow ISO/IEC 18004.

export type QrLevel = "L" | "M";

export const MIN_VERSION = 1;
export const MAX_VERSION = 10;

/** Total codewords (data plus error correction) in one symbol, per version. */
const TOTAL_CODEWORDS: readonly number[] = [
  0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346,
];

/**
 * Error correction blocks per version and level: `blocks` blocks, each with
 * `ecPerBlock` error correction codewords. Data codewords follow from these.
 */
const EC_BLOCKS: Readonly<Record<QrLevel, readonly { blocks: number; ecPerBlock: number }[]>> = {
  L: [
    { blocks: 0, ecPerBlock: 0 },
    { blocks: 1, ecPerBlock: 7 },
    { blocks: 1, ecPerBlock: 10 },
    { blocks: 1, ecPerBlock: 15 },
    { blocks: 1, ecPerBlock: 20 },
    { blocks: 1, ecPerBlock: 26 },
    { blocks: 2, ecPerBlock: 18 },
    { blocks: 2, ecPerBlock: 20 },
    { blocks: 2, ecPerBlock: 24 },
    { blocks: 2, ecPerBlock: 30 },
    { blocks: 4, ecPerBlock: 18 },
  ],
  M: [
    { blocks: 0, ecPerBlock: 0 },
    { blocks: 1, ecPerBlock: 10 },
    { blocks: 1, ecPerBlock: 16 },
    { blocks: 1, ecPerBlock: 26 },
    { blocks: 2, ecPerBlock: 18 },
    { blocks: 2, ecPerBlock: 24 },
    { blocks: 4, ecPerBlock: 16 },
    { blocks: 4, ecPerBlock: 18 },
    { blocks: 4, ecPerBlock: 22 },
    { blocks: 5, ecPerBlock: 22 },
    { blocks: 5, ecPerBlock: 26 },
  ],
};

/** Alignment pattern centre coordinates per version (version 1 has none). */
const ALIGNMENT_CENTRES: readonly (readonly number[])[] = [
  [],
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

export function assertVersion(version: number): void {
  if (!Number.isInteger(version) || version < MIN_VERSION || version > MAX_VERSION) {
    throw new RangeError(`QR version must be an integer from ${MIN_VERSION} to ${MAX_VERSION}`);
  }
}

/** Side length in modules: 21 for version 1, plus 4 per version step. */
export function symbolSize(version: number): number {
  assertVersion(version);
  return 17 + 4 * version;
}

export interface BlockLayout {
  /** Data codewords in each block, in block order. */
  readonly dataLengths: readonly number[];
  /** Error correction codewords in each block. */
  readonly ecPerBlock: number;
}

/**
 * Splits a version and level into blocks. Short blocks come first and long
 * blocks (one more codeword) come last, as ISO/IEC 18004 specifies.
 */
export function blockLayout(version: number, level: QrLevel): BlockLayout {
  assertVersion(version);
  const { blocks, ecPerBlock } = EC_BLOCKS[level][version];
  const total = TOTAL_CODEWORDS[version];
  const shortLength = Math.floor(total / blocks);
  const longCount = total % blocks;
  const shortCount = blocks - longCount;
  const shortData = shortLength - ecPerBlock;
  const dataLengths: number[] = [];
  for (let i = 0; i < shortCount; i++) dataLengths.push(shortData);
  for (let i = 0; i < longCount; i++) dataLengths.push(shortData + 1);
  return { dataLengths, ecPerBlock };
}

/** Data codewords (message capacity in codewords) for a version and level. */
export function dataCodewords(version: number, level: QrLevel): number {
  return blockLayout(version, level).dataLengths.reduce((sum, n) => sum + n, 0);
}

/** Byte-mode character count indicator width: 8 bits up to version 9, 16 from 10. */
export function charCountBits(version: number): number {
  assertVersion(version);
  return version <= 9 ? 8 : 16;
}

/** Largest number of UTF-8 bytes that fit in one symbol in byte mode. */
export function byteCapacity(version: number, level: QrLevel): number {
  const bits = dataCodewords(version, level) * 8;
  // 4 bits of mode indicator, then the character count, then the data.
  return Math.floor((bits - 4 - charCountBits(version)) / 8);
}

/** Centre coordinates of alignment patterns for a version. */
export function alignmentCentres(version: number): readonly number[] {
  assertVersion(version);
  return ALIGNMENT_CENTRES[version];
}

/** Remainder bits left after the codewords, per version. */
export function remainderBits(version: number): number {
  assertVersion(version);
  if (version === 1) return 0;
  if (version <= 6) return 7;
  return 0;
}
