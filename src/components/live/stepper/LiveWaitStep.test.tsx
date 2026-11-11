// Static-markup tests for the Wait card (spec 09, D5). Rendered with
// renderToStaticMarkup because the test environment is Node. Effects do not
// run here, so the countdown's live ticking and the single letter request at
// zero are pinned by the pure rules in unlock-in-place.test.ts.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LIVE_COPY } from "../copy";
import type { SealedState } from "../SealedView";

import { LiveWaitStep } from "./LiveWaitStep";

const OPENS_AT = "2026-11-08T00:00:00.000Z";
const OPENS_MS = Date.parse(OPENS_AT);

const sealed: SealedState = {
  tag: "sealed",
  letterId: "AAAAAAAAAAAAAAAAAAAAAA",
  sealedAt: "2026-11-07T12:00:00.000Z",
  opensAt: OPENS_AT,
  offsetMs: 0,
  factors: "passkey",
  envelopeHash: "a".repeat(64),
};

function render(step: "wait" | "testify" | "receipts", nowMs: number): string {
  return renderToStaticMarkup(
    createElement(LiveWaitStep, {
      state: sealed,
      appOrigin: "https://revenant.example",
      step,
      advanceTo: () => undefined,
      nowMs: () => nowMs,
    }),
  );
}

describe("LiveWaitStep on the Wait card (D5.1)", () => {
  it("shows the countdown and no flow before zero", () => {
    const html = render("wait", OPENS_MS - 60_000);
    expect(html).toContain('data-live-countdown="ticking"');
    expect(html).toContain(LIVE_COPY.countdown.replace("{seconds}", "60"));
    // The flow mounts only at zero, so its ceremony root is absent (D5.2).
    expect(html).not.toContain("data-ceremony");
  });

  it("offers Go to your letter below the countdown, disabled until zero", () => {
    const html = render("wait", OPENS_MS - 60_000);
    expect(html).toContain("data-live-goto");
    expect(html).toContain('data-disabled="true"');
    expect(html).not.toMatch(/<a [^>]*data-live-goto/);
  });

  it("mounts the flow in place of the countdown at zero (D5.2, D5.3)", () => {
    const html = render("wait", OPENS_MS + 1_000);
    expect(html).not.toContain('data-live-countdown="ticking"');
    expect(html).toContain("data-ceremony");
  });

  it("links to the letter page once the countdown has ended", () => {
    const html = render("wait", OPENS_MS + 1_000);
    expect(html).toMatch(/<a [^>]*data-live-goto[^>]*>/);
    expect(html).toContain('href="/l/AAAAAAAAAAAAAAAAAAAAAA"');
  });

  it("keeps the flow on Testify without the countdown or Go to your letter", () => {
    const html = render("testify", OPENS_MS + 1_000);
    expect(html).toContain("data-ceremony");
    expect(html).not.toContain("data-live-goto");
    expect(html).not.toContain('data-live-countdown="ticking"');
  });
});

describe("LiveWaitStep rehearsal line (spec 11, L4)", () => {
  function renderWith(rehearsal: boolean | undefined): string {
    return renderToStaticMarkup(
      createElement(LiveWaitStep, {
        state: sealed,
        appOrigin: "https://revenant.example",
        step: "wait",
        advanceTo: () => undefined,
        nowMs: () => OPENS_MS - 60_000,
        rehearsal,
      }),
    );
  }

  it("shows the rehearsal line beside the countdown when the prop is set", () => {
    const html = renderWith(true);
    expect(html).toContain('data-live-rehearsal=""');
    expect(html).toContain(LIVE_COPY.rehearsalLine);
  });

  it("shows no rehearsal line when the prop is not set", () => {
    expect(renderWith(undefined)).not.toContain("data-live-rehearsal");
    expect(renderWith(false)).not.toContain(LIVE_COPY.rehearsalLine);
  });
});
