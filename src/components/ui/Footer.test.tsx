// Feature: 08-judge-polish (R12)
//
// Markup test for the shared footer. Rendered with `renderToStaticMarkup` in the
// node environment, like the other component markup tests.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FOOTER_MAX_PX } from "@/components/ceremony/constants";

import { Footer, FOOTER_SOURCE_URL } from "./Footer";
import { UI_COPY } from "./copy";

const html = renderToStaticMarkup(createElement(Footer));
const footerStyle = /<footer[^>]*style="([^"]*)"/.exec(html)?.[1] ?? "";

describe("Footer element", () => {
  it("renders one <footer> element", () => {
    expect(html.startsWith("<footer")).toBe(true);
    expect(html.match(/<footer[\s>]/g)).toHaveLength(1);
    expect(html.endsWith("</footer>")).toBe(true);
  });

  it("sets the desk background, stacking and height limit in its style", () => {
    expect(footerStyle).toContain("background:var(--bg)");
    expect(footerStyle).toContain("position:relative");
    expect(footerStyle).toContain("z-index:3");
    expect(footerStyle).toContain(`max-height:${FOOTER_MAX_PX}px`);
    expect(FOOTER_MAX_PX).toBe(64);
  });

  it("sets its own text colour from the desk tokens", () => {
    expect(footerStyle).toContain("color:var(--text)");
  });
});

describe("Footer links", () => {
  it("links to the How_Page with the footer label", () => {
    expect(html).toContain(`href="/how-it-is-sealed"`);
    expect(html).toContain(UI_COPY.footer.how);
  });

  it("links to exactly the GitHub repository with the footer label", () => {
    expect(FOOTER_SOURCE_URL).toBe("https://github.com/devclef/Revenant");
    expect(html).toContain(`href="https://github.com/devclef/Revenant"`);
    expect(html).toContain(UI_COPY.footer.source);
  });

  it("has exactly two links", () => {
    expect(html.match(/<a /g)).toHaveLength(2);
  });
});

describe("Footer copy", () => {
  it("holds the footer labels from design.md \"Copy\"", () => {
    expect(UI_COPY.footer.how).toBe("How a letter is sealed");
    expect(UI_COPY.footer.source).toBe("Source code on GitHub");
  });
});
