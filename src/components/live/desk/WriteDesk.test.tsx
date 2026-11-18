import { createElement, type RefObject } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LIVE_COPY } from "../copy";

import { DESK_COPY } from "./copy";
import { WriteDesk, type WriteDeskProps } from "./WriteDesk";

const letterRef: RefObject<HTMLTextAreaElement | null> = { current: null };

const base: WriteDeskProps = {
  chosenOccasion: "blank",
  onChooseOccasion: () => {},
  placeholder: "A placeholder",
  text: "",
  letterProblem: "",
  onLetterChange: () => {},
  onLetterBlur: () => {},
  letterRef,
  authorQuestions: createElement(
    "span",
    { "data-test-questions": "" },
    "QUESTIONS",
  ),
  receipts: createElement("span", { "data-test-receipts": "" }, "RECEIPTS"),
  actions: createElement(
    "button",
    { type: "button", "data-test-next": "" },
    "NEXT",
  ),
  check: {
    text: "",
    questions: [],
    metricIds: [],
    selfReported: [],
    maxFigures: 3,
    sealingDay: "2026-11-18",
  },
  onFoldPass: () => {},
  onFoldFail: () => {},
};

const render = (props: Partial<WriteDeskProps> = {}) =>
  renderToStaticMarkup(createElement(WriteDesk, { ...base, ...props }));

describe("WriteDesk markup (spec 14, W1 and W2)", () => {
  it("renders inside the desk root with exactly one h1, the desk heading", () => {
    const html = render();
    expect(html).toContain('data-write-desk=""');
    expect(html.split("<h1").length - 1).toBe(1);
    expect(html).toMatch(
      new RegExp(`<h1[^>]*data-step-heading=""[^>]*>${DESK_COPY.heading}</h1>`),
    );
  });

  it("shows the eyebrow as a paragraph, not a heading (W2.2)", () => {
    const html = render();
    expect(html).toMatch(
      new RegExp(`<p class="[^"]*eyebrow[^"]*">${LIVE_COPY.liveHeading}</p>`),
    );
  });

  it('lists the five Occasion pills in order, with "A blank page" pressed first', () => {
    const html = render();
    const pills = [
      ...html.matchAll(/data-occasion-pill="([a-z]+)"[^>]*>/g),
    ].map((m) => m[1]);
    expect(pills).toEqual(["year", "work", "family", "decision", "blank"]);
    expect(html).toMatch(/aria-pressed="true" data-occasion-pill="blank"/);
  });

  it("puts the author questions inside the Letter_Sheet, under the field", () => {
    const html = render();
    const sheetAt = html.indexOf("data-letter-sheet");
    const questionsAt = html.indexOf("data-test-questions");
    const sheetEnd = html.indexOf("</section>", sheetAt);
    expect(sheetAt).toBeGreaterThan(-1);
    expect(questionsAt).toBeGreaterThan(sheetAt);
    expect(questionsAt).toBeLessThan(sheetEnd);
  });

  it("puts the receipts and the action row in the panel column, after the sheet", () => {
    const html = render();
    const panelAt = html.search(/class="[^"]*panelColumn[^"]*"/);
    const sheetAt = html.indexOf("data-letter-sheet");
    expect(panelAt).toBeGreaterThan(sheetAt);
    expect(html.indexOf("data-test-receipts")).toBeGreaterThan(panelAt);
    expect(html.indexOf("data-test-next")).toBeGreaterThan(panelAt);
  });

  it("keeps the letter out of any maxlength and shows the letter count as text", () => {
    const html = render({ text: "Hello" });
    expect(html).not.toContain("maxlength");
    expect(html).toContain("5 of 5,000 characters");
  });
});
