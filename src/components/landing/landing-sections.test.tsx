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
  it("renders the story heading, the one-sentence story and the no-seal sentences", () => {
    const html = render(<ResurrectionSection />);
    expect(html).toContain(LANDING_SECTION_COPY.resurrectedTitle);
    expect(LANDING_SECTION_COPY.resurrectedBody).toHaveLength(1);
    expect(html).toContain(LANDING_SECTION_COPY.resurrectedBody[0]);
    expect(html).toContain(LANDING_SECTION_COPY.noSealBody);
  });

  it("holds at most three sentences for the story and the no-seal text (16.15.1)", () => {
    const text = [...LANDING_SECTION_COPY.resurrectedBody, LANDING_SECTION_COPY.noSealBody].join(" ");
    expect(sentenceCount(text)).toBeLessThanOrEqual(3);
  });

  it("ends with the maker's story under 'Why I built it' with at most two sentences (16.15.4)", () => {
    const html = render(<ResurrectionSection />);
    expect(LANDING_SECTION_COPY.makerTitle).toBe("Why I built it");
    expect(html).toMatch(/<h3[^>]*>Why I built it<\/h3>/);
    expect(html.indexOf("Why I built it")).toBeGreaterThan(html.indexOf(LANDING_SECTION_COPY.noSealBody));
    expect(html).toContain(LANDING_SECTION_COPY.makerBody);
    expect(sentenceCount(LANDING_SECTION_COPY.makerBody)).toBeLessThanOrEqual(2);
  });

  it("keeps every sentence of the section at 25 words or fewer", () => {
    const text = [
      ...LANDING_SECTION_COPY.resurrectedBody,
      LANDING_SECTION_COPY.noSealBody,
      LANDING_SECTION_COPY.makerBody,
    ].join(" ");
    const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0);
    for (const sentence of sentences) {
      expect(sentence.split(/\s+/).length).toBeLessThanOrEqual(25);
      expect(sentence).not.toContain("!");
    }
  });

  it("renders no seal mapping table on the home page (16.15.3)", () => {
    const html = render(<ResurrectionSection />);
    expect(html).not.toContain("<table");
    expect(html).not.toContain("data-block=\"seal-mapping\"");
    expect(html).not.toContain(BRAND_COPY.sealMapping[0].seal);
  });

  it("names no historical number or date, so it links to no source", () => {
    const html = render(<ResurrectionSection />);
    expect(html).not.toMatch(/\b1[67]\d\d\b/);
    expect(html).not.toContain("<a ");
  });

  it("holds no banned word", () => {
    const text = [
      ...LANDING_SECTION_COPY.resurrectedBody,
      LANDING_SECTION_COPY.noSealBody,
      LANDING_SECTION_COPY.makerBody,
    ]
      .join(" ")
      .toLowerCase();
    for (const word of BANNED) expect(text).not.toContain(word);
  });

  it("names no fuel price as what a letter holds", () => {
    const text = [
      ...LANDING_SECTION_COPY.resurrectedBody,
      LANDING_SECTION_COPY.noSealBody,
      LANDING_SECTION_COPY.makerBody,
    ]
      .join(" ")
      .toLowerCase();
    expect(text).not.toMatch(/fuel|gallon|petrol|gasoline/);
  });
});

describe("NoSealSection", () => {
  it("renders nothing; its text sits in ResurrectionSection (16.15.2)", () => {
    expect(render(<NoSealSection />)).toBe("");
    expect(render(<ResurrectionSection />)).not.toContain("What no wax seal could do");
  });

  it("uses at most three sentences and no banned word", () => {
    expect(sentenceCount(LANDING_SECTION_COPY.noSealBody)).toBeLessThanOrEqual(2);
    const body = LANDING_SECTION_COPY.noSealBody.toLowerCase();
    for (const word of BANNED) expect(body).not.toContain(word);
  });
});
