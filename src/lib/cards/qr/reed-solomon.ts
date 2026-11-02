import { EXP, LOG, gfMul } from "./gf256";

/**
 * Generator polynomial of degree n: product of (x - alpha^i) for i in 0..n-1.
 * Returned highest power first, so the leading coefficient is 1.
 */
export function generatorPoly(n: number): number[] {
  if (!Number.isInteger(n) || n < 1 || n > 255) {
    throw new RangeError("error correction count must be an integer from 1 to 255");
  }
  let poly = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

/** Exponents of alpha for each coefficient of the generator; zero coefficients have none. */
export function generatorExponents(n: number): (number | null)[] {
  return generatorPoly(n).map((c) => (c === 0 ? null : LOG[c]));
}

/** Reed-Solomon error correction: the `n` check codewords for the data codewords. */
export function rsEncode(data: readonly number[], n: number): number[] {
  const gen = generatorPoly(n);
  const ecc = new Array<number>(n).fill(0);
  for (const byte of data) {
    if (!Number.isInteger(byte) || byte < 0 || byte > 255) {
      throw new RangeError("codewords must be bytes from 0 to 255");
    }
    const factor = byte ^ ecc[0];
    ecc.shift();
    ecc.push(0);
    for (let i = 0; i < n; i++) {
      ecc[i] ^= gfMul(gen[i + 1], factor);
    }
  }
  return ecc;
}
