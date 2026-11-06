// Feature: 08-judge-polish (R12)
//
// Markup test for the shared footer. Rendered with `renderToStaticMarkup` in the
// node environment, like the other component markup tests.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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

describe("Footer tap targets (P8.4, PH7)", () => {
  const css = readFileSync(resolve(__dirname, "Footer.module.css"), "utf8");

  /** The body of the below-600px media block, or "" when it is absent. */
  const narrow =
    /@media \(max-width: 599\.98px\) \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";

  /** The body of one rule nested in a block, or "" when the rule is absent. */
  function ruleIn(block: string, selector: string): string {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return (
      new RegExp(`${escaped}\\s*\\{([^}]*)\\}`).exec(block)?.[1] ?? ""
    );
  }

  it("gives every footer link a 44 x 44 CSS px minimum below 600 px", () => {
    const link = ruleIn(narrow, ".link");
    expect(link).toMatch(/min-width:\s*44px/);
    expect(link).toMatch(/min-height:\s*44px/);
  });

  it("applies the same link class to both footer links", () => {
    const classes = [...html.matchAll(/<a [^>]*class="([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(classes).toHaveLength(2);
    expect(classes[0]).not.toBe("");
    expect(classes[0]).toBe(classes[1]);
  });

  it("keeps the footer class on the footer element", () => {
    expect(html).toMatch(/<footer[^>]*class="[^"]+"/);
  });

  it("keeps the 44 px rule out of the wider layouts", () => {
    const outside = css.replace(narrow, "");
    expect(outside).not.toMatch(/min-height:\s*44px/);
  });
});
