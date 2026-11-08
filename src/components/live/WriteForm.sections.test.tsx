import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PickableSeries } from "./catalogue-list";
import { LIVE_COPY } from "./copy";
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
    text: "Dear me",
    metricIds: ["us-gasoline-regular"],
    warningTicked: true,
    backupCardTicked: false,
    onTextChange: () => {},
    onToggleFigure: () => {},
    onWarningChange: () => {},
    onBackupCardChange: () => {},
    onCreatePress: () => {},
    onConfirmPress: () => {},
    ...overrides,
  };
}

const render = (overrides: Partial<WriteFormProps> = {}) =>
  renderToStaticMarkup(createElement(WriteForm, props(overrides)));

describe("WriteForm sections (spec 09, D2)", () => {
  it("the write section holds the letter and a Next, and nothing else", () => {
    const html = render({ section: "write", onNext: () => {} });
    expect(html).toContain('id="live-letter"');
    expect(html).not.toContain('id="live-warning"');
    expect(html).not.toContain('data-card="live-figures"');
    expect(html).not.toContain(LIVE_COPY.createButton);
    expect(html).toContain(LIVE_COPY.nextButton);
    expect(html).not.toContain(LIVE_COPY.backButton);
  });

  it("the figures section holds the picker, with Back only when Back is offered", () => {
    const withBack = render({
      section: "figures",
      onNext: () => {},
      onBack: () => {},
    });
    expect(withBack).toContain('data-card="live-figures"');
    expect(withBack).not.toContain('id="live-letter"');
    expect(withBack).toContain(LIVE_COPY.backButton);
    expect(withBack).toContain(LIVE_COPY.nextButton);

    const noBack = render({ section: "figures", onNext: () => {} });
    expect(noBack).not.toContain(LIVE_COPY.backButton);
  });

  it("the seal section holds the passkey explanation, the warning and the press, not the letter or the picker", () => {
    const html = render({ section: "seal", onBack: () => {} });
    expect(html).toContain('id="live-warning"');
    expect(html).toContain('id="live-backup-card"');
    expect(html).toContain("Your device will ask for the passkey twice.");
    expect(html).toContain(LIVE_COPY.createButton);
    expect(html).toContain(LIVE_COPY.backButton);
    expect(html).not.toContain('id="live-letter"');
    expect(html).not.toContain('data-card="live-figures"');
    expect(html).not.toContain(LIVE_COPY.nextButton);
  });

  it("the default section is the whole form, as before", () => {
    const html = render();
    expect(html).toContain('data-card="live-write"');
    expect(html).toContain('id="live-letter"');
    expect(html).toContain('id="live-warning"');
    expect(html).toContain(LIVE_COPY.createButton);
  });
});
