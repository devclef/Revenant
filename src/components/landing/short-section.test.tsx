// Feature: 16 (task 15, 16.15.1 to 16.15.4)
//
// Checks the short "What we resurrected" section on the home page: its sentence
// count, its sentence length, the maker's story and the absence of the seal
// mapping table from `/`.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import Home from "@/app/page";
import { BRAND_COPY } from "@/components/brand/copy";

import { LANDING_SECTION_COPY } from "./copy";
import { ResurrectionSection } from "./ResurrectionSection";

// page.tsx imports feature-flags.ts, which imports `server-only`.
vi.mock("server-only", () => ({}));

/** Splits prose into sentences on ., ! or ?, dropping empty pieces. */
function sentencesOf(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
}

/** The short section's prose: the wax seal sentence, then the no-seal sentences. */
const shortSectionText = [
  ...LANDING_SECTION_COPY.resurrectedBody,
  LANDING_SECTION_COPY.noSealBody,
].join(" ");

describe("16.15.1 the short section", () => {
  it("has at most three sentences", () => {
    expect(sentencesOf(shortSectionText).length).toBeLessThanOrEqual(3);
  });

  it("has at most 25 words in each sentence", () => {
    for (const sentence of sentencesOf(shortSectionText)) {
      expect(sentence.split(/\s+/).length).toBeLessThanOrEqual(25);
    }
  });

  it("renders the short section's sentences on the page", () => {
    const html = renderToStaticMarkup(createElement(ResurrectionSection));
    for (const sentence of sentencesOf(shortSectionText)) {
      expect(html).toContain(sentence);
    }
  });
});

describe("16.15.4 the maker's story", () => {
  it("has at most two sentences", () => {
    expect(sentencesOf(LANDING_SECTION_COPY.makerBody).length).toBeLessThanOrEqual(2);
  });

  it("has at most 25 words in each sentence", () => {
    for (const sentence of sentencesOf(LANDING_SECTION_COPY.makerBody)) {
      expect(sentence.split(/\s+/).length).toBeLessThanOrEqual(25);
    }
  });
});

describe("16.15.3 no seal mapping table on the home page", () => {
  const html = renderToStaticMarkup(createElement(Home));

  it("renders no table element", () => {
    expect(html).not.toContain("<table");
  });

  it("renders no seal mapping row", () => {
    for (const row of BRAND_COPY.sealMapping) {
      expect(html).not.toContain(`<td>${row.seal}</td>`);
    }
  });
});
