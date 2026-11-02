// Static-markup tests for LetterCard (spec 06, task 11; R20.1, R20.2).
// The card shows a QR of the letter link, the opening time and the link as
// text, and a print control hidden in print by .noPrint. It holds no key.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEMO_COPY } from "@/components/demo/copy";

import { LIVE_COPY } from "./copy";
import { formatLocalDateTime } from "./format";
import { LetterCard } from "./LetterCard";
import styles from "./live.module.css";

const APP_ORIGIN = "https://revenant.devclef.se";
const LETTER_ID = "abc123DEF456ghi789jk";
const OPENS_AT = "2026-11-02T12:00:00.000Z";

function html(): string {
  return renderToStaticMarkup(
    createElement(LetterCard, { letterId: LETTER_ID, appOrigin: APP_ORIGIN, opensAt: OPENS_AT }),
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
    expect(out).toContain("<svg");
    expect(out.match(/<path/g)).toHaveLength(1);
    expect(out).toContain('shape-rendering="crispEdges"');
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

  it("holds no key, fragment or sensitive text", () => {
    const out = html();
    expect(out).not.toContain("#k=");
    expect(out).not.toMatch(/[A-Z0-9]{4}-[A-Z0-9]{4}/);
    expect(out).not.toContain("<script");
  });
});
