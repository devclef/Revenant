import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LIVE_COPY } from "../copy";
import { OCCASIONS, type OccasionId } from "../occasions";

import { DESK_COPY } from "./copy";
import { OccasionPills } from "./OccasionPills";

const render = (chosen: OccasionId = "blank") =>
  renderToStaticMarkup(
    createElement(OccasionPills, { chosen, onChoose: () => {} }),
  );

/** The data-occasion-pill ids in the order they appear in the markup. */
function pillOrder(html: string): string[] {
  return [...html.matchAll(/data-occasion-pill="([^"]+)"/g)].map((m) => m[1]);
}

describe("OccasionPills (spec 14, W3.1, W3.2)", () => {
  it("renders the visible legend Start from inside a fieldset", () => {
    const html = render();
    expect(html).toMatch(/<fieldset[^>]*data-occasions=""[^>]*>/);
    expect(html).toContain(`>${DESK_COPY.startFrom}</legend>`);
  });

  it("renders five button pills in the W3.1 order", () => {
    const html = render();
    expect(pillOrder(html)).toEqual(OCCASIONS.map((o) => o.id));
    expect(pillOrder(html)).toEqual([
      "year",
      "work",
      "family",
      "decision",
      "blank",
    ]);
    expect(html.match(/<button[\s>]/g)?.length).toBe(5);
    for (const occasion of OCCASIONS) {
      expect(html).toContain(`data-occasion-pill="${occasion.id}"`);
      expect(html).toContain(
        `>${LIVE_COPY.occasionLabels[occasion.id]}</button>`,
      );
    }
  });

  it("gives every pill type=button", () => {
    const html = render();
    expect(html.match(/<button type="button"/g)?.length).toBe(5);
  });

  it("selects A blank page when it is the chosen Occasion", () => {
    const html = render("blank");
    expect(html).toMatch(
      /data-occasion-pill="blank"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-occasion-pill="blank"/,
    );
    expect(html.match(/aria-pressed="true"/g)?.length).toBe(1);
    expect(html.match(/aria-pressed="false"/g)?.length).toBe(4);
  });

  it("marks only the chosen pill as pressed", () => {
    const html = render("family");
    expect(html).toMatch(
      /data-occasion-pill="family"[^>]*aria-pressed="true"|aria-pressed="true"[^>]*data-occasion-pill="family"/,
    );
    expect(html.match(/aria-pressed="true"/g)?.length).toBe(1);
  });

  it("is the label A blank page, never the old wording", () => {
    const html = render();
    expect(html).toContain(">A blank page</button>");
  });

  it("does not render the spec 11 legend on /demo/live", () => {
    expect(render()).not.toContain(LIVE_COPY.occasionLegend);
  });
});
