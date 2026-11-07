// Feature: 07-judge-journey, spec 07 task 6, Property 12
//
// Demo_2_On false means no /demo/live link. For any RP_ID value that is
// unset, empty or whitespace only, demo2On is false and the close has no
// /demo/live link; for any non-blank RP_ID the link is present. In neither
// case does the markup contain the RP_ID value.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { Close } from "./Close";

const KEY = "us-maya";

/** The Demo_2_On rule from the persona page (design.md "Demo_2_On plumbing"). */
const demo2OnFrom = (rpId: string | undefined): boolean =>
  (rpId ?? "").trim() !== "";

const render = (demo2On: boolean) =>
  renderToStaticMarkup(
    createElement(Close, { kind: "persona", personaKey: KEY, demo2On }),
  );

describe("Property 12: Demo_2_On false means no /demo/live link", () => {
  it("an unset, empty or whitespace-only RP_ID gives demo2On false and no link (fast-check)", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(undefined),
          fc.stringMatching(/^[ \t\n\r]*$/),
        ),
        (rpId) => {
          const demo2On = demo2OnFrom(rpId);
          expect(demo2On).toBe(false);
          const html = render(demo2On);
          expect(html).not.toContain("/demo/live");
          // The other three items stay, in order.
          expect(html.indexOf("Your testimony sits beside the record.")).toBeLessThan(
            html.indexOf("That is the whole letter."),
          );
          expect(html.indexOf("That is the whole letter.")).toBeLessThan(
            html.indexOf("Start over"),
          );
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("a non-blank RP_ID gives demo2On true and the link (fast-check)", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim() !== ""),
        (rpId) => {
          const demo2On = demo2OnFrom(rpId);
          expect(demo2On).toBe(true);
          expect(render(demo2On)).toContain('href="/demo/live"');
          return true;
        },
      ),
      { numRuns: 100 },
    );
  });

  it("example: unset, empty and whitespace RP_ID give no link; the RP_ID value is never in the markup", () => {
    for (const rpId of [undefined, "", "   ", "\t\n"]) {
      const html = render(demo2OnFrom(rpId));
      expect(html).not.toContain("/demo/live");
      if (rpId !== undefined && rpId.trim() !== "") {
        expect(html).not.toContain(rpId);
      }
    }
    const withLink = render(demo2OnFrom("localhost"));
    expect(withLink).toContain('href="/demo/live"');
    expect(withLink).not.toContain("localhost");
  });
});
