import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LIVE_COPY } from "./copy";
import { OccasionPicker } from "./OccasionPicker";
import { OCCASIONS, type OccasionId } from "./occasions";

const render = (chosen: OccasionId | null) =>
  renderToStaticMarkup(
    createElement(OccasionPicker, { chosen, onChoose: () => {} }),
  );

describe("OccasionPicker (spec 11, L2.1, L2.9)", () => {
  it("renders the legend and the five labels in Occasion_Table order", () => {
    const html = render(null);
    expect(html).toContain(LIVE_COPY.occasionLegend);
    const labels = ["The year ahead", "Work", "Family", "A decision", "Blank"];
    let last = -1;
    for (const label of labels) {
      const at = html.indexOf(`>${label}</button>`);
      expect(at, label).toBeGreaterThan(last);
      last = at;
    }
  });

  it("renders one type=button control per Occasion and no others", () => {
    const html = render(null);
    expect((html.match(/<button/g) ?? []).length).toBe(OCCASIONS.length);
    expect((html.match(/type="button"/g) ?? []).length).toBe(OCCASIONS.length);
  });

  it("marks no button pressed before a choice", () => {
    const html = render(null);
    expect((html.match(/aria-pressed="false"/g) ?? []).length).toBe(
      OCCASIONS.length,
    );
    expect(html).not.toContain('aria-pressed="true"');
  });

  it("marks only the chosen Occasion as pressed", () => {
    const html = render("work");
    expect((html.match(/aria-pressed="true"/g) ?? []).length).toBe(1);
    expect(html).toContain(`aria-pressed="true"`);
    const pressedAt = html.indexOf('aria-pressed="true"');
    expect(html.indexOf(">Work</button>")).toBeGreaterThan(pressedAt);
    expect(html.indexOf(">Work</button>")).toBeLessThan(
      html.indexOf(">A decision</button>"),
    );
  });
});
