import { createElement } from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LIVE_COPY } from "../copy";

import { DESK_COPY } from "./copy";
import { LetterSheet, type LetterSheetProps } from "./LetterSheet";

/** The `.letter` rule body in sheet.module.css, comments stripped. */
function letterRuleBody(): string {
  const css = readFileSync(
    join(process.cwd(), "src/components/live/desk/sheet.module.css"),
    "utf8",
  ).replace(/\/\*[\s\S]*?\*\//g, "");
  const match = /^\.letter \{([\s\S]*?)^\}/m.exec(css);
  if (match === null) throw new Error(".letter rule not found");
  return match[1] ?? "";
}

const render = (props: Partial<LetterSheetProps> = {}) =>
  renderToStaticMarkup(
    createElement(LetterSheet, {
      value: "",
      placeholder: "A placeholder",
      problem: "",
      onChange: () => {},
      ...props,
    }),
  );

/** The text inside the textarea. React renders a textarea's value as its children. */
function textareaValue(html: string): string {
  const match = /<textarea[^>]*>([\s\S]*?)<\/textarea>/.exec(html);
  if (match === null) throw new Error("no textarea in the markup");
  return match[1] ?? "";
}

describe("LetterSheet (spec 14, W4 and W5)", () => {
  it("sets the textarea font family in one place only: the serif on letter-field", () => {
    // `.letter` must not set a font family. The serif comes from
    // letter-field.module.css (.sheetLetter), so no stylesheet order can change it.
    expect(letterRuleBody()).not.toMatch(/font-family/);
    expect(letterRuleBody()).not.toMatch(/font:/);
  });

  it("keeps the salutation, sign-off and date out of the textarea value", () => {
    const html = render({ value: "Dear me, the year went well." });
    expect(textareaValue(html)).toBe("Dear me, the year went well.");
    expect(textareaValue(html)).not.toContain(DESK_COPY.salutation);
    expect(textareaValue(html)).not.toContain(DESK_COPY.signOff);
    expect(html).toContain(`>${DESK_COPY.salutation}</p>`);
    expect(html).toContain(`>${DESK_COPY.signOff}</p>`);
  });

  it("renders an empty date slot in the server HTML, with no date text", () => {
    const html = render();
    expect(html).toMatch(/<span[^>]*data-sheet-date=""[^>]*><\/span>/);
  });

  it("labels the textarea with a visually hidden 'Your letter' label", () => {
    const html = render();
    expect(html).toMatch(
      new RegExp(
        `<label[^>]*for="live-letter"[^>]*>${LIVE_COPY.letterLabel}</label>`,
      ),
    );
    expect(html).toMatch(/<textarea[^>]*id="live-letter"[^>]*>/);
  });

  it("has no maxlength, so a long letter is shown as too long, not cut", () => {
    const html = render({ value: "x".repeat(5012) });
    expect(html).not.toMatch(/maxlength/i);
  });

  it("groups the count in thousands: 1,234 of 5,000 characters", () => {
    const html = render({ value: "a".repeat(1234) });
    expect(html).toContain(`>1,234 of 5,000 characters</p>`);
  });

  it("shows the true count above 5,000: 5,012 of 5,000 characters", () => {
    const html = render({ value: "a".repeat(5012) });
    expect(html).toContain(`>5,012 of 5,000 characters</p>`);
  });

  it("counts Unicode code points, so an emoji counts once", () => {
    const html = render({ value: "😀😀" });
    expect(html).toContain(`>2 of 5,000 characters</p>`);
  });

  it("links the count and the problem line to the textarea", () => {
    const html = render({ problem: LIVE_COPY.letterEmpty });
    expect(html).toMatch(
      /<textarea[^>]*aria-describedby="live-letter-count live-letter-problem"[^>]*>/,
    );
    expect(html).toMatch(/<p[^>]*id="live-letter-count"[^>]*>/);
    expect(html).toMatch(
      new RegExp(
        `<p[^>]*id="live-letter-problem"[^>]*>${LIVE_COPY.letterEmpty}</p>`,
      ),
    );
  });

  it("keeps the problem line in the markup, empty, when there is no problem", () => {
    const html = render({ problem: "" });
    expect(html).toMatch(/<p[^>]*id="live-letter-problem"[^>]*><\/p>/);
  });

  it("shows the placeholder while the textarea is empty", () => {
    const html = render({ placeholder: "A placeholder" });
    expect(html).toMatch(/<textarea[^>]*placeholder="A placeholder"[^>]*>/);
  });

  it("renders the sign-off in the bottom row, after the textarea", () => {
    const html = render();
    expect(html.indexOf("</textarea>")).toBeLessThan(
      html.indexOf(DESK_COPY.signOff),
    );
  });
});
