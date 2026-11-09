// Feature: 10-own-questions (spec 10 C6.1, C6.3)
//
// Renders the Ghost with the held Envelope's seal and Seal_Group, per width
// class, through the same sealPlacement rule the app uses. The server markup is
// what a browser paints from, so the test checks the DOM order inside the Ghost:
// the Seal_Group must come after the Ghost body's glow layer (the SVG), so it
// is a later sibling in the held slot. Paint order also depends on the CSS
// z-index, which only a browser can measure; scene.module.css sets it.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CEREMONY_COPY } from "../copy";
import { Ghost } from "../scene/Ghost";
import { sealPlacement } from "./seal-placement";

/** The Desktop_Sizes and the Wide_Size named by the QA check. */
const DESKTOP_AND_WIDE = [1280, 1366, 2560];
const CONTENT_WIDTHS = [360, 390, 768, 899];

function heldMarkup(viewportWidth: number): string {
  const placement = sealPlacement({ viewportWidth, slotReady: true });
  const children =
    placement === "envelope"
      ? createElement(
          "div",
          { "data-held-envelope": "" },
          createElement("span", { "data-envelope-seal": "" }),
          createElement(
            "div",
            { "data-seal-group": "" },
            createElement("p", null, CEREMONY_COPY.sealHint),
          ),
        )
      : null;
  return renderToStaticMarkup(createElement(Ghost, null, children));
}

describe("held Envelope render per width class (spec 10 C6.1, C6.3)", () => {
  for (const viewportWidth of DESKTOP_AND_WIDE) {
    it(`draws the Seal_Group and seal inside the Ghost at ${viewportWidth} px`, () => {
      const html = heldMarkup(viewportWidth);
      expect(html).toContain("data-seal-group");
      expect(html).toContain("data-envelope-seal");
      expect(html).toContain(CEREMONY_COPY.sealHint);
      // C6.1: the instruction placement rule is gone, replaced by the group.
      expect(html).not.toContain("data-envelope-instruction");
    });

    it(`draws the Seal_Group after the Ghost body's SVG at ${viewportWidth} px`, () => {
      const html = heldMarkup(viewportWidth);
      const bodyEnd = html.indexOf("</svg>");
      const group = html.indexOf("data-seal-group");
      expect(bodyEnd).toBeGreaterThan(-1);
      expect(group).toBeGreaterThan(bodyEnd);
    });
  }

  for (const viewportWidth of CONTENT_WIDTHS) {
    it(`leaves the Ghost's held slot empty at ${viewportWidth} px (the seal stays in the Content_Column)`, () => {
      const html = heldMarkup(viewportWidth);
      expect(html).not.toContain("data-seal-group");
      expect(html).not.toContain("data-envelope-seal");
    });
  }
});
