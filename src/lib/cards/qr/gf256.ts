// GF(256) arithmetic over the QR polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11D).

const PRIMITIVE_POLY = 0x11d;

/** EXP[i] = alpha^i for i in 0..511 (doubled so products need no modulo). */
export const EXP: Uint8Array = new Uint8Array(512);
/** LOG[x] = i such that alpha^i = x, for x in 1..255. LOG[0] is unused. */
export const LOG: Uint8Array = new Uint8Array(256);

(function buildTables(): void {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= PRIMITIVE_POLY;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();

export function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}
