// Feature: 09-demo-polish (B3.2, F6.1, F6.2, F6.3)
//
// Render tests for the three below-the-fold sections and their copy: the
// ritual cards, the pli cacheté story with the seal table, and the no-seal
// section. Checks sentence limits, banned words and the absence of a link to
// a historical date or number.

import type React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BRAND_COPY } from "@/components/brand/copy";

import { LANDING_SECTION_COPY } from "./copy";
import { NoSealSection } from "./NoSealSection";
import { ResurrectionSection } from "./ResurrectionSection";
import { RitualSection } from "./RitualSection";

const BANNED = [
  "cross-examine",
  "caught",
  "wrong",
  "misremembered",
  "rose-tinted",
];

/** Decodes the apostrophe React escapes in server markup. */
function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element).replace(/&#x27;/g, "'");
}

function sentenceCount(text: string): number {
  return text.split(/[.!?]+/).filter((s) => s.trim().length > 0).length;
}

describe("RitualSection", () => {
  it("renders four cards with number, name and line from Brand_Copy", () => {
    const html = render(<RitualSection />);
    expect(html.match(/<li class="[^"]*ritualCard/g)?.length).toBe(4);
    BRAND_COPY.ritualSteps.forEach((step, index) => {
      expect(html).toContain(step.name);
      expect(html).toContain(step.line);
      expect(html).toContain(`>${index + 1}<`);
    });
  });

  it("has no arch, gravestone, moon, bat, cobweb or arrow", () => {
    const html = render(<RitualSection />).toLowerCase();
    for (const prop of ["arch", "gravestone", "moon", "bat", "cobweb", "arrow", "→"]) {
      expect(html).not.toContain(prop);
    }
  });
});

describe("ResurrectionSection", () => {
  it("renders the story heading and at most four sentences", () => {
    const html = render(<ResurrectionSection />);
    expect(html).toContain(LANDING_SECTION_COPY.resurrectedTitle);
    expect(LANDING_SECTION_COPY.resurrectedBody.length).toBeLessThanOrEqual(4);
    const text = LANDING_SECTION_COPY.resurrectedBody.join(" ");
    expect(sentenceCount(text)).toBeLessThanOrEqual(4);
  });

  it("renders the four Seal_Mapping rows from Brand_Copy", () => {
    const html = render(<ResurrectionSection />);
    expect(html.match(/<tbody>[\s\S]*<\/tbody>/)?.[0].match(/<tr>/g)?.length).toBe(4);
    for (const row of BRAND_COPY.sealMapping) {
      expect(html).toContain(row.seal);
      expect(html).toContain(row.revenant);
    }
  });

  it("names no historical number or date, so it links to no source", () => {
    const html = render(<ResurrectionSection />);
    expect(html).not.toMatch(/\b1[67]\d\d\b/);
    expect(html).not.toContain("<a ");
  });

  it("holds no banned word", () => {
    const text = LANDING_SECTION_COPY.resurrectedBody.join(" ").toLowerCase();
    for (const word of BANNED) expect(text).not.toContain(word);
  });
});

describe("NoSealSection", () => {
  it("renders the title and body", () => {
    const html = render(<NoSealSection />);
    expect(html).toContain("What no wax seal could do");
    expect(html).toContain(LANDING_SECTION_COPY.noSealBody);
  });

  it("uses at most three sentences and no banned word", () => {
    expect(sentenceCount(LANDING_SECTION_COPY.noSealBody)).toBeLessThanOrEqual(3);
    const body = LANDING_SECTION_COPY.noSealBody.toLowerCase();
    for (const word of BANNED) expect(body).not.toContain(word);
  });
});
