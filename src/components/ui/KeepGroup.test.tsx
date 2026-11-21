// Spec 16 (requirement 1.8): KeepGroup renders the element the caller picks and
// passes its class and data attributes through unchanged.
//
// Markup test, rendered with `renderToStaticMarkup` in the node environment,
// like the other component markup tests.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { KeepGroup } from "./KeepGroup";

describe("KeepGroup", () => {
  it("renders an li with its class and data attribute when as is li", () => {
    const html = renderToStaticMarkup(
      createElement(
        KeepGroup,
        { as: "li", className: "row", "data-question-row": "" },
        "inside",
      ),
    );
    expect(html).toBe('<li class="row" data-question-row="">inside</li>');
  });

  it("renders a div with its class when as is div", () => {
    const html = renderToStaticMarkup(
      createElement(KeepGroup, { as: "div", className: "field" }, "inside"),
    );
    expect(html).toBe('<div class="field">inside</div>');
  });

  it("renders a div without a class attribute when none is given", () => {
    const html = renderToStaticMarkup(createElement(KeepGroup, { as: "div" }, "x"));
    expect(html).toBe("<div>x</div>");
  });
});
