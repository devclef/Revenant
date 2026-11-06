// Feature: 09-demo-polish (Brand_Copy)
//
// Asserts each Brand_Copy string and the row counts, exactly as design.md
// "Copy" gives them.

import { describe, expect, it } from "vitest";
import { BRAND_COPY } from "./copy";

describe("BRAND_COPY", () => {
  it("has the eyebrow and tagline exactly", () => {
    expect(BRAND_COPY.eyebrow).toBe("The wax seal, resurrected.");
    expect(BRAND_COPY.tagline).toBe("Memory rewrites itself. Revenant doesn't.");
  });

  it("has the hero sentence exactly (OD18)", () => {
    expect(BRAND_COPY.heroSentence).toBe(
      "Seal a letter to your future self with real fuel prices from the US or the EU. When it opens, you testify first, then see the receipts.",
    );
  });

  it("has five ritual steps in README order, with their lines", () => {
    expect(BRAND_COPY.ritualSteps).toHaveLength(5);
    expect(BRAND_COPY.ritualSteps).toEqual([
      {
        name: "Write",
        line: "A letter to your future self, plain text, up to 5,000 characters.",
      },
      {
        name: "Seal the figures",
        line: "Fuel prices from official sources, each with its source, period, unit and region.",
      },
      {
        name: "Press the seal",
        line: "Choose an opening date at least three months away and lock it with your passkey.",
      },
      {
        name: "Testify",
        line: "When it opens, say what you remember before a word is shown.",
      },
      {
        name: "See the receipts",
        line: "Your testimony, then what you wrote, then the numbers then and now.",
      },
    ]);
  });

  it("has four seal mapping rows in README order", () => {
    expect(BRAND_COPY.sealMapping).toHaveLength(4);
    expect(BRAND_COPY.sealMapping).toEqual([
      {
        seal: "Wax that shows whether it was broken",
        revenant: "A SHA-256 hash of the sealed envelope, plus the AES-GCM tag",
      },
      {
        seal: "The folded paper that hides the page",
        revenant: "AES-GCM encryption in your browser; the server holds only ciphertext",
      },
      {
        seal: "The signet ring that made it yours",
        revenant: "A passkey (WebAuthn PRF), with an optional backup key card",
      },
      {
        seal: "The archivist who won't open it early",
        revenant: "A server time lock that releases its half of the key on the opening date",
      },
    ]);
  });
});
