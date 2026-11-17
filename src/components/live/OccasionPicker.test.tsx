import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LIVE_COPY } from "./copy";
import { OccasionPicker } from "./OccasionPicker";
import { OCCASIONS, type OccasionId } from "./occasions";

const here = dirname(fileURLToPath(import.meta.url));
const liveCss = readFileSync(join(here, "live.module.css"), "utf8");

const render = (chosen: OccasionId | null) =>
  renderToStaticMarkup(
    createElement(OccasionPicker, { chosen, onChoose: () => {} }),
  );

/** The body of the first `.occasionButton { ... }` rule in live.module.css. */
function chipRule(): string {
  const m = /\.occasionButton\s*\{([^}]*)\}/.exec(liveCss);
  return m ? m[1] : "";
}

/** The `.occasionButton` rule inside the `@media (min-width: 600px)` block. */
function wideChipRule(): string {
  const start = liveCss.indexOf("@media (min-width: 600px)");
  if (start < 0) return "";
  const block = liveCss.slice(start);
  const m = /\.occasionButton\s*\{([^}]*)\}/.exec(block);
  return m ? m[1] : "";
}

/** The `.occasionButton[aria-pressed="true"]` rule in live.module.css. */
function pressedChipRule(): string {
  const m = /\.occasionButton\[aria-pressed="true"\]\s*\{([^}]*)\}/.exec(
    liveCss,
  );
  return m ? m[1] : "";
}

/** The chip `<button>` markup that contains the given label. */
function chipFor(html: string, label: string): string {
  const end = html.indexOf(`${label}</button>`);
  if (end < 0) return "";
  const start = html.lastIndexOf("<button", end);
  return html.slice(start, end + `${label}</button>`.length);
}

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
    expect((html.match(/type=\"button\"/g) ?? []).length).toBe(
      OCCASIONS.length,
    );
  });

  it("marks no button pressed before a choice", () => {
    const html = render(null);
    expect((html.match(/aria-pressed=\"false\"/g) ?? []).length).toBe(
      OCCASIONS.length,
    );
    expect(html).not.toContain('aria-pressed="true"');
  });

  it("renders the occasion control as a fieldset with the occasions class the Write-step rule targets", () => {
    const html = render(null);
    expect(html).toMatch(/<fieldset class=\"[^\"]*occasions[^\"]*\"/);
  });

  it("keeps the legend in the markup with a visually-hidden class", () => {
    const html = render(null);
    const escaped = LIVE_COPY.occasionLegend.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );
    expect(html).toMatch(
      new RegExp(
        `<legend class=\"[^\"]*visuallyHidden[^\"]*\">${escaped}</legend>`,
      ),
    );
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

  it("renders no check mark, tick or [x] marker in the Occasion markup", () => {
    const html = render("work");
    expect(html).not.toMatch(/\u2713|\u2714|\[x\]/);
    expect(html).not.toContain("occasionMark");
    expect(html).not.toMatch(/aria-hidden="true"/);
    const pressed = chipFor(html, "Work");
    expect(pressed).toContain('aria-pressed="true"');
    expect(pressed).not.toMatch(/<span/);
  });

  it("renders each Occasion as a button whose only child is its label", () => {
    const html = render("family");
    for (const occasion of OCCASIONS) {
      const label = LIVE_COPY.occasionLabels[occasion.id];
      expect(html).toContain(`>${label}</button>`);
    }
  });
});

describe("Occasion chip sizes (spec 11, L2.9; spec 12, W2)", () => {
  it("sets the chip height to 44px below 600px", () => {
    const rule = chipRule();
    expect(rule).toMatch(/height:\s*44px/);
    expect(rule).toMatch(/min-height:\s*44px/);
  });

  it("sets the chip height to 32px at 600px and wider", () => {
    const rule = wideChipRule();
    expect(rule).toMatch(/height:\s*32px/);
    expect(rule).toMatch(/min-height:\s*32px/);
  });
});

describe("Occasion options as plain text (spec 12, W2)", () => {
  it("draws each option with no box: no border, no background", () => {
    const rule = chipRule();
    expect(rule).toMatch(/border:\s*0/);
    expect(rule).toMatch(/background:\s*none/);
    expect(rule).not.toMatch(/border-width:\s*[1-9]/);
  });

  it("underlines and makes the pressed option heavier", () => {
    const rule = pressedChipRule();
    expect(rule).toMatch(/text-decoration:\s*underline/);
    expect(rule).toMatch(/font-weight:\s*700/);
  });

  it("removes the old check mark marker rules from live.module.css", () => {
    expect(liveCss).not.toContain(".occasionMark");
    expect(liveCss).not.toMatch(/\[x\]/);
  });
});
