// Checks that each persona letter states exactly the Letter_Price_Line numbers
// its sealed figures give (spec 10 design.md, "C5. Sample answers"; issue #307,
// P1). The expected numbers come from expectedPrices, which uses the same
// Record_Candidate function as the Testify field.
//
// Every price is written once, and no other digit or currency symbol appears
// anywhere in the letter.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { PERSONAS } from "./index";
import { PRICE_RE, expectedPrices } from "./price-lines";

const here = dirname(fileURLToPath(import.meta.url));
const PERSONAS_DIR = resolve(here, "../../../content/personas");

/** Any digit or currency symbol that is not part of a matched price phrase. */
const DIGIT_OR_CURRENCY = /[0-9$€£¥]/;

function readLetter(letterPath: string): string {
  return readFileSync(resolve(PERSONAS_DIR, letterPath), "utf8");
}

function pricesIn(text: string): string[] {
  return [...text.matchAll(PRICE_RE)].map((m) => m[1]);
}

describe.each(PERSONAS.map((persona) => [persona.key, persona] as const))(
  "price lines in %s",
  (_key, persona) => {
    const text = readLetter(persona.letter_path);
    const expected = expectedPrices(persona);

    it("states exactly the expected prices, in metric order", () => {
      expect(pricesIn(text)).toEqual(expected);
    });

    it("states each expected price once", () => {
      const found = pricesIn(text);
      for (const price of expected) {
        expect(found.filter((p) => p === price)).toHaveLength(1);
      }
    });

    it("has no digit or currency symbol outside the price phrases", () => {
      const rest = text.replace(PRICE_RE, "");
      expect(rest).not.toMatch(DIGIT_OR_CURRENCY);
    });
  },
);
