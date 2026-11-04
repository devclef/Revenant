// Feature: 05-reveal-ceremony, issue #103
//
// Close renders only a heading, one line of copy and a link back to the desk
// (R12.9). Tests use renderToStaticMarkup, the house style for component tests
// in this repo (no DOM environment).

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CLOSE_COPY } from "./copy";
import { Close, CLOSE_HREF } from "./Close";

const markup = renderToStaticMarkup(createElement(Close));

/** The visible text of the markup: every tag removed. */
const textOf = (html: string): string => html.replace(/<[^>]+>/g, "");

describe("Close", () => {
  it("shows the close heading from CEREMONY_COPY as an h2", () => {
    expect(markup).toContain(`<h2`);
    expect(markup).toContain(CLOSE_COPY.title);
  });

  it("shows the one line of body copy from CEREMONY_COPY", () => {
    expect(markup).toContain(`<p`);
    expect(markup).toContain(CLOSE_COPY.body);
  });

  it("links back to the desk at /demo with the back label", () => {
    expect(CLOSE_HREF).toBe("/demo");
    expect(markup).toMatch(/<a[^>]*href="\/demo"[^>]*>/);
    expect(markup).toContain(CLOSE_COPY.back);
  });

  it("shows only the heading, the copy and the link text (no summary, score or comment)", () => {
    expect(textOf(markup)).toBe(
      `${CLOSE_COPY.title}${CLOSE_COPY.body}${CLOSE_COPY.back}`,
    );
  });

  it("renders exactly one link and no form controls", () => {
    expect(markup.match(/<a\b/g)).toHaveLength(1);
    expect(markup).not.toMatch(/<(input|select|textarea|button)\b/);
  });
});
