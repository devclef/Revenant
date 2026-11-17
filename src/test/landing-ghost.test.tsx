import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// One persona is enough: the Accent link needs a first persona, and the Ghost
// does not depend on the persona list.
// page.tsx imports feature-flags.ts, which imports `server-only`.
vi.mock("server-only", () => ({}));

vi.mock("@/lib/personas", () => ({
  PERSONAS: [{ key: "us-maya", display_name: "Maya" }],
}));

import Home from "@/app/page";

describe("landing Ghost in the server HTML (R9.15)", () => {
  const html = renderToStaticMarkup(createElement(Home));

  it("renders one Ghost, the hero Ghost from HeroEnvelope, and no backdrop Ghost", () => {
    expect(html.match(/data-ghost-pit/g)).toHaveLength(1);
  });

  it("renders the hero Ghost after the hero headline", () => {
    const ghostAt = html.indexOf("data-ghost-pit");
    const headlineAt = html.indexOf("<h1");
    expect(ghostAt).toBeGreaterThanOrEqual(0);
    expect(ghostAt).toBeGreaterThan(headlineAt);
  });

  it("uses the hero gradient id for the Ghost body", () => {
    expect(html).toContain('id="ghost-body-hero"');
    expect(html).not.toContain('id="ghost-body-landing"');
  });

  it("renders no Envelope inside the Ghost", () => {
    const pitAt = html.indexOf("data-ghost-pit");
    const pitEnd = html.indexOf("<h1");
    const pitMarkup = html.slice(pitAt, pitEnd);
    expect(pitMarkup).not.toContain("envelope");
  });

  it("places the Accent link inside the landing column, before the Ghost", () => {
    const columnAt = html.indexOf("data-landing-column");
    const pitAt = html.indexOf("data-ghost-pit");
    const linkAt = html.indexOf('href="/demo"');
    expect(columnAt).toBeGreaterThanOrEqual(0);
    expect(linkAt).toBeGreaterThan(columnAt);
    expect(linkAt).toBeLessThan(pitAt);
  });
});
