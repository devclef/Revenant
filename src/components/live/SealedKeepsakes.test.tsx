// Static-markup tests for SealedKeepsakes and its place on SealedView (spec 06,
// task 11; R20.1, R20.5, R20.6). The page makes no server call for a card or a
// calendar file, so the tests spy on fetch and expect no call.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { formatFingerprint } from "@/lib/seal-format";

import { LIVE_COPY } from "./copy";
import { buildKeepsakeIcs } from "./keepsake-files";
import styles from "./live.module.css";
import { SealedKeepsakes } from "./SealedKeepsakes";
import { SealedView, type SealedState } from "./SealedView";

const APP_ORIGIN = "https://revenant.devclef.se";
const LETTER_ID = "abc123DEF456ghi789jk";
const NOW_MS = Date.parse("2026-11-02T12:00:00.000Z");
const OPENS_AT = "2026-11-02T13:00:00.000Z";
const ENVELOPE_HASH =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const keepsakesHtml = (): string =>
  renderToStaticMarkup(
    createElement(SealedKeepsakes, {
      letterId: LETTER_ID,
      appOrigin: APP_ORIGIN,
      opensAt: OPENS_AT,
      envelopeHash: ENVELOPE_HASH,
    }),
  );

const sealedState: SealedState = {
  tag: "sealed",
  letterId: LETTER_ID,
  sealedAt: new Date(NOW_MS).toISOString(),
  opensAt: OPENS_AT,
  offsetMs: 0,
  factors: "passkey",
  envelopeHash: ENVELOPE_HASH,
};

describe("SealedKeepsakes", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("offers the letter card and the calendar download", () => {
    const out = keepsakesHtml();
    expect(out).toContain(LIVE_COPY.letterCardTitle);
    expect(out).toContain(LIVE_COPY.downloadIcs);
    expect(out).toContain("data-live-ics");
  });

  it("prints the sealing Fingerprint as 16 groups under the link", () => {
    const out = keepsakesHtml();
    expect(out).toContain(LIVE_COPY.letterCardFingerprint);
    expect(out).toContain(formatFingerprint(ENVELOPE_HASH) as string);
    // The Fingerprint sits after the link text in the card.
    const linkAt = out.indexOf(`${APP_ORIGIN}/l/${LETTER_ID}`);
    const fpAt = out.indexOf("data-live-card-fingerprint");
    expect(linkAt).toBeGreaterThan(-1);
    expect(fpAt).toBeGreaterThan(linkAt);
  });

  it("offers Save the card as an image inside the print-hidden group", () => {
    const out = keepsakesHtml();
    expect(out).toContain(LIVE_COPY.saveCardImage);
    const at = out.indexOf("data-live-save-image");
    expect(out.lastIndexOf(styles.noPrint, at)).toBeGreaterThan(-1);
  });

  it("keeps the calendar button inside the print-hidden group", () => {
    const out = keepsakesHtml();
    const at = out.indexOf("data-live-ics");
    expect(out.lastIndexOf(styles.noPrint, at)).toBeGreaterThan(-1);
  });

  it("makes no request to the server while it renders or builds the calendar file", () => {
    keepsakesHtml();
    buildKeepsakeIcs({
      letterId: LETTER_ID,
      appOrigin: APP_ORIGIN,
      opensAt: OPENS_AT,
      dtstamp: new Date(NOW_MS).toISOString(),
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("SealedView keepsakes placement", () => {
  it("renders the keepsakes after the sealed page content", () => {
    const out = renderToStaticMarkup(
      createElement(SealedView, { state: sealedState, appOrigin: APP_ORIGIN, nowMs: () => NOW_MS }),
    );
    expect(out).toContain("data-live-keepsakes");
    expect(out).toContain(LIVE_COPY.letterCardTitle);
    expect(out.indexOf(LIVE_COPY.keepLink)).toBeLessThan(out.indexOf("data-live-keepsakes"));
  });

  it("shows no key and no key-shaped groups on a both seal", () => {
    const out = renderToStaticMarkup(
      createElement(SealedView, {
        state: { ...sealedState, factors: "both" },
        appOrigin: APP_ORIGIN,
        nowMs: () => NOW_MS,
      }),
    );
    expect(out).not.toContain("#k=");
    expect(out).not.toMatch(/[A-Z0-9]{4}-[A-Z0-9]{4}/);
  });
});
