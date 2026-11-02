// Static-markup tests for SealedView (spec 06, Task 7; R15.13, R16.2–R16.5,
// R19.1). Rendered with renderToStaticMarkup and createElement, as the other
// live static-markup tests do (SealFailure.test.tsx). The countdown is made
// deterministic with a fixed `nowMs`, so the initial render shows an exact
// number of seconds. The sealed view must show the sealed statement, the
// opening time, the link built from APP_ORIGIN, a relative "Go to your letter"
// link that is disabled until the countdown ends, and the keep-link note — and
// it must carry no letter text and no figure value.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DEMO_COPY } from "@/components/demo/copy";

import { LIVE_COPY } from "./copy";
import { formatLocalDateTime } from "./format";
import { SealedView, type SealedState, type SealedViewProps } from "./SealedView";

const APP_ORIGIN = "https://revenant.devclef.se";
const LETTER_ID = "abc123letterid00";

// A sealed state whose opensAt is a fixed 18 seconds after the fixed `nowMs`,
// with a zero offset, so remainingSeconds is deterministic.
const NOW_MS = Date.parse("2026-11-02T12:00:00.000Z");
const OPENS_AT = new Date(NOW_MS + 18_000).toISOString();

function sealed(overrides: Partial<SealedState> = {}): SealedState {
  return {
    tag: "sealed",
    letterId: LETTER_ID,
    sealedAt: new Date(NOW_MS).toISOString(),
    opensAt: OPENS_AT,
    offsetMs: 0,
    factors: "passkey",
    ...overrides,
  };
}

function renderHtml(overrides: Partial<SealedViewProps> = {}): string {
  const state = overrides.state ?? sealed();
  return renderToStaticMarkup(
    createElement(SealedView, {
      state,
      appOrigin: APP_ORIGIN,
      nowMs: () => NOW_MS,
      ...overrides,
    }),
  );
}

/** Visible text: tags stripped and the HTML entities decoded. */
function renderText(overrides: Partial<SealedViewProps> = {}): string {
  return renderHtml(overrides)
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

describe("SealedView — Demo label", () => {
  it("renders the Demo label before the sealed heading", () => {
    const html = renderHtml();
    expect(html).toContain(DEMO_COPY.demoLabel);
    expect(html.indexOf(DEMO_COPY.demoLabel)).toBeLessThan(
      html.indexOf(LIVE_COPY.sealedTitle),
    );
  });
});

describe("SealedView — sealed statement and opening time", () => {
  it("shows the sealed title and body", () => {
    const txt = renderText();
    expect(txt).toContain(LIVE_COPY.sealedTitle);
    expect(txt).toContain(LIVE_COPY.sealedBody);
  });

  it("shows the local opening time through LIVE_COPY.opensAt", () => {
    const time = formatLocalDateTime(OPENS_AT);
    expect(time).not.toBe("");
    expect(renderText()).toContain(LIVE_COPY.opensAt.replace("{time}", time));
    // The placeholder is filled, never shown raw.
    expect(renderHtml()).not.toContain("{time}");
  });
});

describe("SealedView — countdown", () => {
  it("shows the remaining seconds while the lock holds", () => {
    const txt = renderText();
    expect(txt).toContain(LIVE_COPY.countdown.replace("{seconds}", "18"));
    expect(txt).not.toContain(LIVE_COPY.countdownDone);
    expect(renderHtml()).not.toContain("{seconds}");
  });

  it("shows the done copy once the opening time has passed", () => {
    const past = new Date(NOW_MS - 1_000).toISOString();
    const txt = renderText({ state: sealed({ opensAt: past }) });
    expect(txt).toContain(LIVE_COPY.countdownDone);
    expect(txt).not.toContain(LIVE_COPY.countdown.replace("{seconds}", "0"));
  });
});

describe("SealedView — letter link", () => {
  it("shows the link text built from appOrigin and the letter id", () => {
    expect(renderText()).toContain(`${APP_ORIGIN}/l/${LETTER_ID}`);
  });

  it("offers a Copy control for the link", () => {
    expect(renderText()).toContain(LIVE_COPY.copyLink);
  });

  it("puts the wrap class on the element that holds the link text", () => {
    const html = renderHtml();
    expect(html).toMatch(/<span[^>]*class="[^"]*linkText[^"]*"[^>]*data-live-link/);
  });

  it("shows the keep-link note", () => {
    expect(renderText()).toContain(LIVE_COPY.keepLink);
  });
});

describe("SealedView — Go to your letter", () => {
  it("is a relative /l/<id> link, never built from APP_ORIGIN", () => {
    const html = renderHtml({ state: sealed({ opensAt: new Date(NOW_MS - 1_000).toISOString() }) });
    expect(html).toContain(`href="/l/${LETTER_ID}"`);
    // The go-to-letter href is never the absolute origin link.
    expect(html).not.toContain(`href="${APP_ORIGIN}/l/${LETTER_ID}"`);
  });

  it("is disabled (no real link) while seconds remain", () => {
    const html = renderHtml();
    // No next/link anchor to the relative path is rendered while locked.
    expect(html).not.toContain(`href="/l/${LETTER_ID}"`);
    // The disabled affordance is still shown with the go-to-letter label.
    expect(html).toContain('aria-disabled="true"');
    expect(renderText()).toContain(LIVE_COPY.goToLetter);
  });

  it("marks the disabled control with data-disabled and a visibly disabled class", () => {
    const html = renderHtml();
    expect(html).toMatch(/<span[^>]*data-disabled="true"[^>]*>/);
    expect(html).toMatch(/<span[^>]*class="[^"]*primaryDisabled[^"]*"[^>]*data-disabled/);
  });

  it("does not mark the link as disabled once the countdown is done", () => {
    const html = renderHtml({ state: sealed({ opensAt: new Date(NOW_MS - 1_000).toISOString() }) });
    expect(html).not.toContain("data-disabled");
    expect(html).not.toContain("primaryDisabled");
  });

  it("becomes a real link once the countdown reaches zero", () => {
    const html = renderHtml({ state: sealed({ opensAt: new Date(NOW_MS - 1_000).toISOString() }) });
    expect(html).toContain(`href="/l/${LETTER_ID}"`);
    expect(html).not.toContain('aria-disabled="true"');
  });
});

describe("SealedView — backup-key reminder", () => {
  it("shows the key reminder for a backup seal", () => {
    expect(renderText({ state: sealed({ factors: "backup" }) })).toContain(
      LIVE_COPY.keyReminder,
    );
  });

  it("shows the key reminder for a both seal", () => {
    expect(renderText({ state: sealed({ factors: "both" }) })).toContain(
      LIVE_COPY.keyReminder,
    );
  });

  it("hides the key reminder for a passkey-only seal", () => {
    expect(renderText({ state: sealed({ factors: "passkey" }) })).not.toContain(
      LIVE_COPY.keyReminder,
    );
  });

  it("never renders the key itself after a backup seal, only the reminder", () => {
    const html = renderHtml({ state: sealed({ factors: "backup" }) });
    expect(html).not.toContain("data-live-key");
    expect(html).not.toContain("keyGroup");
    expect(html).not.toMatch(/[A-Z0-9]{4}-[A-Z0-9]{4}/);
    expect(html).toContain(LIVE_COPY.keyReminder);
  });
});

describe("SealedView — shows no letter text or figure (R15.13)", () => {
  it("renders none of a sample letter text or figure value", () => {
    const sampleLetter = "Dear future self, the autumn was quiet.";
    const sampleFigure = "3.412";
    // These are never passed to SealedView, which has no props for them; the
    // check guards against a future change that leaks them in.
    const html = renderHtml();
    expect(html).not.toContain(sampleLetter);
    expect(html).not.toContain(sampleFigure);
  });
});

describe("SealedView — backup key card offer (R21.3, R21.4)", () => {
  const KEY_TEXT = "3ABC-DEFG-HJKM-NPQR-STVW-XYZ0-12A";

  it("offers no card for a passkey-only letter, even when a key is held", () => {
    const html = renderHtml({ state: sealed({ factors: "passkey" }), backupKeyText: KEY_TEXT });
    expect(html).not.toContain("data-live-backup-offer");
    expect(html).not.toContain("data-live-backup-card");
  });

  it("offers the card for a backup-only letter while the key is held", () => {
    const html = renderHtml({ state: sealed({ factors: "backup" }), backupKeyText: KEY_TEXT });
    expect(html).toContain("data-live-backup-offer");
    expect(html).toContain(LIVE_COPY.backupCardShow);
  });

  it("offers the card for a letter sealed with both wraps while the key is held", () => {
    const html = renderHtml({ state: sealed({ factors: "both" }), backupKeyText: KEY_TEXT });
    expect(html).toContain("data-live-backup-offer");
  });

  it("offers no card when the key is no longer held", () => {
    const html = renderHtml({ state: sealed({ factors: "backup" }), backupKeyText: null });
    expect(html).not.toContain("data-live-backup-offer");
  });

  it("shows the card markup only after the judge asks for it, so the offer alone shows no key", () => {
    const html = renderHtml({ state: sealed({ factors: "both" }), backupKeyText: KEY_TEXT });
    expect(html).not.toContain("data-live-backup-card");
    expect(html).not.toContain("data-live-key");
    expect(html).not.toContain(KEY_TEXT);
  });
});
