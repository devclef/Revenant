import { rsEncode } from "./reed-solomon";
import { applyMask, penaltyScore } from "./mask";
import {
  createGrid,
  drawFormatBits,
  drawFunctionPatterns,
  placeCodewords,
  type QrGrid,
} from "./matrix";
import {
  MAX_VERSION,
  MIN_VERSION,
  blockLayout,
  byteCapacity,
  charCountBits,
  dataCodewords,
  type QrLevel,
} from "./tables";

export interface QrMatrix {
  size: number;
  version: number;
  level: "L" | "M";
  mask: number;
  modules: readonly (readonly boolean[])[];
}

const BYTE_MODE_INDICATOR = 0b0100;
const PAD_BYTES = [0xec, 0x11] as const;
const MASKS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

/** Smallest version at level `level` whose byte capacity holds `byteLength` bytes. */
function chooseVersion(byteLength: number, level: QrLevel): number {
  for (let version = MIN_VERSION; version <= MAX_VERSION; version++) {
    if (byteLength <= byteCapacity(version, level)) return version;
  }
  throw new RangeError(
    `text is ${byteLength} bytes; the largest QR code at level ${level} holds ${byteCapacity(MAX_VERSION, level)}`,
  );
}

/** Mode, count, data, terminator, byte alignment and pad bytes, as data codewords. */
function dataStream(bytes: Uint8Array, version: number, level: QrLevel): number[] {
  const capacityBits = dataCodewords(version, level) * 8;
  const bits: number[] = [];
  const push = (value: number, width: number): void => {
    for (let i = width - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  push(BYTE_MODE_INDICATOR, 4);
  push(bytes.length, charCountBits(version));
  for (const byte of bytes) push(byte, 8);

  const terminator = Math.min(4, capacityBits - bits.length);
  push(0, terminator);
  while (bits.length % 8 !== 0) bits.push(0);

  const codewords: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    codewords.push(byte);
  }
  for (let i = 0; codewords.length < capacityBits / 8; i++) {
    codewords.push(PAD_BYTES[i % 2]);
  }
  return codewords;
}

/** Splits data into blocks, adds error correction and interleaves the blocks. */
function interleave(data: readonly number[], version: number, level: QrLevel): number[] {
  const { dataLengths, ecPerBlock } = blockLayout(version, level);
  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];
  let offset = 0;
  for (const length of dataLengths) {
    const block = data.slice(offset, offset + length);
    offset += length;
    dataBlocks.push(block);
    ecBlocks.push(rsEncode(block, ecPerBlock));
  }

  const out: number[] = [];
  const longest = Math.max(...dataLengths);
  for (let i = 0; i < longest; i++) {
    for (const block of dataBlocks) if (i < block.length) out.push(block[i]);
  }
  for (let i = 0; i < ecPerBlock; i++) {
    for (const block of ecBlocks) out.push(block[i]);
  }
  return out;
}

function buildMasked(version: number, level: QrLevel, codewords: readonly number[], mask: number): QrGrid {
  const grid = createGrid(version);
  drawFunctionPatterns(grid, version);
  placeCodewords(grid, codewords);
  applyMask(grid, mask);
  drawFormatBits(grid, level, mask);
  return grid;
}

/**
 * Encodes text as a QR symbol in byte mode (UTF-8), versions 1 to 10.
 * Picks the smallest version that fits and the mask with the lowest penalty.
 * Throws a RangeError when the text is too long for version 10 at this level.
 */
export function encodeQr(text: string, level: QrLevel = "M"): QrMatrix {
  if (level !== "L" && level !== "M") {
    throw new RangeError("error correction level must be L or M");
  }
  const bytes = new TextEncoder().encode(text);
  const version = chooseVersion(bytes.length, level);
  const codewords = interleave(dataStream(bytes, version, level), version, level);

  let best: { grid: QrGrid; mask: number; penalty: number } | null = null;
  for (const mask of MASKS) {
    const grid = buildMasked(version, level, codewords, mask);
    const penalty = penaltyScore(grid.modules);
    if (best === null || penalty < best.penalty) best = { grid, mask, penalty };
  }
  if (best === null) throw new RangeError("no mask could be applied");

  return {
    size: best.grid.size,
    version,
    level,
    mask: best.mask,
    modules: best.grid.modules.map((row) => [...row]),
  };
}
