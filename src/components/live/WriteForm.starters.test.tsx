import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PickableSeries } from "./catalogue-list";
import { promptStarters } from "./copy";
import { WriteForm, type WriteFormProps } from "./WriteForm";
import type { SealState } from "./seal-machine";

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

describe("WriteForm write step with prompt starters (issue #269)", () => {
  it("starts with the letter field empty", () => {
    const html = render();
    expect(html).toMatch(/<textarea[^>]*id="live-letter"[^>]*><\/textarea>/);
  });

  it("renders the three starter buttons under the letter field", () => {
    const html = render();
    const field = html.indexOf('id="live-letter"');
    const group = html.indexOf('role="group"');
    expect(group).toBeGreaterThan(field);
    for (const starter of promptStarters) {
      expect(html).toContain(`>${starter}</button>`);
    }
  });
});
