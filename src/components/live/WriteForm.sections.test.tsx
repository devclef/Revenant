import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PickableSeries } from "./catalogue-list";
import { DESK_COPY } from "./desk/copy";
import { LIVE_COPY } from "./copy";
import { PRESS_COPY } from "./press/copy";
import { WriteForm, type WriteFormProps } from "./WriteForm";
import type { SealState } from "./seal-machine";

const SERIES: PickableSeries[] = [
  {
    metricId: "us-gasoline-regular",
    displayName: "Regular gasoline",
    unit: "USD per gallon",
    region: "U.S.",
    latestPeriod: "2026-10-26",
    periodType: "weekly",
    source: "U.S. Energy Information Administration (EIA), Weekly Retail Gasoline and Diesel Prices",
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
  it("the write section holds the letter, the question rows, the closed receipts and the Fold_Button", () => {
    const html = render({ section: "write", onNext: () => {} });
    expect(html).toContain('id="live-letter"');
    expect(html).not.toContain('id="live-warning"');
    expect(html).toContain("data-receipt-panel");
    expect(html).not.toContain("data-receipts-disclosure");
    expect(html).not.toContain(LIVE_COPY.createButton);
    expect(html).toContain(DESK_COPY.fold);
    expect(html).not.toContain(LIVE_COPY.backButton);
  });

  // L1.4 (spec 11), on the desk (spec 14 W10): the receipt card sits after the
  // question rows, not before them.
  it("puts the receipt card after the question rows", () => {
    const html = render({ section: "write", onNext: () => {} });
    const rows = html.indexOf("data-question-section");
    const receipts = html.indexOf("data-receipt-panel");
    expect(rows).toBeGreaterThanOrEqual(0);
    expect(receipts).toBeGreaterThan(rows);
  });

  // L3.5 (spec 11), on the desk (spec 14 W6): above Next the write step holds,
  // in this order, the Occasion control, the letter field, the P.S. section
  // with its intro and pills, and the receipt card.
  it("holds the write markup in order, with the receipt card before the Fold_Button", () => {
    const html = render({ section: "write", onNext: () => {} });
    const occasion = html.indexOf(DESK_COPY.startFrom);
    const letter = html.indexOf('id="live-letter"');
    const add = html.indexOf("data-question-section");
    const hint = html.indexOf(DESK_COPY.psIntro.replace(/'/g, "&#x27;"));
    const receipts = html.indexOf("data-receipt-panel");
    const next = html.indexOf(DESK_COPY.fold);
    for (const index of [occasion, letter, add, hint, receipts, next]) {
      expect(index).toBeGreaterThan(-1);
    }
    expect(occasion).toBeLessThan(letter);
    expect(letter).toBeLessThan(add);
    expect(add).toBeLessThan(hint);
    expect(hint).toBeLessThan(receipts);
    expect(receipts).toBeLessThan(next);
    // No Rehearsal_Line above Next (it belongs to the heading, task 13).
    expect(html).not.toContain("rehearsal");
  });

  // L1.6: the figures step is gone, so Back is offered only from the seal step.
  it("offers Back on the seal section only when Back is passed", () => {
    // Back is a text link inside the Seal step (spec 14, S5.3). Without onBack it stays, disabled.
    const withBack = render({ section: "seal", onBack: () => {} });
    expect(withBack).toContain(LIVE_COPY.backToLetter);
    expect(withBack).toMatch(/data-back-to-letter=""(?! disabled)/);

    const noBack = render({ section: "seal" });
    expect(noBack).toContain(LIVE_COPY.backToLetter);
    expect(noBack).toMatch(/data-back-to-letter="" disabled=""/);
  });

  it("the seal section holds the passkey explanation, the warning and the press, not the letter or the picker", () => {
    const html = render({ section: "seal", onBack: () => {} });
    expect(html).toContain('data-backup-choice');
    expect(html).toContain('id="live-backup-choice-card"');
    expect(html).toContain('id="live-backup-choice-skip"');
    expect(html).not.toContain('id="live-warning"');
    expect(html).not.toContain('id="live-backup-card"');
    // The Warning_Text stays as body text in the seal section, outside any details (P6.1, P6.2).
    expect(html).toContain(LIVE_COPY.warning);
    const warningAt = html.indexOf(LIVE_COPY.warning);
    const openDetails = html.lastIndexOf("<details", warningAt);
    const closeDetails = html.lastIndexOf("</details>", warningAt);
    expect(openDetails < 0 || closeDetails > openDetails).toBe(true);
    expect(html).toContain(LIVE_COPY.sealParagraph);
    expect(html).toContain(PRESS_COPY.name);
    expect(html).toContain(LIVE_COPY.backButton);
    expect(html).not.toContain('id="live-letter"');
    expect(html).not.toContain('data-card="live-figures"');
    expect(html).not.toContain(DESK_COPY.fold);
  });

  // P1 and P7: one press, the only orange control, and the Backup_Choice has
  // two radios with none checked.
  it("the seal section has one press, no primary button and two unchecked radios", () => {
    const html = render({ section: "seal", onBack: () => {} });
    expect(html.match(/aria-label="Press the seal"/g)).toHaveLength(1);
    expect(html).not.toContain(LIVE_COPY.createButton);
    expect(html.match(/type="radio"/g)).toHaveLength(2);
    expect(html).not.toMatch(/checked=""/);
    // Backup_Choice comes before the press, which stays disabled until a choice.
    expect(html.indexOf("data-backup-choice")).toBeLessThan(
      html.indexOf("aria-label=\"Press the seal\""),
    );
    expect(html).toMatch(/aria-label="Press the seal"[^>]*aria-disabled="true"/);
  });

  // P5: the Setting_State press has one plain line and no confirm label.
  it("the Setting_State shows its plain line and no Confirm your passkey label", () => {
    const html = render({
      section: "seal",
      onBack: () => {},
      state: { tag: "created" } satisfies SealState,
      backupChoice: "skip",
    });
    expect(html).toContain(PRESS_COPY.setting);
    expect(html).not.toContain(LIVE_COPY.confirmButton);
    expect(html).not.toContain("Confirm your passkey");
  });

  it("the default section is the whole form, as before", () => {
    const html = render();
    expect(html).toContain('data-card="live-write"');
    expect(html).toContain('id="live-letter"');
    expect(html).toContain('id="live-warning"');
    expect(html).toContain(LIVE_COPY.createButton);
  });
});

// W6 (spec 11): one Add a receipt control, beside Next, and no Receipts link.
describe("WriteForm receipt card (spec 14, W10.2)", () => {
  it("offers no Add a receipt control on the write step", () => {
    const html = render({ section: "write", onNext: () => {} });
    expect(html).not.toContain(LIVE_COPY.receiptsAction);
    expect(html).not.toContain("writeActions");
  });

  it("has no Receipts link anywhere on the write step", () => {
    const html = render({ section: "write", onNext: () => {} });
    expect(html).not.toMatch(/<a\b[^>]*>\s*Receipts\s*<\/a>/);
    expect(html).not.toMatch(/<a\b[^>]*>[^<]*Receipts[^<]*<\/a>/);
  });

  it("shows the receipt card once, with the public view first", () => {
    const html = render({ section: "write", onNext: () => {} });
    expect(html.split("data-receipt-panel").length - 1).toBe(1);
    expect(html).toContain(DESK_COPY.receiptTitle);
    expect(html).not.toContain("data-receipts-disclosure");
  });
});
