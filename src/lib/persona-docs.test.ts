import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// Spec 18, Requirements 12 and 13 (Date_Guard). The README and the video
// script must not carry any retired persona date, retired letter id or price
// quoted from a letter before it was resealed. Lives under src/lib (the
// platform-dev test path), not src/test.
const readDoc = (relative: string): string =>
  readFileSync(
    fileURLToPath(new URL(`../../${relative}`, import.meta.url)),
    "utf8",
  );

const DOCS: Record<string, string> = {
  "README.md": readDoc("README.md"),
  "docs/video-script.md": readDoc("docs/video-script.md"),
};

// Old_Persona_Date, spec 18 glossary, at 643aac5a.
const OLD_PERSONA_DATES = [
  "2024-05-12",
  "12 May 2024",
  "12 May",
  "May 2024",
  "2024-11-05",
  "2024-11-05T00:00:00.000Z",
  "5 November 2024",
  "5 Nov 2024",
  "2024-06-09",
  "2024-06-09T00:00:00.000Z",
  "9 June 2024",
  "9 Jun 2024",
];

// Old_Letter_Id, spec 18 glossary: us-maya, eu-tomas, us-priya.
const OLD_LETTER_IDS = [
  "NvKu8C4wTJsMYe8uv1AkAQ",
  "zGQh3PULIzdSxkyu9elzUA",
  "9cvEPNCigWy7H7peQprIWg",
];

// Prices quoted in the pre-reseal letters of Maya and Tomás (spec 18, Current state).
const PRE_RESEAL_PRICES = ["$3.64", "$3.89", "€1.79", "€1.65"];

describe("README and video script carry no retired persona values (spec 18, Date_Guard)", () => {
  for (const [file, text] of Object.entries(DOCS)) {
    it(`${file} contains no Old_Persona_Date`, () => {
      for (const date of OLD_PERSONA_DATES) {
        expect(text, `${file} contains "${date}"`).not.toContain(date);
      }
    });

    it(`${file} contains no Old_Letter_Id`, () => {
      for (const id of OLD_LETTER_IDS) {
        expect(text, `${file} contains "${id}"`).not.toContain(id);
      }
    });

    it(`${file} contains no pre-reseal price`, () => {
      for (const price of PRE_RESEAL_PRICES) {
        expect(text, `${file} contains "${price}"`).not.toContain(price);
      }
    });
  }
});
