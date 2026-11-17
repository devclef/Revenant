// Feature: 14-write-desk, Property 14: The same-period line reads the sealed period string
//
// For any string p, samePeriodLine(p) is the week line when p matches
// ^\d{4}-\d{2}-\d{2}$, the month line when p matches ^\d{4}-\d{2}$, and the
// period line otherwise. The function reads no catalogue.
//
// Validates R7.2.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { REVEAL_COPY } from "./copy";
import { samePeriodLine } from "./same-period";

const WEEK = /^\d{4}-\d{2}-\d{2}$/;
const MONTH = /^\d{4}-\d{2}$/;

const weekArb = fc
  .tuple(
    fc.integer({ min: 0, max: 9999 }),
    fc.integer({ min: 0, max: 99 }),
    fc.integer({ min: 0, max: 99 }),
  )
  .map(
    ([y, m, d]) =>
      `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
  );

const monthArb = fc
  .tuple(fc.integer({ min: 0, max: 9999 }), fc.integer({ min: 0, max: 99 }))
  .map(
    ([y, m]) => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}`,
  );

describe("Property 14: the same-period line reads the sealed period string", () => {
  it("gives the week line for a YYYY-MM-DD period", () => {
    fc.assert(
      fc.property(weekArb, (p) => {
        expect(WEEK.test(p)).toBe(true);
        expect(samePeriodLine(p)).toBe(REVEAL_COPY.samePeriodWeek);
      }),
      { numRuns: 200 },
    );
  });

  it("gives the month line for a YYYY-MM period", () => {
    fc.assert(
      fc.property(monthArb, (p) => {
        expect(MONTH.test(p)).toBe(true);
        expect(samePeriodLine(p)).toBe(REVEAL_COPY.samePeriodMonth);
      }),
      { numRuns: 200 },
    );
  });

  it("gives the period line for any other string", () => {
    fc.assert(
      fc.property(
        fc.string().filter((p) => !WEEK.test(p) && !MONTH.test(p)),
        (p) => {
          expect(samePeriodLine(p)).toBe(REVEAL_COPY.samePeriodOther);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("uses three distinct lines, one per period type", () => {
    const lines = new Set([
      REVEAL_COPY.samePeriodWeek,
      REVEAL_COPY.samePeriodMonth,
      REVEAL_COPY.samePeriodOther,
    ]);
    expect(lines.size).toBe(3);
  });

  it("reads no catalogue, figure or database module", () => {
    // Scan the code only: the header comment describes the rule in words.
    const source = readFileSync(join(__dirname, "same-period.ts"), "utf8");
    const code = source
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    const imports = [...code.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    expect(imports).toEqual(["./copy"]);
    expect(code).not.toMatch(/catalogue|@\/lib\/figures|@\/lib\/db|crypto/i);
  });
});
