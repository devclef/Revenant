// Feature: 09-demo-polish (B3.5)
//
// Render tests for the Coven_Strip: no props, the heading, and the two GitHub
// links. No count is shown.

import type React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LANDING_SECTION_COPY } from "./copy";
import { COVEN_LINKS, CovenStrip } from "./CovenStrip";

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element).replace(/&#x27;/g, "'");
}

describe("CovenStrip", () => {
  it("renders the heading without any count list", () => {
    const html = render(<CovenStrip />);
    expect(html).toContain(LANDING_SECTION_COPY.covenTitle);
    expect(html).not.toContain("covenCount");
    expect(html).not.toContain("coven-counts");
  });

  it("takes no props", () => {
    expect(CovenStrip.length).toBe(0);
  });

  it("renders exactly the two GitHub links", () => {
    const html = render(<CovenStrip />);
    expect(COVEN_LINKS.kiro).toBe(
      "https://github.com/devclef/Revenant/tree/main/.kiro",
    );
    expect(COVEN_LINKS.loop).toBe(
      "https://github.com/devclef/Revenant/blob/main/docs/agent-loop.md",
    );
    expect(html).toContain(`href="${COVEN_LINKS.kiro}"`);
    expect(html).toContain(`href="${COVEN_LINKS.loop}"`);
    expect((html.match(/<a /g) ?? []).length).toBe(2);
  });

  it("has no arrow and no direction mark", () => {
    const html = render(<CovenStrip />);
    expect(html).not.toMatch(/[↑↓▲▼→←]/);
  });
});
