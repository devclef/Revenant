// Feature: 08-judge-polish (issue #199)
//
// The site footer comes last in the root layout, and the landing page links
// (demo, live seal, How page, GitHub source) carry the copy and targets the
// landing copy defines. The landing.test.tsx file covers the page on its own;
// this file covers the layout around it.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SCENE_COPY } from "@/components/ceremony/scene/copy";
import { FOOTER_SOURCE_URL } from "@/components/ui/Footer";
import { UI_COPY } from "@/components/ui/copy";

const state = vi.hoisted(() => ({
  personas: [] as Array<{ key: string; display_name: string }>,
}));

vi.mock("@/lib/personas", () => ({
  get PERSONAS() {
    return state.personas;
  },
}));

vi.mock("next/font/local", () => ({
  default: () => ({ variable: "" }),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

import RootLayout from "@/app/layout";
import Home from "@/app/page";

const MAYA = { key: "us-maya", display_name: "Maya" };
const GITHUB_URL = "https://github.com/devclef/Revenant";

/** Markup of the root layout around the landing page. */
async function layoutMarkup(): Promise<string> {
  const tree = await RootLayout({ children: createElement(Home) });
  return renderToStaticMarkup(tree).replace(/&#x27;/g, "'");
}

/** Markup of the landing page alone, as the page renders it. */
function pageMarkup(): string {
  return renderToStaticMarkup(createElement(Home)).replace(/&#x27;/g, "'");
}

/** The text of one anchor, found by its exact href. */
function anchorText(html: string, href: string): string | null {
  const escaped = href.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  const match = new RegExp(`<a[^>]*href="${escaped}"[^>]*>(.*?)</a>`, "s").exec(
    html,
  );
  return match === null ? null : match[1].replace(/<[^>]+>/g, "").trim();
}

describe("footer placement in the root layout", () => {
  beforeEach(() => {
    state.personas = [MAYA];
  });

  it("renders the footer exactly once", async () => {
    const html = await layoutMarkup();
    expect(html.match(/<footer[\s>]/g)).toHaveLength(1);
  });

  it("is the last element in the body, after the page content", async () => {
    const html = await layoutMarkup();
    const body = /<body>(.*)<\/body>/s.exec(html)?.[1] ?? "";
    expect(body).not.toBe("");
    expect(body.endsWith("</footer>")).toBe(true);

    const sceneAt = body.indexOf('data-ceremony="scene"');
    const footerAt = body.indexOf("<footer");
    expect(sceneAt).toBeGreaterThanOrEqual(0);
    expect(footerAt).toBeGreaterThan(sceneAt);
  });

  it("carries the How link and the GitHub source link", async () => {
    const html = await layoutMarkup();
    const footer = /<footer[\s>].*<\/footer>/s.exec(html)?.[0] ?? "";
    expect(anchorText(footer, "/how-it-is-sealed")).toBe(UI_COPY.footer.how);
    expect(anchorText(footer, GITHUB_URL)).toBe(UI_COPY.footer.source);
    expect(FOOTER_SOURCE_URL).toBe(GITHUB_URL);
  });
});

describe("landing page link text", () => {
  it("uses the singular demo link text for one persona", () => {
    state.personas = [MAYA];
    const html = pageMarkup();
    expect(anchorText(html, "/demo")).toBe(SCENE_COPY.landing.demoLinkOne);
  });

  it("uses the plural demo link text for two personas", () => {
    state.personas = [MAYA, { key: "eu-anna", display_name: "Anna" }];
    const html = pageMarkup();
    expect(anchorText(html, "/demo")).toBe(SCENE_COPY.landing.demoLinkMany);
    expect(SCENE_COPY.landing.demoLinkMany).not.toBe(
      SCENE_COPY.landing.demoLinkOne,
    );
  });

  it("links to the exact GitHub URL in the landing body", () => {
    state.personas = [MAYA];
    const html = pageMarkup();
    expect(anchorText(html, GITHUB_URL)).toBe(SCENE_COPY.landing.sourceLink);
  });

  it("links the How_Page with its landing copy", () => {
    state.personas = [MAYA];
    const html = pageMarkup();
    expect(anchorText(html, "/how-it-is-sealed")).toBe(
      SCENE_COPY.landing.howLink,
    );
  });

  it("links the live Seal_Page with its note and never to /seal", () => {
    state.personas = [MAYA];
    const html = pageMarkup();
    expect(anchorText(html, "/demo/live")).toBe(SCENE_COPY.landing.liveLink);
    expect(html).toContain(SCENE_COPY.landing.liveNote);
    expect(html).not.toMatch(/href="\/seal[";/]/);
  });
});
