// Feature: 08-judge-polish (R18)
//
// Markup and source tests for the How_Page at /how-it-is-sealed. Rendered with
// `renderToStaticMarkup` in the node environment, like the other page tests.
// They check that each R18.1 to R18.5 statement is on the page, that there is
// exactly one h1, and that the page's source imports nothing from lib/crypto,
// lib/cards or lib/ics (R18.7).

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BRAND_COPY } from "@/components/brand/copy";
import { HOW_COPY } from "@/components/how/copy";

import HowItIsSealedPage from "./page";

const here = dirname(fileURLToPath(import.meta.url));
const html = renderToStaticMarkup(createElement(HowItIsSealedPage));

function sectionBody(id: string): string {
  const section = HOW_COPY.sections.find((s) => s.id === id);
  if (!section) throw new Error(`missing section ${id}`);
  return section.body;
}

describe("How_Page headings", () => {
  it("renders exactly one h1 with the page heading", () => {
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).toContain(`>${HOW_COPY.heading}</h1>`);
  });

  it("opens with the seal heading and the Seal_Mapping table before any section", () => {
    expect(HOW_COPY.heading).toBe("How the seal works");
    const h1At = html.indexOf(`>${HOW_COPY.heading}</h1>`);
    const tableAt = html.indexOf("<table");
    const firstSectionAt = html.indexOf("<h2");
    expect(h1At).toBeGreaterThanOrEqual(0);
    expect(tableAt).toBeGreaterThan(h1At);
    expect(firstSectionAt).toBeGreaterThan(tableAt);
  });

  it("renders the four Seal_Mapping rows from Brand_Copy with the column headers", () => {
    const text = html.replace(/&#x27;/g, "'");
    expect(html.match(/<tbody>[\s\S]*<\/tbody>/)?.[0].match(/<tr>/g)).toHaveLength(4);
    expect(text).toContain(HOW_COPY.mappingHeaders.seal);
    expect(text).toContain(HOW_COPY.mappingHeaders.revenant);
    for (const row of BRAND_COPY.sealMapping) {
      expect(text).toContain(row.seal);
      expect(text).toContain(row.revenant);
    }
  });

  it("renders the six section headings as h2", () => {
    expect(html.match(/<h2[\s>]/g)).toHaveLength(6);
    for (const section of HOW_COPY.sections) {
      expect(html).toContain(`>${section.title}</h2>`);
    }
  });
});

describe("How_Page statements (R18.1 to R18.5)", () => {
  it("R18.1: the browser encrypts before sending, the server stores only the envelope, header and time-lock secret", () => {
    const body = sectionBody("browser-seals");
    expect(html).toContain(body);
    expect(body).toContain("encrypts the letter before anything is sent");
    expect(body).toContain("encrypted envelope");
    expect(body).toContain("unencrypted header");
    expect(body).toContain("time-lock secret");
  });

  it("R18.1: the server releases the time-lock secret only at or after the opening date, by its own clock", () => {
    const body = sectionBody("server-clock");
    expect(html).toContain(body);
    expect(body).toContain(
      "releases the time-lock secret only when its own clock is at or after the opening date",
    );
  });

  it("R18.1 and the date limitation: the DST limitation is stated in one sentence", () => {
    const body = sectionBody("server-clock");
    expect(body).toContain(
      "daylight saving time changes between sealing and opening",
    );
    expect(body).toContain("last hour before local midnight");
  });

  it("R18.2: passkey and backup key each open only after the date, and a lost passkey with no backup key loses the letter", () => {
    const body = sectionBody("two-ways-in");
    expect(html).toContain(body);
    expect(body).toContain(
      "Your passkey and your backup key can each open the letter",
    );
    expect(body).toContain("but only after the opening date");
    expect(body).toContain("Neither opens it before");
    expect(body).toContain(
      "A lost passkey with no backup key means the letter is lost",
    );
  });

  it("R18.3: opening needs this server, and sealed letters cannot open if the service or its database is gone", () => {
    const body = sectionBody("needs-revenant");
    expect(html).toContain(body);
    expect(body).toContain(
      "this Revenant server must release its time-lock secret",
    );
    expect(body).toContain(
      "If the service or its database is gone, sealed letters cannot be opened",
    );
  });

  it("R18.4: the Fingerprint is printed on the letter card, shown at opening, and 16 matching groups mean no change", () => {
    const body = sectionBody("fingerprint");
    expect(html).toContain(body);
    expect(body).toContain("printed on your letter card");
    expect(body).toContain("shown again when you open the letter");
    expect(body).toContain("all 16 groups match");
    expect(body).toContain("has not changed since it was sealed");
  });

  it("R18.5: letters sealed on revenant.devclef.se count as test letters", () => {
    const body = sectionBody("test-letters");
    expect(html).toContain(body);
    expect(body).toContain(
      "Letters sealed on revenant.devclef.se count as test letters",
    );
  });
});

describe("How_Page wordmark link (R3.4, R11.2)", () => {
  it("links the wordmark to the landing page", () => {
    const wordmark = /<a\b[^>]*data-wordmark[^>]*>/.exec(html)?.[0] ?? "";
    expect(wordmark).toContain('href="/"');
  });
});

describe("How_Page copy rules (R18.6)", () => {
  it("has no exclamation marks in any rendered text", () => {
    expect(HOW_COPY.heading).not.toContain("!");
    for (const section of HOW_COPY.sections) {
      expect(section.title).not.toContain("!");
      expect(section.body).not.toContain("!");
    }
    expect(html).not.toContain("!");
  });
});

describe("How_Page imports (R18.7)", () => {
  it("imports nothing from lib/crypto, lib/cards or lib/ics", () => {
    const source = readFileSync(resolve(here, "page.tsx"), "utf8");
    const imports =
      source.match(/from\s+["'][^"']+["']|import\s+["'][^"']+["']/g) ?? [];
    expect(imports.length).toBeGreaterThan(0);
    for (const line of imports) {
      expect(line).not.toMatch(/lib\/crypto|lib\/cards|lib\/ics/);
    }
  });

  it("is a server component with no client directive of its own", () => {
    const source = readFileSync(resolve(here, "page.tsx"), "utf8");
    expect(source).not.toMatch(/["']use client["']/);
  });
});
