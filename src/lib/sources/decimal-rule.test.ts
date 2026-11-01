// Example tests for the Decimal_Rule (04-real-figures).
//
// cellToDecimal turns a numeric spreadsheet cell into a decimal string at full
// published precision WITHOUT arithmetic: the result is either the stored
// double's shortest round-trip form (String(v)) or the publisher's displayed
// text with spaces and thousands commas removed. These example rows are the
// "Decimal_Rule: what the real files contain" table from design.md, written by
// hand from the publisher's displayed numbers (R5.5), plus the R5.2 noise
// examples and the error cases the spec enumerates (R5.3, R5.4, R5.6,
// data-integrity.md: "full published precision … round only for display").

import { describe, expect, it } from "vitest";

import { cellToDecimal, type Cell } from "./decimal-rule";

describe("cellToDecimal", () => {
  describe("the Decimal_Rule table (real cells, fetched 2026-10-31)", () => {
    // Each row: the double the parser reads from the file, the text the cell's
    // number format displays, and the decimal string the rule must return. The
    // stored numbers and display strings are transcribed by hand from
    // design.md's "Decimal_Rule: what the real files contain".
    const ROWS: ReadonlyArray<{
      label: string;
      v: number;
      w: string;
      expected: string;
    }> = [
      // EIA: the stored number is the three-decimal figure EIA typed; its
      // shortest round-trip text equals the displayed text, so the result is
      // that same decimal (the noise guard never fires).
      { label: "us-gasoline-regular 2024-05-06", v: 3.643, w: "3.643", expected: "3.643" },
      { label: "us-gasoline-regular 2024-11-04", v: 3.069, w: "3.069", expected: "3.069" },
      { label: "us-gasoline-regular 2026-10-26", v: 4.269, w: "4.269", expected: "4.269" },
      { label: "us-diesel 2024-05-06", v: 3.894, w: "3.894", expected: "3.894" },
      { label: "us-diesel 2026-10-26", v: 6.352, w: "6.352", expected: "6.352" },
      // Bulletin: the stored EU27 weighted average carries up to 13 decimals;
      // the displayed text is a 2-decimal accounting rounding of it, which does
      // NOT agree with the stored value at 15 significant digits, so the rule
      // keeps the full-precision stored number (design D1, accepted).
      {
        label: "eu-petrol-euro95 2026-10-26",
        v: 1954.037871213403,
        w: " 1,954.04 ",
        expected: "1954.037871213403",
      },
      {
        label: "eu-diesel 2026-10-26",
        v: 2146.185973890054,
        w: " 2,146.19 ",
        expected: "2146.185973890054",
      },
      {
        label: "eu-petrol-euro95 2024-11-04",
        v: 1629.2663410422444,
        w: " 1,629.27 ",
        expected: "1629.2663410422444",
      },
      {
        label: "eu-diesel 2024-11-04",
        v: 1524.580178432713,
        w: " 1,524.58 ",
        expected: "1524.580178432713",
      },
    ];

    for (const { label, v, w, expected } of ROWS) {
      it(`${label}: stored ${v}, displayed ${JSON.stringify(w)} -> ${expected}`, () => {
        const cell: Cell = { t: "n", v, w };
        expect(cellToDecimal(cell)).toBe(expected);
      });
    }

    it("keeps the full-precision Bulletin value, never its two displayed decimals", () => {
      // The displayed text is 1,954.04; the rule must not round to it.
      const cell: Cell = { t: "n", v: 1954.037871213403, w: " 1,954.04 " };
      const result = cellToDecimal(cell);
      expect(result).toBe("1954.037871213403");
      expect(result).not.toBe("1954.04");
    });
  });

  describe("the noise guard (R5.2 examples)", () => {
    it("returns the display decimal when the stored double is it plus noise below 15 digits", () => {
      // 1463.0100000000002 displayed as 1,463.01: toPrecision(15) is
      // 1463.01000000000 for both, so the guard prefers the clean display text.
      const cell: Cell = { t: "n", v: 1463.0100000000002, w: "1,463.01" };
      expect(cellToDecimal(cell)).toBe("1463.01");
    });

    it("keeps the stored double when the display text disagrees past 15 digits", () => {
      // 1751.1076729999997 shown as 1,751.11 does not match at 15 significant
      // digits, so the guard does not fire and the full value is kept.
      const cell: Cell = { t: "n", v: 1751.1076729999997, w: " 1,751.11 " };
      expect(cellToDecimal(cell)).toBe("1751.1076729999997");
    });
  });

  describe("error cases", () => {
    it("throws for a text cell", () => {
      const cell: Cell = { t: "s", v: "3.41", w: "3.41" };
      expect(() => cellToDecimal(cell)).toThrow();
    });

    it("throws for an empty cell (no stored value)", () => {
      const cell: Cell = { t: "n", v: undefined, w: "" };
      expect(() => cellToDecimal(cell)).toThrow();
    });

    it("throws for NaN", () => {
      const cell: Cell = { t: "n", v: Number.NaN };
      expect(() => cellToDecimal(cell)).toThrow();
    });

    it("throws for Infinity", () => {
      const cell: Cell = { t: "n", v: Number.POSITIVE_INFINITY };
      expect(() => cellToDecimal(cell)).toThrow();
    });

    it("throws for -Infinity", () => {
      const cell: Cell = { t: "n", v: Number.NEGATIVE_INFINITY };
      expect(() => cellToDecimal(cell)).toThrow();
    });

    it("throws for 1e21 (String form is an exponent, not a plain decimal)", () => {
      const cell: Cell = { t: "n", v: 1e21 };
      // Guard against a false positive: this really does stringify to an
      // exponent form that the decimal pattern rejects.
      expect(String(1e21)).toMatch(/e/i);
      expect(() => cellToDecimal(cell)).toThrow();
    });

    it("throws for 1e-7 (below the 1e-6 band; String form is an exponent)", () => {
      const cell: Cell = { t: "n", v: 1e-7 };
      expect(String(1e-7)).toMatch(/e/i);
      expect(() => cellToDecimal(cell)).toThrow();
    });

    it("throws for a value whose decimal string would exceed 40 characters", () => {
      // A double's own shortest round-trip form (String(v)) is always short, so
      // an over-40-char result can only arrive through the display-text path.
      // Here the display text is 1.5 followed by 45 trailing zeros (48 chars):
      // it matches the decimal pattern, differs from String(1.5), and agrees
      // with the stored value to 15 significant digits, so the noise guard
      // selects it — and the length rule then rejects it as too long.
      const w = `1.5${"0".repeat(45)}`;
      // Guard the fixture: it must really be a >40-char plain decimal that the
      // noise guard would otherwise accept, or this test is not exercising the
      // length rule.
      expect(w.length).toBeGreaterThan(40);
      expect(w).toMatch(/^-?[0-9]+(\.[0-9]+)?$/);
      expect(Number(w)).toBe(1.5);
      const cell: Cell = { t: "n", v: 1.5, w };
      expect(() => cellToDecimal(cell)).toThrow();
    });
  });
});
