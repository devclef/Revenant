import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LIVE_COPY, REAL_COPY } from "./copy";
import { SealFailure, type SealFailureProps } from "./SealFailure";
import type { SealState } from "./seal-machine";

/** Reverts the HTML escaping of quotes and apostrophes, so copy matches as written. */
function decode(html: string): string {
  return html.replace(/&quot;/g, '"').replace(/&#x27;/g, "'");
}

function failed(
  kind: Extract<SealState, { tag: "failed" }>["kind"],
): Extract<SealState, { tag: "failed" }> {
  return { tag: "failed", kind, passkeyCreated: false };
}

function render(state: Extract<SealState, { tag: "failed" }>): string {
  return renderToStaticMarkup(createElement(SealFailure, { state, onRetry: () => {} }));
}

describe("SealFailure for a real letter that was not sealed", () => {
  it("shows the too-early message and offers Try again", () => {
    const html = render(failed("too_early"));
    expect(html).toContain(REAL_COPY.tooEarly);
    expect(html).toContain(LIVE_COPY.tryAgain);
  });

  it("shows the invalid-date message", () => {
    expect(render(failed("invalid_date"))).toContain(REAL_COPY.invalidDate);
  });

  it.each(["too_early", "invalid_date", "network"] as const)(
    "creates no letter card, key card or calendar file after a %s failure",
    (kind) => {
      const html = render(failed(kind));
      expect(html).not.toContain(LIVE_COPY.letterCardTitle);
      expect(html).not.toContain(LIVE_COPY.backupCardTitle);
      expect(html).not.toContain(LIVE_COPY.downloadIcs);
      expect(html).not.toContain(LIVE_COPY.sealedTitle);
    },
  );
});

function renderReal(
  state: SealFailureProps["state"],
  onFallbackStart?: () => void,
): string {
  return decode(
    renderToStaticMarkup(
      createElement(SealFailure, {
        state,
        onRetry: () => {},
        onFallbackStart,
        real: true,
      }),
    ),
  );
}

describe("SealFailure real mode screens", () => {
  it("cannot_lock with a passkey made shows the real delete note and no /demo link", () => {
    const html = renderReal(
      { tag: "cannot_lock", passkeyCreated: true },
      () => {},
    );
    expect(html).toContain(REAL_COPY.passkeyDeleteNote);
    expect(html).not.toContain(LIVE_COPY.passkeyDeleteNote);
    expect(html).not.toContain('href="/demo"');
    expect(html).not.toContain(LIVE_COPY.backToDemo);
    expect(html).toContain(LIVE_COPY.cannotLockNext2);
  });

  it("cannot_lock without a passkey shows no delete note and no /demo link", () => {
    const html = renderReal(
      { tag: "cannot_lock", passkeyCreated: false },
      () => {},
    );
    expect(html).not.toContain(REAL_COPY.passkeyDeleteNote);
    expect(html).not.toContain(LIVE_COPY.passkeyDeleteNote);
    expect(html).not.toContain('href="/demo"');
    expect(html).toContain(LIVE_COPY.fallbackButton);
  });

  it("cannot_lock in demo mode keeps the demo link and the demo delete note", () => {
    const html = decode(
      renderToStaticMarkup(
        createElement(SealFailure, {
          state: { tag: "cannot_lock", passkeyCreated: true },
          onRetry: () => {},
        }),
      ),
    );
    expect(html).toContain('href="/demo"');
    expect(html).toContain(LIVE_COPY.passkeyDeleteNote);
  });

  it("cancelled shows the cancelled copy and Try again, with no /demo link", () => {
    const html = renderReal({ tag: "cancelled" });
    expect(html).toContain(LIVE_COPY.cancelledTitle);
    expect(html).toContain(LIVE_COPY.tryAgain);
    expect(html).not.toContain('href="/demo"');
  });

  it("failed clock shows REAL_COPY.clockBody in real mode", () => {
    const html = renderReal(failed("clock"));
    expect(html).toContain(REAL_COPY.clockBody);
    expect(html).not.toContain(LIVE_COPY.clockBody);
  });

  it("failed busy shows REAL_COPY.busyBody in real mode", () => {
    const html = renderReal(failed("busy"));
    expect(html).toContain(REAL_COPY.busyBody);
    expect(html).not.toContain(LIVE_COPY.busyBody);
  });

  it.each(["network", "server"] as const)(
    "failed %s keeps its shared copy in real mode",
    (kind) => {
      const html = renderReal(failed(kind));
      expect(html).toContain(
        kind === "network" ? LIVE_COPY.failedBody : LIVE_COPY.failedServerBody,
      );
      expect(html).not.toContain('href="/demo"');
    },
  );

  it.each(["too_early", "invalid_date"] as const)(
    "failed %s uses REAL_COPY in real mode",
    (kind) => {
      const html = renderReal(failed(kind));
      expect(html).toContain(
        kind === "too_early" ? REAL_COPY.tooEarly : REAL_COPY.invalidDate,
      );
    },
  );
});
