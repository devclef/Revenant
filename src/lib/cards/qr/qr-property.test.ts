import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { encodeQr } from "./encode";
import { assertValidSymbol, deinterleave, extractCodewords } from "./test-support";
import { byteCapacity, dataCodewords, MAX_VERSION, type QrLevel } from "./tables";

/** Text that fits in version 10 at the given level, mixing ASCII and multi-byte UTF-8. */
const textArb = (level: QrLevel): fc.Arbitrary<string> =>
  fc
    .oneof(fc.string({ maxLength: 240 }), fc.string({ unit: "grapheme", maxLength: 120 }))
    .filter((s) => new TextEncoder().encode(s).length <= byteCapacity(MAX_VERSION, level));

describe("Property 21: the QR encoder produces a valid, self-consistent symbol", () => {
  it("holds for generated text at level M", () => {
    fc.assert(
      fc.property(textArb("M"), (text) => {
        assertValidSymbol(encodeQr(text, "M"), text);
      }),
      { numRuns: 100 },
    );
  }, 60_000);

  it("holds for generated text at level L", () => {
    fc.assert(
      fc.property(textArb("L"), (text) => {
        assertValidSymbol(encodeQr(text, "L"), text);
      }),
      { numRuns: 100 },
    );
  }, 60_000);

  it("uses the smallest version that fits", () => {
    fc.assert(
      fc.property(textArb("M"), (text) => {
        const bytes = new TextEncoder().encode(text).length;
        const qr = encodeQr(text, "M");
        expect(bytes).toBeLessThanOrEqual(byteCapacity(qr.version, "M"));
        if (qr.version > 1) expect(bytes).toBeGreaterThan(byteCapacity(qr.version - 1, "M"));
      }),
      { numRuns: 100 },
    );
  }, 60_000);

  it("reads back the data codeword count the tables promise", () => {
    for (let version = 1; version <= MAX_VERSION; version++) {
      for (const level of ["L", "M"] as const) {
        const text = "x".repeat(byteCapacity(version, level));
        const qr = encodeQr(text, level);
        expect(qr.version).toBe(version);
        const codewords = extractCodewords(qr.modules, qr.mask);
        const { dataBlocks } = deinterleave(codewords, version, level);
        expect(dataBlocks.flat()).toHaveLength(dataCodewords(version, level));
      }
    }
  });
});
