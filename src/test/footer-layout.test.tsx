// Feature: 08-judge-polish (issue #199)
//
// The site footer comes last in the root layout, after the page content
// (R12.4). The landing.test.tsx file covers the landing page's own copy and
// links; this file covers the layout around it.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FOOTER_SOURCE_URL } from "@/components/ui/Footer";
import { UI_COPY } from "@/components/ui/copy";

const state = vi.hoisted(() => ({
  personas: [] as Array<{ key: string; display_name: string }>,
}));

// page.tsx imports feature-flags.ts, which imports `server-only`.
vi.mock("server-only", () => ({}));

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
    expect(body.endsWith('</footer></div>')).toBe(true);

    const sceneAt = body.indexOf('data-ceremony="scene"');
    const footerAt = body.indexOf("<footer");
    expect(sceneAt).toBeGreaterThanOrEqual(0);
    expect(footerAt).toBeGreaterThan(sceneAt);
  });

  it("wraps the footer in the .site-footer layout wrapper", async () => {
    const html = await layoutMarkup();
    const wrapper = /<div class="site-footer"><footer[\s>]/.exec(html);
    expect(wrapper).not.toBeNull();
  });

  it("keeps the .site-footer rule that stops the footer overlapping Stage content", () => {
    const css = readFileSync(
      fileURLToPath(new URL("../app/globals.css", import.meta.url)),
      "utf8",
    );
    const rule = /\.site-footer\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(rule).toMatch(/position:\s*relative/);
    expect(rule).toMatch(/z-index:\s*0/);
    expect(css).toMatch(/\.site-footer::before\s*\{[^}]*height:\s*6rem/);
  });

  it("carries the How link and the GitHub source link", async () => {
    const html = await layoutMarkup();
    const footer = /<footer[\s>].*<\/footer>/s.exec(html)?.[0] ?? "";
    expect(anchorText(footer, "/how-it-is-sealed")).toBe(UI_COPY.footer.how);
    expect(anchorText(footer, GITHUB_URL)).toBe(UI_COPY.footer.source);
    expect(FOOTER_SOURCE_URL).toBe(GITHUB_URL);
  });
});
