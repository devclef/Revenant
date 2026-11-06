// Static-markup tests for the real sealed body of SealedView (spec 08, task 22,
// R24.10). A Real_Letter sealed at /seal shows only the still-sealed statement,
// the opening date and the time remaining until opens_at. The letter link and
// "Go to your letter" appear only after the countdown has ended. The Live_Letter
// body is checked too, so the default (non-real) view is known to be unchanged.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LIVE_COPY, REAL_COPY } from "./copy";
import { formatLocalDateTime } from "./format";
import { SealedView, type SealedState, type SealedViewProps } from "./SealedView";

const APP_ORIGIN = "https://revenant.devclef.se";
const LETTER_ID = "realletter0000id";

const NOW_MS = Date.parse("2026-11-02T12:00:00.000Z");
// Opens 18 seconds after NOW_MS, with a zero clock offset.
const OPENS_AT = new Date(NOW_MS + 18_000).toISOString();

function sealed(overrides: Partial<SealedState> = {}): SealedState {
  return {
    tag: "sealed",
    letterId: LETTER_ID,
    sealedAt: new Date(NOW_MS).toISOString(),
    opensAt: OPENS_AT,
    offsetMs: 0,
    factors: "passkey",
    envelopeHash: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    ...overrides,
  };
}

function renderHtml(overrides: Partial<SealedViewProps> = {}): string {
  return renderToStaticMarkup(
    createElement(SealedView, {
      state: sealed(),
      appOrigin: APP_ORIGIN,
      nowMs: () => NOW_MS,
      ...overrides,
    }),
  );
}

describe("SealedView, real sealed body before opens_at", () => {
  const html = () => renderHtml({ real: true });

  it("shows the still-sealed statement, the opening time and the countdown", () => {
    const out = html();
    expect(out).toContain(REAL_COPY.stillSealed);
    expect(out).toContain(
      LIVE_COPY.opensAt.replace("{time}", formatLocalDateTime(OPENS_AT)),
    );
    expect(out).toContain(LIVE_COPY.countdown.replace("{seconds}", "18"));
    expect(out).toContain('data-live-countdown="ticking"');
  });

  it("does not show the sealed body, the link, the copy control or Go to your letter", () => {
    const out = html();
    expect(out).not.toContain(LIVE_COPY.sealedTitle);
    expect(out).not.toContain(LIVE_COPY.sealedBody);
    expect(out).not.toContain(LIVE_COPY.linkLabel);
    expect(out).not.toContain(LIVE_COPY.copyLink);
    expect(out).not.toContain(LIVE_COPY.goToLetter);
    expect(out).not.toContain(LIVE_COPY.keepLink);
    expect(out).not.toContain("data-live-link");
    expect(out).not.toContain("data-live-goto");
  });

  it("marks the body as real", () => {
    expect(html()).toContain("data-live-real");
  });
});

describe("SealedView, real sealed body after opens_at", () => {
  const afterOpen = () =>
    renderHtml({ real: true, nowMs: () => Date.parse(OPENS_AT) });

  it("shows the link and an enabled Go to your letter to the relative path", () => {
    const out = afterOpen();
    expect(out).toContain('data-live-countdown="done"');
    expect(out).toContain("data-live-link");
    expect(out).toContain(`${APP_ORIGIN}/l/${LETTER_ID}`);
    const anchor = out.match(/<a [^>]*data-live-goto[^>]*>/)?.[0] ?? "";
    expect(anchor).toContain(`href="/l/${LETTER_ID}"`);
    expect(out).not.toContain('data-disabled="true"');
  });
});

describe("SealedView, Live_Letter body (real flag off)", () => {
  it("keeps the sealed title, the sealed body and the link with no real marker", () => {
    const out = renderHtml();
    expect(out).toContain(LIVE_COPY.sealedTitle);
    expect(out).toContain(LIVE_COPY.sealedBody);
    expect(out).toContain("data-live-link");
    expect(out).toContain(LIVE_COPY.goToLetter);
    expect(out).not.toContain("data-live-real");
    expect(out).not.toContain(REAL_COPY.stillSealed);
  });
});
