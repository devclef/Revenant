import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import Home from "./page";

/**
 * Markup test for the landing page. Renders with `renderToStaticMarkup` and
 * `createElement` — no DOM library and no JSX. The page is a static server
 * component, so its full output is just a string we can scan.
 *
 * The only call-to-action the landing page carries is the link to the finished
 * demo index at /demo (the seal and open flows are not finished, so nothing
 * links to them — role rule "Don't link to features that aren't finished").
 */
describe("landing page markup", () => {
  it("renders a link to /demo", () => {
    const html = renderToStaticMarkup(createElement(Home));
    expect(html).toContain('href="/demo"');
  });

  it("gives that link visible text mentioning the demo", () => {
    const html = renderToStaticMarkup(createElement(Home));
    // Pull the text content of the anchor pointing at /demo and check it
    // names the demo, so the link is understandable on its own.
    const anchor = /<a[^>]*href="\/demo"[^>]*>(.*?)<\/a>/is.exec(html);
    expect(anchor, "a link to /demo must be present").not.toBeNull();
    const linkText = (anchor?.[1] ?? "").toLowerCase();
    expect(linkText).toContain("demo");
  });
});
