// Tests for the standalone letter-card SVG (spec 08 R14.1, R14.2, R14.4, R14.7).
// The saved image must be pure vector markup: one QR path plus text, no raster
// image, no third-party asset. And the Fingerprint it draws must be the exact
// value the Reveal shows for the same hash (Property 16).

import { describe, expect, it } from "vitest";
import fc from "fast-check";

import { encodeQr } from "./qr/encode";
import { qrPath } from "./qr-svg";
import { escapeXml, letterCardSvg } from "./letter-card-svg";
import { formatFingerprint } from "@/lib/seal-format";

const LINK = "https://revenant.devclef.se/l/k7q2m9x4p1";
const HASH = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

// 64 lowercase hex characters, the shape of an envelope hash.
const hexHashArb: fc.Arbitrary<string> = fc
  .array(fc.constantFrom(..."0123456789abcdef".split("")), { minLength: 64, maxLength: 64 })
  .map((chars) => chars.join(""));

function card(fingerprint: string, link = LINK): string {
  return letterCardSvg({
    qr: qrPath(encodeQr(link, "M")),
    title: "Letter card",
    opensLabel: "Opens 30 October 2026, 12:00 CET",
    link,
    fingerprintLabel: "Fingerprint at sealing",
    fingerprint,
  });
}

describe("letterCardSvg", () => {
  it("is one self-contained svg element", () => {
    const svg = card(formatFingerprint(HASH) as string);
    expect(svg.startsWith("<svg ")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it("adds no raster image and no external asset", () => {
    const svg = card(formatFingerprint(HASH) as string);
    // No <image>, no href to a bitmap, no data: URL, no http(s) asset load.
    expect(svg).not.toMatch(/<image\b/);
    expect(svg).not.toMatch(/xlink:href|\bhref=/);
    expect(svg).not.toMatch(/data:image/);
  });

  it("draws the QR as a single path", () => {
    const svg = card(formatFingerprint(HASH) as string);
    expect((svg.match(/<path\b/g) ?? []).length).toBe(1);
  });

  it("draws the opening date, the link and the Fingerprint label and groups", () => {
    const fingerprint = formatFingerprint(HASH) as string;
    const svg = card(fingerprint);
    expect(svg).toContain("Opens 30 October 2026, 12:00 CET");
    expect(svg).toContain(LINK);
    // The fingerprint is drawn across two lines of 8 groups.
    const groups = fingerprint.split(" ");
    expect(svg).toContain(groups.slice(0, 8).join(" "));
    expect(svg).toContain(groups.slice(8).join(" "));
  });

  it("escapes a value with XML-significant characters", () => {
    const svg = card(formatFingerprint(HASH) as string, "https://x/l/a&b<c>");
    expect(svg).toContain("a&amp;b&lt;c&gt;");
    expect(svg).not.toContain("a&b<c>");
  });

  it("holds no key fragment", () => {
    const svg = card(formatFingerprint(HASH) as string);
    expect(svg).not.toContain("#k=");
  });
});

describe("escapeXml", () => {
  it("escapes the five XML-significant characters", () => {
    expect(escapeXml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&apos;");
  });
});

// Property 16 (the card and the Reveal show the same Fingerprint): both the
// card SVG and the opening Fingerprint block format the hash through the one
// `formatFingerprint` module, so for any valid hash the groups the card draws
// equal the groups the Reveal shows.
describe("Property 16: the card Fingerprint equals the Reveal Fingerprint", () => {
  it("draws the same 16 groups the Reveal shows for the same hash", () => {
    fc.assert(
      fc.property(hexHashArb, (hash) => {
        const fingerprint = formatFingerprint(hash);
        // The Reveal (Fingerprint.tsx) renders this exact string; a valid hash
        // always formats.
        expect(fingerprint).not.toBeNull();
        const svg = card(fingerprint as string);
        const groups = (fingerprint as string).split(" ");
        // Every group the Reveal shows is present in the card.
        for (const group of groups) {
          expect(svg).toContain(group);
        }
      }),
      { numRuns: 100 },
    );
  });
});
