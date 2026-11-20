// Static-markup tests for LetterCard (spec 06, task 11; R20.1, R20.2).
// The card shows a QR of the letter link, the opening time and the link as
// text, and a print control hidden in print by .noPrint. It holds no key.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEMO_COPY } from "@/components/demo/copy";
import { WaxSeal, normaliseWaxSealIds } from "@/components/ui/WaxSeal";
import { formatFingerprint } from "@/lib/seal-format";

import { LIVE_COPY } from "./copy";
import { formatLocalDateTime } from "./format";
import { LetterCard } from "./LetterCard";
import styles from "./live.module.css";

const APP_ORIGIN = "https://revenant.devclef.se";
const LETTER_ID = "abc123DEF456ghi789jk";
const OPENS_AT = "2026-11-02T12:00:00.000Z";
const ENVELOPE_HASH =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

function html(): string {
  return renderToStaticMarkup(
    createElement(LetterCard, {
      letterId: LETTER_ID,
      appOrigin: APP_ORIGIN,
      opensAt: OPENS_AT,
      envelopeHash: ENVELOPE_HASH,
    }),
  );
}

describe("LetterCard", () => {
  it("shows the card heading and the Demo label", () => {
    const out = html();
    expect(out).toContain(LIVE_COPY.letterCardTitle);
    expect(out).toContain(DEMO_COPY.demoLabel);
  });

  it("shows the opening time through LIVE_COPY.letterCardOpens", () => {
    const out = html();
    expect(out).toContain(LIVE_COPY.letterCardOpens.replace("{time}", formatLocalDateTime(OPENS_AT)));
    expect(out).not.toContain("{time}");
  });

  it("shows the link as text, built from APP_ORIGIN and the letter id", () => {
    expect(html()).toContain(`${APP_ORIGIN}/l/${LETTER_ID}`);
  });

  it("draws the QR code as an SVG with a single path and crisp edges", () => {
    const out = html();
    // The QR svg is the one under data-live-card-qr. The seal beside it adds paths of its own.
    const qr = out.slice(out.indexOf("data-live-card-qr"), out.indexOf("</svg>", out.indexOf("data-live-card-qr")));
    expect(out).toContain("<svg");
    expect(qr.match(/<path/g)).toHaveLength(1);
    expect(qr).toContain('shape-rendering="crispEdges"');
  });

  it("hides the QR from assistive tech, since the link text sits beside it", () => {
    expect(html()).toMatch(/data-live-card-qr="" aria-hidden="true"|aria-hidden="true" data-live-card-qr/);
  });

  it("offers a print button marked with the noPrint class", () => {
    const out = html();
    expect(out).toContain(LIVE_COPY.printCard);
    expect(out).toContain("data-live-print");
    expect(out).toContain(styles.noPrint);
  });

  it("prints the Fingerprint under the link, the same groups the Reveal shows", () => {
    const out = html();
    expect(out).toContain(LIVE_COPY.letterCardFingerprint);
    const fingerprint = formatFingerprint(ENVELOPE_HASH) as string;
    expect(out).toContain(fingerprint);
    const linkAt = out.indexOf(`${APP_ORIGIN}/l/${LETTER_ID}`);
    const fpAt = out.indexOf("data-live-card-fingerprint");
    expect(fpAt).toBeGreaterThan(linkAt);
  });

  it("offers Save the card as an image inside the print-hidden group", () => {
    const out = html();
    expect(out).toContain(LIVE_COPY.saveCardImage);
    expect(out).toContain("data-live-save-image");
    const at = out.indexOf("data-live-save-image");
    expect(out.lastIndexOf(styles.noPrint, at)).toBeGreaterThan(-1);
  });

  it("holds no key, fragment or sensitive text", () => {
    const out = html();
    expect(out).not.toContain("#k=");
    expect(out).not.toMatch(/[A-Z0-9]{4}-[A-Z0-9]{4}/);
    expect(out).not.toContain("<script");
  });

  it("marks the card with data-seal-hash, the hash the seal was drawn from", () => {
    const out = html();
    expect(out).toContain(`data-seal-hash="${ENVELOPE_HASH}"`);
  });

  it("draws the seal through WaxSeal, hidden from assistive tech", () => {
    const out = html();
    const seal = /<svg[^>]*data-seal-hash="[^"]*"[^>]*>/.exec(out);
    expect(seal).not.toBeNull();
    expect(seal?.[0]).toContain('aria-hidden="true"');
  });

  it("draws the same relief as WaxSeal for the same hash (U4.1, U4.2)", () => {
    const out = html();
    const card = /<svg[^>]*data-seal-hash="[^"]*"[^>]*>[\s\S]*?<\/svg>/.exec(out)?.[0];
    expect(card).toBeDefined();
    const page = renderToStaticMarkup(createElement(WaxSeal, { hash: ENVELOPE_HASH, size: 72 }));
    // The card adds its own class (cardSeal) to the root; compare the drawn layers and the hash.
    const layers = (svg: string): string => normaliseWaxSealIds(svg.replace(/^<svg[^>]*>/, ""));
    expect(layers(card as string)).toBe(layers(page));
    const hashOf = (svg: string): string | undefined => /data-seal-hash="([^"]*)"/.exec(svg)?.[1];
    expect(hashOf(card as string)).toBe(hashOf(page));
  });

  it("draws the Blank_Signet and no data-seal-hash for a malformed hash (U5.1)", () => {
    const out = renderToStaticMarkup(
      createElement(LetterCard, {
        letterId: LETTER_ID,
        appOrigin: APP_ORIGIN,
        opensAt: OPENS_AT,
        envelopeHash: "not-a-hash",
      }),
    );
    expect(out).not.toContain("data-seal-hash");
    expect(out).toContain("<svg");
  });
});
