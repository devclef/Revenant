import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PickableSeries } from "./catalogue-list";
import { LIVE_COPY } from "./copy";
import { OCCASIONS } from "./occasions";
import type { SealState } from "./seal-machine";
import { WriteForm, type WriteFormProps } from "./WriteForm";

const SERIES: PickableSeries[] = [
  {
    metricId: "us-gasoline-regular",
    displayName: "Regular gasoline",
    unit: "USD per gallon",
    region: "U.S.",
    latestPeriod: "2026-10-26",
    isFixture: false,
  },
];

function props(overrides: Partial<WriteFormProps> = {}): WriteFormProps {
  return {
    series: SERIES,
    state: { tag: "write" } satisfies SealState,
    cryptoLoaded: true,
    text: "",
    metricIds: [],
    warningTicked: false,
    backupCardTicked: false,
    onTextChange: () => {},
    onToggleFigure: () => {},
    onWarningChange: () => {},
    onBackupCardChange: () => {},
    onCreatePress: () => {},
    onConfirmPress: () => {},
    section: "write",
    onNext: () => {},
    ...overrides,
  };
}

const render = (overrides: Partial<WriteFormProps> = {}) =>
  renderToStaticMarkup(createElement(WriteForm, props(overrides)));

// Retired in spec 11 (L2.7). None of these may render again.
const RETIRED = [
  "Right now, the thing on my mind is",
  "Today, the thing I most want to remember is",
  "Over the past few months, I have been",
  "What was on your mind most days?",
  "Start from one:",
];

describe("WriteForm Occasion row above the letter field (spec 11, L2.1)", () => {
  it("renders the Occasion legend and buttons before the letter field", () => {
    const html = render();
    const legend = html.indexOf(LIVE_COPY.occasionLegend);
    const field = html.indexOf('id="live-letter"');
    expect(legend).toBeGreaterThan(-1);
    expect(legend).toBeLessThan(field);
    for (const id of OCCASIONS.map((o) => o.id)) {
      expect(html).toContain(`>${LIVE_COPY.occasionLabels[id]}</button>`);
    }
  });

  it("still renders the letter field empty", () => {
    const html = render();
    expect(html).toMatch(/<textarea[^>]*id="live-letter"[^>]*><\/textarea>/);
  });

  it("renders no Prompt_Starters or Question_Starters", () => {
    const html = render();
    for (const sentence of RETIRED) {
      expect(html, sentence).not.toContain(sentence.replace(/'/g, "&#x27;"));
    }
  });

  it("drops the answer-in-letter line and keeps the one question hint under the rows", () => {
    const html = render();
    expect(html).not.toContain(LIVE_COPY.answerInLetter);
    expect(html).toContain(
      LIVE_COPY.authorQuestionsHint.replace(/'/g, "&#x27;"),
    );
  });
});
