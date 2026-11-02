// Static-markup tests for SealFailure (spec 06, Task 6; R15.6–R15.8, R19.1).
// Rendered with renderToStaticMarkup and createElement, as the other live
// static-markup tests do (FigurePicker.test.tsx). Each screen must show its
// required LIVE_COPY and must not state or imply the letter was sealed.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CATALOGUE } from "@/lib/figures/catalogue";

import { LIVE_COPY } from "./copy";
import { RECALL_SUBJECTS } from "./recall-subjects";
import { SealFailure, seriesName, type SealFailureProps } from "./SealFailure";
import type { SealState } from "./seal-machine";

/** The raw markup, for attribute and element assertions. */
function renderHtml(
  state: SealFailureProps["state"],
  overrides: Partial<SealFailureProps> = {},
): string {
  return renderToStaticMarkup(
    createElement(SealFailure, {
      state,
      onRetry: () => undefined,
      ...overrides,
    }),
  );
}

/**
 * The visible text of the rendered markup: tags stripped and the HTML entities
 * renderToStaticMarkup emits (&quot;, &#x27;, &amp;, &lt;, &gt;) decoded, so a
 * copy assertion compares against the raw LIVE_COPY string rather than its
 * escaped form.
 */
function renderText(
  state: SealFailureProps["state"],
  overrides: Partial<SealFailureProps> = {},
): string {
  return renderHtml(state, overrides)
    .replace(/<[^>]*>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** No failure screen may carry copy that only a sealed-success screen shows. */
function expectNoSealedCopy(txt: string): void {
  expect(txt).not.toContain(LIVE_COPY.sealedTitle);
  expect(txt).not.toContain(LIVE_COPY.sealedBody);
  expect(txt).not.toContain(LIVE_COPY.goToLetter);
  // The countdown template, with its placeholder stripped, must not appear.
  expect(txt).not.toContain("Time remaining");
  expect(txt).not.toContain(LIVE_COPY.countdown.replace("{seconds}", "30"));
}

describe("SealFailure — cannot_lock", () => {
  const base: Extract<SealState, { tag: "cannot_lock" }> = {
    tag: "cannot_lock",
    passkeyCreated: false,
  };

  it("shows the title, body and both next steps", () => {
    const txt = renderText(base);

    expect(txt).toContain(LIVE_COPY.cannotLockTitle);
    expect(txt).toContain(LIVE_COPY.cannotLockBody);
    expect(txt).toContain(LIVE_COPY.cannotLockNext1);
    expect(txt).toContain(LIVE_COPY.cannotLockNext2);
  });

  it("links back to the demo", () => {
    expect(renderText(base)).toContain(LIVE_COPY.backToDemo);
    expect(renderHtml(base)).toContain('href="/demo"');
  });

  it("renders the backup-key fallback control present and disabled", () => {
    const html = renderHtml(base);

    expect(html).toContain(LIVE_COPY.fallbackButton);
    expect(html).toMatch(/<button[^>]*\bdisabled\b[^>]*>[^<]*Seal with a backup key/);
  });

  it("hides the deletion note when no passkey was created", () => {
    expect(renderText({ tag: "cannot_lock", passkeyCreated: false })).not.toContain(
      LIVE_COPY.passkeyDeleteNote,
    );
  });

  it("shows the deletion note only when a passkey was created", () => {
    expect(renderText({ tag: "cannot_lock", passkeyCreated: true })).toContain(
      LIVE_COPY.passkeyDeleteNote,
    );
  });

  it("does not state or imply the letter was sealed", () => {
    expectNoSealedCopy(renderText({ tag: "cannot_lock", passkeyCreated: true }));
  });
});

describe("SealFailure — cancelled", () => {
  const state: Extract<SealState, { tag: "cancelled" }> = { tag: "cancelled" };

  it("shows the cancelled title and body", () => {
    const txt = renderText(state);

    expect(txt).toContain(LIVE_COPY.cancelledTitle);
    expect(txt).toContain(LIVE_COPY.cancelledBody);
  });

  it("offers a Try again button", () => {
    expect(renderText(state)).toContain(LIVE_COPY.tryAgain);
  });

  it("does not state or imply the letter was sealed", () => {
    expectNoSealedCopy(renderText(state));
  });
});

describe("SealFailure — failed", () => {
  function failed(
    kind: Extract<SealState, { tag: "failed" }>["kind"],
    metricId?: string,
  ): Extract<SealState, { tag: "failed" }> {
    return {
      tag: "failed",
      kind,
      passkeyCreated: false,
      ...(metricId !== undefined ? { metricId } : {}),
    };
  }

  it("shows the network body for the network kind", () => {
    expect(renderText(failed("network"))).toContain(LIVE_COPY.failedBody);
  });

  it("shows the separate server body for the server kind", () => {
    expect(renderText(failed("server"))).toContain(LIVE_COPY.failedServerBody);
    expect(renderText(failed("server"))).not.toContain(LIVE_COPY.failedBody);
  });

  it("gives the server and network bodies different wording", () => {
    expect(LIVE_COPY.failedServerBody).not.toBe(LIVE_COPY.failedBody);
    expect(renderText(failed("network"))).not.toContain(LIVE_COPY.failedServerBody);
  });

  it("does not say the letter was sealed in either network or server body", () => {
    for (const body of [LIVE_COPY.failedBody, LIVE_COPY.failedServerBody]) {
      expect(body.toLowerCase()).not.toMatch(/your letter (was|is) sealed/);
    }
    expect(LIVE_COPY.failedServerBody).toContain("Nothing was sealed");
  });

  it("shows the clock body for the clock kind", () => {
    expect(renderText(failed("clock"))).toContain(LIVE_COPY.clockBody);
  });

  it("shows the busy body for the busy kind", () => {
    expect(renderText(failed("busy"))).toContain(LIVE_COPY.busyBody);
  });

  it("names the series for a missing_then failure", () => {
    const name = RECALL_SUBJECTS["us-gasoline-regular"];
    expect(name).toBeDefined();

    const txt = renderText(failed("missing_then", "us-gasoline-regular"));

    expect(txt).toContain(name);
    expect(txt).toContain(
      LIVE_COPY.missingThenBody.replace("{name}", name as string),
    );
    // The placeholder must be filled, not shown raw.
    expect(renderHtml(failed("missing_then", "us-gasoline-regular"))).not.toContain(
      "{name}",
    );
  });

  it("names the series via the catalogue display name when no recall subject exists", () => {
    // seriesName prefers a recall subject, then the catalogue display name,
    // then the id itself. us-gasoline-regular has a subject; a hypothetical
    // catalogue-only id uses its display_name; an unknown id uses the id.
    expect(seriesName("us-gasoline-regular")).toBe(
      RECALL_SUBJECTS["us-gasoline-regular"],
    );

    const catalogueOnly = CATALOGUE.find(
      (series) => RECALL_SUBJECTS[series.metric.id] === undefined,
    );
    if (catalogueOnly !== undefined) {
      expect(seriesName(catalogueOnly.metric.id)).toBe(
        catalogueOnly.metric.display_name,
      );
    }

    expect(seriesName("unknown-series")).toBe("unknown-series");
  });

  it("offers a Try again button on every failed kind", () => {
    for (const kind of ["network", "server", "clock", "busy"] as const) {
      expect(renderText(failed(kind))).toContain(LIVE_COPY.tryAgain);
    }
    expect(renderText(failed("missing_then", "us-diesel"))).toContain(
      LIVE_COPY.tryAgain,
    );
  });

  it("does not state or imply the letter was sealed", () => {
    for (const kind of ["network", "server", "clock", "busy"] as const) {
      expectNoSealedCopy(renderText(failed(kind)));
    }
    expectNoSealedCopy(renderText(failed("missing_then", "us-gasoline-regular")));
  });
});
