import type { QrGrid } from "./matrix";

/** Mask pattern: true where the module is flipped. Row and column are zero-based. */
export function maskBit(mask: number, row: number, col: number): boolean {
  switch (mask) {
    case 0:
      return (row + col) % 2 === 0;
    case 1:
      return row % 2 === 0;
    case 2:
      return col % 3 === 0;
    case 3:
      return (row + col) % 3 === 0;
    case 4:
      return (Math.floor(row / 2) + Math.floor(col / 3)) % 2 === 0;
    case 5:
      return ((row * col) % 2) + ((row * col) % 3) === 0;
    case 6:
      return (((row * col) % 2) + ((row * col) % 3)) % 2 === 0;
    case 7:
      return (((row + col) % 2) + ((row * col) % 3)) % 2 === 0;
    default:
      throw new RangeError("mask must be an integer from 0 to 7");
  }
}

/** Flips every data module (not reserved) where the mask is true. */
export function applyMask(grid: QrGrid, mask: number): void {
  for (let row = 0; row < grid.size; row++) {
    for (let col = 0; col < grid.size; col++) {
      if (!grid.reserved[row][col] && maskBit(mask, row, col)) {
        grid.modules[row][col] = !grid.modules[row][col];
      }
    }
  }
}

const FINDER_PATTERN_A = [true, false, true, true, true, false, true, false, false, false, false];
const FINDER_PATTERN_B = [false, false, false, false, true, false, true, true, true, false, true];

/** Penalty for runs of five or more same-colour modules in each row and column (rule N1). */
function runPenalty(line: readonly boolean[]): number {
  let penalty = 0;
  let run = 1;
  for (let i = 1; i <= line.length; i++) {
    if (i < line.length && line[i] === line[i - 1]) {
      run++;
    } else {
      if (run >= 5) penalty += 3 + (run - 5);
      run = 1;
    }
  }
  return penalty;
}

/** Finder-like pattern matches with four light modules on one side (rule N3). */
function finderLikePenalty(line: readonly boolean[]): number {
  let penalty = 0;
  for (let i = 0; i + 11 <= line.length; i++) {
    const span = line.slice(i, i + 11);
    if (matches(span, FINDER_PATTERN_A) || matches(span, FINDER_PATTERN_B)) penalty += 40;
  }
  return penalty;
}

function matches(span: readonly boolean[], pattern: readonly boolean[]): boolean {
  return pattern.every((v, i) => span[i] === v);
}

/** Total penalty of a masked symbol, from the four rules in ISO/IEC 18004. */
export function penaltyScore(modules: readonly (readonly boolean[])[]): number {
  const size = modules.length;
  const columns: boolean[][] = Array.from({ length: size }, (_, col) =>
    modules.map((row) => row[col]),
  );
  let penalty = 0;

  // N1 and N3, rows and columns.
  for (const line of [...modules, ...columns]) {
    penalty += runPenalty(line) + finderLikePenalty(line);
  }

  // N2: 2x2 blocks of one colour.
  for (let row = 0; row < size - 1; row++) {
    for (let col = 0; col < size - 1; col++) {
      const v = modules[row][col];
      if (v === modules[row][col + 1] && v === modules[row + 1][col] && v === modules[row + 1][col + 1]) {
        penalty += 3;
      }
    }
  }

  // N4: deviation of the dark share from 50 percent, in steps of 5 percent.
  let dark = 0;
  for (const row of modules) for (const v of row) if (v) dark++;
  const percent = (dark * 100) / (size * size);
  penalty += Math.floor(Math.abs(percent - 50) / 5) * 10;

  return penalty;
}
