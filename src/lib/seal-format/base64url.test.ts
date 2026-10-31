import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { decodeBase64url, encodeBase64url, isLetterId } from "./base64url";

const bytes = (...xs: number[]): Uint8Array => Uint8Array.from(xs);

// Known-answer vectors from RFC 4648 §10, in the URL-safe alphabet with no
// padding. ("" -> "", "f" -> "Zg", "fo" -> "Zm8", "foo" -> "Zm9v", ...)
const KNOWN: ReadonlyArray<readonly [string, string]> = [
  ["", ""],
  ["f", "Zg"],
  ["fo", "Zm8"],
  ["foo", "Zm9v"],
  ["foob", "Zm9vYg"],
  ["fooba", "Zm9vYmE"],
  ["foobar", "Zm9vYmFy"],
];

const ascii = (s: string): Uint8Array =>
  Uint8Array.from(s, (c) => c.charCodeAt(0));

describe("encodeBase64url / decodeBase64url known-answer vectors", () => {
  for (const [plain, encoded] of KNOWN) {
    it(`encodes ${JSON.stringify(plain)} as ${JSON.stringify(encoded)}`, () => {
      expect(encodeBase64url(ascii(plain))).toBe(encoded);
    });
    it(`decodes ${JSON.stringify(encoded)} back to ${JSON.stringify(plain)}`, () => {
      expect(decodeBase64url(encoded)).toEqual(ascii(plain));
    });
  }

  it("uses the URL-safe alphabet (- and _, never + or /)", () => {
    // 0xff 0xef 0xff -> all-ones patterns land on the last two symbols.
    expect(encodeBase64url(bytes(0xff, 0xef, 0xff))).toBe("_-__");
    expect(decodeBase64url("_-__")).toEqual(bytes(0xff, 0xef, 0xff));
  });
});

describe("decodeBase64url strictness", () => {
  it("rejects '=' padding", () => {
    expect(() => decodeBase64url("Zg==")).toThrow(/character out of alphabet/);
    expect(() => decodeBase64url("Zm9vYg==")).toThrow(/character out of alphabet/);
  });

  it("rejects the standard-base64 characters + and /", () => {
    expect(() => decodeBase64url("ab+d")).toThrow(/character out of alphabet/);
    expect(() => decodeBase64url("ab/d")).toThrow(/character out of alphabet/);
  });

  it("rejects characters outside the alphabet", () => {
    expect(() => decodeBase64url("Zg.")).toThrow(/character out of alphabet/);
    expect(() => decodeBase64url("Zg\u00ff")).toThrow(/character out of alphabet/);
    expect(() => decodeBase64url(" Zg")).toThrow(/character out of alphabet/);
  });

  it("rejects an impossible length (remainder of 1 char)", () => {
    expect(() => decodeBase64url("Z")).toThrow(/bad length/);
    expect(() => decodeBase64url("Zm9vZ")).toThrow(/bad length/);
  });

  it("rejects non-zero trailing bits in a 2-char final group", () => {
    // "Zg" decodes 'f' with a zero low nibble; "Zh" sets a trailing bit.
    expect(decodeBase64url("Zg")).toEqual(ascii("f"));
    expect(() => decodeBase64url("Zh")).toThrow(/non-zero trailing bits/);
  });

  it("rejects non-zero trailing bits in a 3-char final group", () => {
    // "Zm8" decodes "fo" with zero low 2 bits; "Zm9" sets a trailing bit.
    expect(decodeBase64url("Zm8")).toEqual(ascii("fo"));
    expect(() => decodeBase64url("Zm9")).toThrow(/non-zero trailing bits/);
  });

  it("enforces expectedLength when given", () => {
    expect(decodeBase64url("Zm9v", 3)).toEqual(ascii("foo"));
    expect(() => decodeBase64url("Zm9v", 2)).toThrow(/unexpected length/);
  });
});

describe("isLetterId", () => {
  it("accepts the canonical encoding of 16 bytes (22 chars)", () => {
    const id = encodeBase64url(new Uint8Array(16));
    expect(id).toHaveLength(22);
    expect(isLetterId(id)).toBe(true);
    // 16 random-looking bytes likewise round-trip to a valid letter ID.
    const rand = encodeBase64url(
      bytes(1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16),
    );
    expect(isLetterId(rand)).toBe(true);
  });

  it("rejects encodings of non-16-byte inputs", () => {
    expect(isLetterId(encodeBase64url(new Uint8Array(15)))).toBe(false);
    expect(isLetterId(encodeBase64url(new Uint8Array(17)))).toBe(false);
    expect(isLetterId(encodeBase64url(new Uint8Array(0)))).toBe(false);
  });

  it("rejects a 22-char string whose final char carries non-zero trailing bits", () => {
    // 16 bytes leave 4 trailing zero bits, so the last char must be one of
    // A/Q/g/w. Any other final char is not a canonical 16-byte encoding.
    const id = encodeBase64url(new Uint8Array(16));
    const bad = id.slice(0, 21) + "B";
    expect(bad).toHaveLength(22);
    expect(isLetterId(bad)).toBe(false);
  });

  it("rejects strings with out-of-alphabet characters or padding", () => {
    expect(isLetterId("A".repeat(21) + "=")).toBe(false);
    expect(isLetterId("A".repeat(21) + "+")).toBe(false);
    expect(isLetterId("A".repeat(21) + " ")).toBe(false);
  });
});

// Feature: 02-sealed-letters, Property 4: base64url is a bijection
describe("Property 4: base64url is a bijection", () => {
  it("decodeBase64url(encodeBase64url(b)) === b for any bytes", () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 0, maxLength: 64 }), (b) => {
        expect(decodeBase64url(encodeBase64url(b))).toEqual(b);
      }),
      { numRuns: 100 },
    );
  });

  it("encodeBase64url(decodeBase64url(s)) === s for any decodable s", () => {
    // Generate decodable strings by encoding arbitrary bytes: every canonical
    // encoding must re-encode to itself.
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 0, maxLength: 64 }), (b) => {
        const s = encodeBase64url(b);
        expect(encodeBase64url(decodeBase64url(s))).toBe(s);
      }),
      { numRuns: 100 },
    );
  });

  it("isLetterId(s) holds exactly when s decodes to 16 bytes", () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 0, maxLength: 32 }), (b) => {
        const s = encodeBase64url(b);
        expect(isLetterId(s)).toBe(b.length === 16);
      }),
      { numRuns: 100 },
    );
  });
});
