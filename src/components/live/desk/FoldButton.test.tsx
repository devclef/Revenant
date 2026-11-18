// Feature: 14-write-desk, Task 5.6 (W13.1, W13.3, W13.5). Markup tests for the
// Fold_Button. Static render only, no DOM.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DESK_COPY } from "./copy";
import { FoldButton, type FoldButtonProps } from "./FoldButton";

const render = (props: Partial<FoldButtonProps> = {}) =>
  renderToStaticMarkup(
    createElement(FoldButton, {
      onFold: () => {},
      failed: false,
      ...props,
    }),
  );

describe("FoldButton (spec 14, W13)", () => {
  it("renders one button with the Fold label and the fold marker", () => {
    const html = render();
    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toMatch(/<button[^>]*data-fold-button=""[^>]*>/);
    expect(html).toContain(DESK_COPY.fold);
  });

  it("hides the right arrow from assistive technology", () => {
    const html = render();
    expect(html).toMatch(/<span aria-hidden="true"> →<\/span>/);
    // The arrow sits inside the button, after the visible label.
    expect(html).toMatch(
      new RegExp(`>${DESK_COPY.fold}<span aria-hidden="true"> →</span></button>`),
    );
  });

  it("is type button so it never submits a form", () => {
    expect(render()).toMatch(/<button[^>]*type="button"/);
  });

  it("shows no summary line before a failed fold", () => {
    const html = render({ failed: false });
    expect(html).not.toContain("data-fold-summary");
    expect(html).not.toContain(DESK_COPY.foldFailed);
  });

  it("shows the one summary line after a failed fold", () => {
    const html = render({ failed: true });
    expect(html).toMatch(/<p[^>]*data-fold-summary=""[^>]*>/);
    expect(html).toContain(`>${DESK_COPY.foldFailed}</p>`);
    expect(html.split(DESK_COPY.foldFailed).length - 1).toBe(1);
  });

  it("keeps the summary outside the button", () => {
    const html = render({ failed: true });
    const buttonEnd = html.indexOf("</button>");
    expect(html.indexOf("data-fold-summary")).toBeGreaterThan(buttonEnd);
  });
});
