// Feature: 09 (spec 09 A9), Property 7: the answer text keeps every digit,
// groups the integer part correctly, and keeps trailing zeros.

import { describe, expect, it } from "vitest";

import { answerText } from "./answer-text";

const digits = (s: string) => s.replace(/[^0-9]/g, "");

describe("answerText", () => {
  it("keeps trailing zeros in the fraction", () => {
    expect(answerText("3.90")).toBe("3.90");
    expect(answerText("0.500")).toBe("0.500");
  });

  it("groups the integer part with commas", () => {
    expect(answerText("1000")).toBe("1,000");
    expect(answerText("1000000")).toBe("1,000,000");
    expect(answerText("999")).toBe("999");
    expect(answerText("1234.5")).toBe("1,234.5");
    expect(answerText("0")).toBe("0");
  });

  it("never rounds or drops a digit", () => {
    const samples = ["0", "7", "10", "100", "1000", "12345.678900", "0.01", "9007199254740993.10"];
    for (const v of samples) {
      expect(digits(answerText(v))).toBe(digits(v));
      expect(answerText(v).replace(/,/g, "")).toBe(v);
    }
  });

  it("property: every digit survives, grouping is valid and fractions are untouched", () => {
    let seed = 0x5eed;
    const next = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed;
    };
    for (let n = 0; n < 500; n++) {
      const intLen = 1 + (next() % 15);
      let integer = String(1 + (next() % 9));
      for (let k = 1; k < intLen; k++) integer += String(next() % 10);
      const hasFraction = next() % 2 === 0;
      let fraction = "";
      if (hasFraction) {
        const fLen = 1 + (next() % 6);
        for (let k = 0; k < fLen; k++) fraction += String(next() % 10);
      }
      const value = hasFraction ? `${integer}.${fraction}` : integer;
      const out = answerText(value);
      expect(digits(out)).toBe(digits(value));
      expect(out.replace(/,/g, "")).toBe(value);
      const [outInt, outFrac] = out.split(".");
      expect(outInt).toMatch(/^[1-9][0-9]{0,2}(,[0-9]{3})*$|^0$/);
      if (hasFraction) expect(outFrac).toBe(fraction);
      else expect(outFrac).toBeUndefined();
    }
  });
});
