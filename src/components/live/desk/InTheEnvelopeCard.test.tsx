// Feature: 14-write-desk, Task 5.6 (W9.3, W9.4, W9.5, W9.6, W9.8). Markup
// tests for the In_The_Envelope_Card. Static render only, no DOM.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DESK_COPY } from "./copy";
import { InTheEnvelopeCard, type InTheEnvelopeCardProps } from "./InTheEnvelopeCard";

const CHECKLIST: InTheEnvelopeCardProps["checklist"] = {
  letter: "3 words",
  questions: "1 of 3",
  receipt: "1 price",
  present: { letter: true, questions: true, receipt: true },
  phoneLine: "Letter · 1 question · 1 price",
};

const EMPTY: InTheEnvelopeCardProps["checklist"] = {
  letter: "not written yet",
  questions: "0 of 3",
  receipt: "none yet",
  present: { letter: false, questions: false, receipt: false },
  phoneLine: "No letter yet · no questions · no receipt",
};

const render = (props: Partial<InTheEnvelopeCardProps> = {}) =>
  renderToStaticMarkup(
    createElement(InTheEnvelopeCard, {
      checklist: CHECKLIST,
      ready: false,
      ...props,
    }),
  );

/** The opening tag of the element carrying `attr`, for attribute checks. */
function openingTagWith(html: string, attr: string): string {
  const match = html.match(new RegExp(`<[^>]*${attr}[^>]*>`));
  if (match === null) throw new Error(`no element with ${attr}`);
  return match[0];
}

describe("InTheEnvelopeCard (spec 14, W9)", () => {
  it("renders the eyebrow once, with the copy the spec names", () => {
    const html = render();
    expect(html).toContain(`>${DESK_COPY.inEnvelope}</p>`);
    expect(html.split(DESK_COPY.inEnvelope).length - 1).toBe(1);
  });

  it("hides the small envelope drawing, seal included, from assistive technology", () => {
    const html = render();
    const drawing = html.match(
      /<div[^>]*aria-hidden="true"[^>]*>(?:(?!<\/div>).)*data-small-seal(?:(?!<\/div>).)*<\/div>/,
    );
    expect(drawing, "the envelope div wraps the seal").not.toBeNull();
  });

  it("marks every Checklist_Line marker aria-hidden", () => {
    const html = render();
    const markers = html.match(/<span[^>]*data-marker="[^"]*"[^>]*>/g) ?? [];
    expect(markers).toHaveLength(3);
    for (const marker of markers) {
      expect(marker).toContain('aria-hidden="true"');
    }
  });

  it("uses no live region anywhere in the card", () => {
    const html = render();
    expect(html).not.toMatch(/aria-live=/);
    expect(html).not.toMatch(/role="(status|alert|log)"/);
  });

  it("renders the three Checklist_Lines with their labels and values", () => {
    const html = render();
    for (const key of ["letter", "questions", "receipt"]) {
      expect(html).toMatch(new RegExp(`data-checklist="${key}"`));
    }
    expect(html).toContain(`>${DESK_COPY.checkLetter}</span>`);
    expect(html).toContain(`>${DESK_COPY.checkQuestions}</span>`);
    expect(html).toContain(`>${DESK_COPY.checkReceipt}</span>`);
    expect(html).toContain(`>${CHECKLIST.letter}</span>`);
    expect(html).toContain(`>${CHECKLIST.questions}</span>`);
    expect(html).toContain(`>${CHECKLIST.receipt}</span>`);
  });

  it("marks a present item with the on marker and an absent one with the off marker", () => {
    const html = render({
      checklist: {
        ...CHECKLIST,
        present: { letter: true, questions: false, receipt: false },
      },
    });
    expect(html.match(/data-marker="on"/g)).toHaveLength(1);
    expect(html.match(/data-marker="off"/g)).toHaveLength(2);
  });

  it("shows the empty values when nothing is written", () => {
    const html = render({ checklist: EMPTY });
    expect(html).toContain(">not written yet</span>");
    expect(html).toContain(">0 of 3</span>");
    expect(html).toContain(">none yet</span>");
    expect(html.match(/data-marker="off"/g)).toHaveLength(3);
  });

  it("renders the phone line once, for the Phone view", () => {
    const html = render();
    expect(html.split(CHECKLIST.phoneLine).length - 1).toBe(1);
    expect(html).toMatch(/<p[^>]*>Letter · 1 question · 1 price<\/p>/);
  });

  it("sets data-ready on the small seal only when the check passes", () => {
    const off = render({ ready: false });
    const on = render({ ready: true });
    expect(openingTagWith(off, "data-small-seal")).not.toContain("data-ready");
    expect(openingTagWith(on, "data-small-seal")).toContain("data-ready");
  });

  it("is not a live region and carries the in-envelope marker", () => {
    const html = render();
    expect(html).toMatch(/<section[^>]*data-in-envelope=""/);
    expect(html).not.toContain("aria-live");
  });
});
