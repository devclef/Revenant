import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const read = (relative: string) => readFileSync(resolve(here, relative), "utf8");

const sceneCss = read("scene.module.css");
const receiptsCss = read("../../reveal/receipts.module.css");

// The wide-layout block: from the 900 px media query to its closing brace at column 0.
const mediaStart = sceneCss.indexOf("@media (min-width: 900px)");
const mediaEnd = sceneCss.indexOf("\n}\n", mediaStart);
const wideBlock = mediaStart >= 0 && mediaEnd > mediaStart ? sceneCss.slice(mediaStart, mediaEnd) : "";

// The declaration body of the `.receipts` rule (not `.receiptsX` or a grouped selector).
const receiptsRule = receiptsCss.match(/(?:^|\n)\.receipts\s*\{([^}]*)\}/);

describe("shared content column width (spec 15 D3, #580)", () => {
  it("keeps min(34rem, 46vw) inside the 900 px media query", () => {
    expect(mediaStart).toBeGreaterThanOrEqual(0);
    expect(wideBlock).toMatch(/--content-column-max:\s*min\(34rem,\s*46vw\)\s*;/);
  });

  it("sets the narrow default to min(34rem, 100%) outside the media query", () => {
    const defaultMatch = sceneCss.match(/--content-column-max:\s*min\(34rem,\s*100%\)\s*;/);
    expect(defaultMatch).not.toBeNull();
    expect(defaultMatch?.index ?? Infinity).toBeLessThan(mediaStart);
  });

  it("makes the receipts column use var(--content-column-max) with no other max-width", () => {
    expect(receiptsRule).not.toBeNull();
    const body = receiptsRule?.[1] ?? "";
    expect(body).toMatch(/max-inline-size:\s*var\(--content-column-max\)\s*;/);
    expect(body).not.toMatch(/max-(inline-)?width:\s*(?!var\(--content-column-max\))/);
  });

  it.each([
    ["Reveal.tsx", "../../reveal/Reveal.tsx"],
    ["RecallStep.tsx", "../../reveal/RecallStep.tsx"],
    ["WriteDesk.tsx", "../../live/desk/WriteDesk.tsx"],
    ["SealStep.tsx", "../../live/seal-step/SealStep.tsx"],
  ])("%s marks its column with data-content-column", (_name, relative) => {
    expect(read(relative)).toMatch(/data-content-column=""/);
  });
});

describe("live Write row inset on a phone (spec 15 D3, #580)", () => {
  const deskCss = read("../../live/desk/desk.module.css");
  const phoneStart = deskCss.indexOf("@media (max-width: 599px)");
  const phoneEnd = deskCss.indexOf("\n}\n", phoneStart);
  const phoneBlock = phoneStart >= 0 && phoneEnd > phoneStart ? deskCss.slice(phoneStart, phoneEnd) : "";

  it("keeps the 32 px desktop container padding outside the phone query", () => {
    const base = deskCss.slice(0, phoneStart);
    expect(base).toMatch(/\.container\s*\{[^}]*padding-inline:\s*32px\s*;/);
  });

  it("uses 24 px side padding on a phone, so the panel is the viewport minus 48 px", () => {
    expect(phoneBlock).toMatch(/\.container\s*\{[^}]*padding-inline:\s*24px\s*;/);
  });
});
