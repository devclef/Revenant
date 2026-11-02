import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { REVEAL_COPY } from "./copy";
import { StillSealed, preciseRemainingText } from "./StillSealed";
import { onceOnly } from "@/components/live/unlock";

/**
 * Tests for the still-sealed view's live options (spec 06 task 8, R17.4). The
 * countdown ticks in the browser, so a static render shows the zero state (the
 * server seeds the clock at `opensAt`). The formatting and the once-only guard
 * are tested directly.
 */

describe("preciseRemainingText", () => {
  const opens = Date.parse("2026-11-02T12:00:00.000Z");

  it("shows minutes and seconds left", () => {
    expect(preciseRemainingText(opens, opens - 125_000)).toBe(
      "Time remaining: 2 minutes and 5 seconds.",
    );
  });

  it("rounds a partial second up so it never shows zero early", () => {
    expect(preciseRemainingText(opens, opens - 500)).toBe(
      "Time remaining: 0 minutes and 1 seconds.",
    );
  });

  it("clamps at zero once the instant has passed", () => {
    expect(preciseRemainingText(opens, opens + 9_000)).toBe(
      "Time remaining: 0 minutes and 0 seconds.",
    );
  });

  it("fills both placeholders in the reveal copy", () => {
    expect(REVEAL_COPY.sealedRemainingSeconds).toContain("{minutes}");
    expect(REVEAL_COPY.sealedRemainingSeconds).toContain("{seconds}");
  });
});

describe("StillSealed at zero", () => {
  it("shows the Try again control when the instant has passed", () => {
    const markup = renderToStaticMarkup(
      createElement(StillSealed, {
        opensAt: "2020-01-01T00:00:00.000Z",
        onRetry: () => {},
        precise: true,
        onZero: () => {},
      }),
    );
    expect(markup).toContain(REVEAL_COPY.sealedRetry);
    expect(markup).not.toContain("Time remaining");
  });

  it("keeps the persona view unchanged when the live options are absent", () => {
    const markup = renderToStaticMarkup(
      createElement(StillSealed, {
        opensAt: "2020-01-01T00:00:00.000Z",
        onRetry: () => {},
      }),
    );
    expect(markup).toContain(REVEAL_COPY.sealedRetry);
    expect(markup).toContain(REVEAL_COPY.sealedTitle);
  });
});

describe("onZero is called once", () => {
  it("runs the re-check on the first zero and ignores every later one (R17.4)", () => {
    const retry = vi.fn();
    const once = onceOnly(retry);
    once();
    once();
    once();
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
