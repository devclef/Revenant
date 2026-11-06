// Checks the EU persona letter text (content/personas/letters/eu-tomas.txt).
//
// The letter is plain text, 1 to 5,000 code points, and must pass the same
// text checks as every persona letter (no digits, currency symbols or currency
// words, no election or party terms). The neutrality.md copy test is a human
// review; this file only checks what can be checked mechanically.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { checkLetterText } from "./letter-checks";

const here = dirname(fileURLToPath(import.meta.url));
const LETTER_PATH = resolve(
  here,
  "../../../content/personas/letters/eu-tomas.txt",
);
const KEY = "eu-tomas";

describe("EU persona letter text (eu-tomas.txt)", () => {
  const text = readFileSync(LETTER_PATH, "utf8");

  it("has between 1 and 5,000 code points", () => {
    const length = [...text].length;
    expect(length).toBeGreaterThanOrEqual(1);
    expect(length).toBeLessThanOrEqual(5000);
  });

  it("is not whitespace-only", () => {
    expect(text.trim().length).toBeGreaterThan(0);
  });

  it("passes checkLetterText with no problems", () => {
    expect(checkLetterText(KEY, text)).toEqual([]);
  });
});
