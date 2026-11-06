import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LIVE_COPY, REAL_COPY } from "./copy";
import { SealFailure } from "./SealFailure";
import type { SealState } from "./seal-machine";

function failed(kind: "too_early" | "invalid_date" | "network"): Extract<SealState, { tag: "failed" }> {
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
