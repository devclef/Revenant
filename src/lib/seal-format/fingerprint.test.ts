import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { formatFingerprint, parseFingerprint } from "./fingerprint";

// A 64-character lowercase hex string, the shape of a SHA-256 envelope hash.
const hashArb = fc
  .array(fc.constantFrom(..."0123456789abcdef".split("")), {
    minLength: 64,
    maxLength: 64,
  })
  .map((chars) => chars.join(""));

describe("parseFingerprint(formatFingerprint(h)) round trip", () => {
  // Property 4: for every valid hash, parsing the formatted fingerprint gives
  // back the original hash.
  it("returns the original hash for many random hashes", () => {
    fc.assert(
      fc.property(hashArb, (h) => {
        const formatted = formatFingerprint(h);
        expect(formatted).not.toBeNull();
        expect(parseFingerprint(formatted as string)).toBe(h);
      }),
      { numRuns: 500 },
    );
  });

  it("round-trips a hash made of only zeros and only f's", () => {
    const zeros = "0".repeat(64);
    const fs = "f".repeat(64);
    expect(parseFingerprint(formatFingerprint(zeros) as string)).toBe(zeros);
    expect(parseFingerprint(formatFingerprint(fs) as string)).toBe(fs);
  });
});

describe("parseFingerprint rejects malformed text", () => {
  const valid = formatFingerprint("0123456789abcdef".repeat(4)) as string;

  it("accepts the canonical form as a control", () => {
    expect(parseFingerprint(valid)).toBe("0123456789abcdef".repeat(4));
  });

  it("returns null for uppercase hex", () => {
    expect(parseFingerprint(valid.toUpperCase())).toBeNull();
  });

  it("returns null for a fingerprint with one group missing", () => {
    const groups = valid.split(" ");
    expect(parseFingerprint(groups.slice(1).join(" "))).toBeNull();
  });

  it("returns null for a fingerprint with one extra group", () => {
    expect(parseFingerprint(`${valid} 0000`)).toBeNull();
  });

  it("returns null for a group of the wrong length", () => {
    const groups = valid.split(" ");
    groups[0] = groups[0].slice(0, 3);
    expect(parseFingerprint(groups.join(" "))).toBeNull();
  });

  it("returns null for non-hex characters", () => {
    expect(parseFingerprint(valid.replace("0", "g"))).toBeNull();
    expect(parseFingerprint(valid.replace("1", "-"))).toBeNull();
  });

  it("returns null for a double space between groups", () => {
    expect(parseFingerprint(valid.replace(" ", "  "))).toBeNull();
  });

  it("returns null for a leading or trailing space", () => {
    expect(parseFingerprint(` ${valid}`)).toBeNull();
    expect(parseFingerprint(`${valid} `)).toBeNull();
  });

  it("returns null for groups joined without spaces", () => {
    expect(parseFingerprint(valid.replace(/ /g, ""))).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(parseFingerprint("")).toBeNull();
  });
});

describe("formatFingerprint rejects malformed hashes", () => {
  it("returns null for uppercase hex", () => {
    expect(formatFingerprint("A".repeat(64))).toBeNull();
  });

  it("returns null for the wrong length", () => {
    expect(formatFingerprint("a".repeat(63))).toBeNull();
    expect(formatFingerprint("a".repeat(65))).toBeNull();
    expect(formatFingerprint("")).toBeNull();
  });

  it("returns null for non-hex characters", () => {
    expect(formatFingerprint("g".repeat(64))).toBeNull();
  });
});
