import { createElement, type RefObject } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { LIVE_COPY } from "../copy";
import { INITIAL_TOUCHED } from "../touched";

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
  receipt: {
    series: [],
    selected: [],
    onToggleFigure: () => {},
    ownNumber: { name: "", value: "", unit: "", region: "", period: "" },
    sealingDay: "2026-11-18",
    touched: INITIAL_TOUCHED,
    onTouch: () => {},
    onOwnNumberChange: () => {},
  },
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

  it("puts the receipt card in the panel column, after the sheet", () => {
    const html = render();
    const panelAt = html.search(/class="[^"]*panelColumn[^"]*"/);
    const sheetAt = html.indexOf("data-letter-sheet");
    expect(panelAt).toBeGreaterThan(sheetAt);
    expect(html.indexOf("data-receipt-panel")).toBeGreaterThan(panelAt);
    expect(html).not.toContain("data-test-next");
    expect(html).not.toContain(LIVE_COPY.receiptsAction);
  });

  it("keeps the letter out of any maxlength and shows the letter count as text", () => {
    const html = render({ text: "Hello" });
    expect(html).not.toContain("maxlength");
    expect(html).toContain("5 of 5,000 characters");
  });
});

// The failed fold moves focus, so its wiring is checked in the source (W13.3).
describe("WriteDesk failed fold (spec 14, W13.3)", () => {
  const source = readFileSync(
    new URL("./WriteDesk.tsx", import.meta.url),
    "utf8",
  );

  it("switches to the own view when the failing field is an own number", () => {
    expect(source).toContain('if (result.first?.kind === "own_number") setView("own");');
  });

  it("opens a closed phone details before focusing the failing field", () => {
    expect(source).toContain('element.closest("details")');
  });
});
