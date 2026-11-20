// Feature: 14-write-desk, Task 5.6 (W1.3, W9.4, W13.4). Markup tests for the
// Envelope_Panel. Static render only, no DOM.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LIVE_COPY } from "../copy";

import { DESK_COPY } from "./copy";
import { EnvelopePanel, type EnvelopePanelProps } from "./EnvelopePanel";
import type { WriteCheckInput } from "./write-check";

const PASSING: WriteCheckInput = {
  text: "Dear me, the rent is still due on the first.",
  questions: [],
  metricIds: ["us-gasoline-regular"],
  selfReported: [],
  maxFigures: 4,
  sealingDay: "2026-11-18",
};

const FAILING: WriteCheckInput = { ...PASSING, text: "" };

const render = (props: Partial<EnvelopePanelProps> = {}) =>
  renderToStaticMarkup(
    createElement(EnvelopePanel, {
      checkInput: PASSING,
      failed: false,
      onFold: () => {},
      receipts: null,
      ...props,
    }),
  );

/** How many times `needle` appears in `html`. */
const count = (html: string, needle: string) =>
  html.split(needle).length - 1;

describe("EnvelopePanel (spec 14, W1.3, W9, W13)", () => {
  it("renders the Rehearsal_Line exactly once when the step asks for it", () => {
    const html = render({ rehearsal: true });
    expect(count(html, LIVE_COPY.rehearsalLine)).toBe(1);
    expect(html).toMatch(/<p[^>]*data-live-rehearsal=""[^>]*>/);
  });

  it("renders no Rehearsal_Line when the step does not ask for it", () => {
    const html = render({ rehearsal: false });
    expect(html).not.toContain(LIVE_COPY.rehearsalLine);
    expect(html).not.toContain("data-live-rehearsal");
  });

  it("renders the Rehearsal_Line after the Fold_Button", () => {
    const html = render({ rehearsal: true });
    expect(html.indexOf("data-live-rehearsal")).toBeGreaterThan(
      html.indexOf("data-fold-button"),
    );
  });

  it("renders the In_The_Envelope_Card, the Fold_Button and the panel marker", () => {
    const html = render();
    expect(html).toMatch(/<div[^>]*data-envelope-panel=""[^>]*>/);
    expect(html).toMatch(/<section[^>]*data-in-envelope=""/);
    expect(count(html, "data-fold-button")).toBe(1);
    expect(html.indexOf("data-in-envelope")).toBeLessThan(
      html.indexOf("data-fold-button"),
    );
  });

  it("does not set data-sticky on the server render, since the panel measures itself after mount", () => {
    expect(render()).not.toMatch(/data-sticky/);
  });

  it("sets data-ready on the small seal when the draft passes the Write_Check", () => {
    const html = render({ checkInput: PASSING });
    expect(html).toMatch(/data-small-seal="" data-ready=""/);
  });

  it("leaves data-ready off the small seal when the draft fails the Write_Check", () => {
    const html = render({ checkInput: FAILING });
    expect(html).toMatch(/data-small-seal=""[^>]*>/);
    expect(html).not.toMatch(/data-small-seal="" data-ready/);
  });

  it("keeps the seal at 35% while a question has no answer (spec 15, R7.6)", () => {
    const html = render({
      checkInput: { ...PASSING, questions: ["Who was there?"], answers: [""] },
    });
    expect(html).toMatch(/data-small-seal=""[^>]*>/);
    expect(html).not.toMatch(/data-small-seal="" data-ready/);
  });

  it("brings the seal to full strength once every question is answered (spec 15, R7.6)", () => {
    const html = render({
      checkInput: {
        ...PASSING,
        questions: ["Who was there?"],
        answers: ["My sister."],
      },
    });
    expect(html).toMatch(/data-small-seal="" data-ready=""/);
  });

  it("keeps the seal at 35% when an answer is over 1,000 characters (spec 15, R7.3)", () => {
    const html = render({
      checkInput: {
        ...PASSING,
        questions: ["Who was there?"],
        answers: ["a".repeat(1001)],
      },
    });
    expect(html).not.toMatch(/data-small-seal="" data-ready/);
  });

  it("shows the failed-fold summary only when the fold failed", () => {
    expect(render({ failed: false })).not.toContain(DESK_COPY.foldFailed);
    expect(render({ failed: true })).toContain(DESK_COPY.foldFailed);
  });
});
