// Feature: 09-demo-polish (B3.5, B3.6)
//
// Render tests for the Coven_Strip: each non-null count with its singular or
// plural label, null counts hidden, and the two GitHub links.

import type React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LANDING_SECTION_COPY } from "./copy";
import { COVEN_LINKS, countLabel, CovenStrip, type KiroStats } from "./CovenStrip";

function render(element: React.ReactElement): string {
  return renderToStaticMarkup(element).replace(/&#x27;/g, "'");
}

const FULL: KiroStats = { specs: 10, steering: 8, agents: 5, hooks: 4 };

describe("CovenStrip counts", () => {
  it("shows the four counts with plural labels", () => {
    const html = render(<CovenStrip stats={FULL} />);
    expect(html).toContain("10 specs");
    expect(html).toContain("8 steering docs");
    expect(html).toContain("5 custom agents");
    expect(html).toContain("4 hooks");
  });

  it("uses singular labels for a count of one", () => {
    const html = render(
      <CovenStrip stats={{ specs: 1, steering: 1, agents: 1, hooks: 1 }} />,
    );
    expect(html).toContain("1 spec<");
    expect(html).toContain("1 steering doc<");
    expect(html).toContain("1 custom agent<");
    expect(html).toContain("1 hook<");
  });

  it("hides a null count and shows the rest", () => {
    const html = render(
      <CovenStrip stats={{ specs: null, steering: 8, agents: null, hooks: 4 }} />,
    );
    expect(html).not.toContain("specs");
    expect(html).not.toContain("custom agent");
    expect(html).toContain("8 steering docs");
    expect(html).toContain("4 hooks");
    expect((html.match(/<li class="[^"]*covenCount/g) ?? []).length).toBe(2);
  });

  it("shows no count list when every count is null, and keeps the links", () => {
    const html = render(
      <CovenStrip stats={{ specs: null, steering: null, agents: null, hooks: null }} />,
    );
    expect(html).not.toContain("covenCount");
    expect(html).toContain(LANDING_SECTION_COPY.covenTitle);
    expect(html).toContain(COVEN_LINKS.kiro);
  });
});

describe("CovenStrip links", () => {
  it("links to the two GitHub URLs of B3.5", () => {
    const html = render(<CovenStrip stats={FULL} />);
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
    const html = render(<CovenStrip stats={FULL} />);
    expect(html).not.toMatch(/[↑↓▲▼→←]/);
  });
});

describe("countLabel", () => {
  it("picks the singular form only for exactly one", () => {
    const forms = { one: "{n} hook", other: "{n} hooks" };
    expect(countLabel(1, forms)).toBe("1 hook");
    expect(countLabel(0, forms)).toBe("0 hooks");
    expect(countLabel(2, forms)).toBe("2 hooks");
  });
});
