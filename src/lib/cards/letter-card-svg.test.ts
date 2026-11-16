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

// Seal input (U4.3, T1.5): the optional seal sits top right of the title row,
// the QR moves down, the card grows from 560 to 608, and the contents do not change.
function cardWith(seal?: { hash: string }): string {
  return letterCardSvg({
    qr: qrPath(encodeQr(LINK, "M")),
    title: "Letter card",
    opensLabel: "Opens 30 October 2026, 12:00 CET",
    link: LINK,
    fingerprintLabel: "Fingerprint at sealing",
    fingerprint: formatFingerprint(HASH) as string,
    seal,
  });
}

function viewBoxHeight(svg: string): number {
  const match = svg.match(/viewBox="0 0 480 (\d+)"/);
  if (!match) throw new Error("no viewBox");
  return Number(match[1]);
}

/** Every <text> element as its y attribute and content, in document order. */
function textLines(svg: string): { y: number; content: string }[] {
  return [...svg.matchAll(/<text [^>]*\by="([\d.]+)"[^>]*>([^<]*)<\/text>/g)].map(
    (m) => ({ y: Number(m[1]), content: m[2] }),
  );
}

describe("letterCardSvg seal input", () => {
  it("keeps the plain 560 card when no seal is passed", () => {
    const svg = cardWith();
    expect(viewBoxHeight(svg)).toBe(560);
    expect(svg).toContain('height="560"');
    expect(svg).not.toContain("scale(0.72)");
  });

  it("grows the card to 608 when a seal is passed", () => {
    const svg = cardWith({ hash: HASH });
    expect(viewBoxHeight(svg)).toBe(608);
    expect(svg).toContain('height="608"');
    expect(svg).toContain('width="480"');
  });

  it("draws the seal 72 units across at the top right of the title row", () => {
    const svg = cardWith({ hash: HASH });
    // Top left corner at (376, 32): right edge 448 is the right padding, top 32 is the top padding.
    expect(svg).toContain('<g transform="translate(376 32) scale(0.72)">');
    // The title baseline (y 52) sits inside the seal's vertical span (32 to 104).
    const title = textLines(svg).find((t) => t.content === "Letter card");
    expect(title?.y).toBe(52);
    expect(title!.y).toBeGreaterThanOrEqual(32);
    expect(title!.y).toBeLessThanOrEqual(104);
  });

  it("moves the QR down 48 units and keeps it clear of the seal", () => {
    const plain = cardWith();
    const sealed = cardWith({ hash: HASH });
    expect(plain).toContain("translate(32 68)");
    expect(sealed).toContain("translate(32 116)");
    // The seal ends at y 104 (32 + 72); the QR starts at y 116, so they never overlap.
    expect(sealed).toContain("translate(376 32) scale(0.72)");
  });

  it("keeps every text line's content the same, shifting only the lines below the title by 48", () => {
    const plain = textLines(cardWith());
    const sealed = textLines(cardWith({ hash: HASH }));
    expect(sealed.map((t) => t.content)).toEqual(plain.map((t) => t.content));
    plain.forEach((line, i) => {
      const shift = line.content === "Letter card" ? 0 : 48;
      expect(sealed[i].y).toBe(line.y + shift);
    });
  });

  it("draws the Fingerprint text unchanged in content and groups", () => {
    const fingerprint = formatFingerprint(HASH) as string;
    const contents = textLines(cardWith({ hash: HASH })).map((t) => t.content);
    expect(contents).toContain("FINGERPRINT AT SEALING");
    expect(contents).toContain(fingerprint.split(" ").slice(0, 8).join(" "));
    expect(contents).toContain(fingerprint.split(" ").slice(8).join(" "));
  });

  it("draws the seal with literal colours and no clip path or CSS variables", () => {
    const svg = cardWith({ hash: HASH });
    expect(svg).not.toContain("var(");
    expect(svg).not.toContain("clipPath");
    expect(svg).not.toMatch(/<animate|<style/);
    expect(svg).not.toMatch(/<image\b/);
  });

  it("gives a different seal for a different hash", () => {
    const other = "f".repeat(64);
    expect(cardWith({ hash: other })).not.toBe(cardWith({ hash: HASH }));
  });
});
