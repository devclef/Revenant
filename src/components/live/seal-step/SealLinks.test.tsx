// Feature: 14-write-desk (spec 14, S5).
//
// Static-markup tests for SealLinks: the two text controls, the closed
// cross-device line, and the Back link disabled in place while no onBack is
// given. The toggle itself is a state change that static markup cannot run.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LIVE_COPY } from "../copy";
import { SealLinks } from "./SealLinks";

function render(onBack?: () => void): string {
  return renderToStaticMarkup(createElement(SealLinks, { onBack }));
}

describe("SealLinks (spec 14, S5)", () => {
  it("holds the cross-device question as a text control, closed by default", () => {
    const html = render(() => undefined);
    const button =
      /<button[^>]*data-cross-device=""[^>]*>/.exec(html)?.[0] ?? "";
    expect(button).toContain('aria-expanded="false"');
    expect(html).toContain(`>${LIVE_COPY.crossDeviceQuestion}</button>`);
    expect(html).not.toContain(LIVE_COPY.crossDevice);
  });

  it("points the cross-device control at the line it opens", () => {
    const html = render(() => undefined);
    const controls = /aria-controls="([^"]+)"/.exec(html);
    expect(controls).not.toBeNull();
  });

  it("holds the Back link with the arrow hidden from assistive technology", () => {
    const html = render(() => undefined);
    expect(html).toContain(
      `<span aria-hidden="true">← </span>${LIVE_COPY.backToLetter}`,
    );
  });

  it("enables Back when onBack is given", () => {
    const html = render(() => undefined);
    expect(html).toMatch(/data-back-to-letter=""(?! disabled)/);
  });

  it("keeps Back in place and disabled while onBack is undefined (S5.6)", () => {
    const html = render(undefined);
    expect(html).toMatch(/data-back-to-letter="" disabled=""/);
    expect(html.match(/data-back-to-letter=""/g)?.length).toBe(1);
  });
});
