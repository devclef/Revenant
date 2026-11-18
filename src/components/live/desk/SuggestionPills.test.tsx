// Feature: 14-write-desk, W8.1, W8.2, W8.7. Static markup of the Suggestion_Pills.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OCCASIONS, SHARED_SUGGESTIONS } from "../occasions";

import { DESK_COPY } from "./copy";
import { SuggestionPills } from "./SuggestionPills";
import { suggestionsFor } from "./suggestions";

const render = (questions: string[] = []) =>
  renderToStaticMarkup(
    createElement(SuggestionPills, {
      occasion: "year",
      questions,
      onAdd: () => {},
    }),
  );

describe("SuggestionPills (spec 14, W8.1, W8.2, W8.7)", () => {
  it("shows the Ask another label, then the pills, then Write my own", () => {
    const html = render();
    const label = html.indexOf(DESK_COPY.askAnother);
    const first = html.indexOf(suggestionsFor("year", [])[0] ?? "");
    const own = html.indexOf(DESK_COPY.writeOwn);
    expect(label).toBeGreaterThanOrEqual(0);
    expect(label).toBeLessThan(first);
    expect(first).toBeLessThan(own);
  });

  it("shows at most two suggestion pills", () => {
    const html = render();
    const pills = html.match(/data-add-row=""/g) ?? [];
    // Two suggestions and the Write my own pill.
    expect(pills).toHaveLength(3);
  });

  it("names each suggestion pill Add the question: {text}", () => {
    const [first] = suggestionsFor("year", []);
    expect(render()).toContain(
      `aria-label="${DESK_COPY.addSuggestion.replace("{text}", first ?? "").replace(/'/g, "&#x27;")}"`,
    );
  });

  it("names the last pill Write my own, with the plus hidden from assistive technology", () => {
    const html = render();
    expect(html).toContain(`aria-label="${DESK_COPY.writeOwn}"`);
    expect(html).toMatch(/<span aria-hidden="true">\+ <\/span>/);
  });

  it("drops a suggestion that a row already holds", () => {
    const [first] = suggestionsFor("year", []);
    const html = render([first ?? ""]);
    expect(html).not.toContain(
      `aria-label="${DESK_COPY.addSuggestion.replace("{text}", first ?? "").replace(/'/g, "&#x27;")}"`,
    );
  });

  it("shows only Write my own when no suggestion remains", () => {
    const all = [...OCCASIONS[0]!.suggestions, ...SHARED_SUGGESTIONS];
    const html = render(all);
    expect(html.match(/data-add-row=""/g)).toHaveLength(1);
    expect(html).toContain(DESK_COPY.writeOwn);
  });
});
