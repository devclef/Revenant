// Static-markup tests for the Backup_Only_Start wiring through WriteForm
// (spec 13, P7). The button reaches the Seal step only in the write tag, and
// its blocked state comes from the form readiness and input checks, never from
// whether a Backup_Choice was made.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PickableSeries } from "./catalogue-list";
import { LIVE_COPY } from "./copy";
import type { SealState } from "./seal-machine";
import { WriteForm, type WriteFormProps } from "./WriteForm";

const SERIES: PickableSeries = {
  metricId: "us-gasoline-regular",
  displayName: "Regular gasoline",
  unit: "USD per gallon",
  region: "U.S.",
  latestPeriod: "2026-10-26",
  periodType: "weekly",
  source:
    "U.S. Energy Information Administration (EIA), Weekly Retail Gasoline and Diesel Prices",
  isFixture: false,
};

const SEAL_FORM_TAGS = [
  "write",
  "creating",
  "created",
  "confirming",
  "preparing",
  "sealing",
] as const;

function render(extra: Partial<WriteFormProps> = {}): string {
  const props: WriteFormProps = {
    section: "seal",
    series: [SERIES],
    state: { tag: "write" } as unknown as SealState,
    cryptoLoaded: true,
    text: "Dear future me.",
    metricIds: [SERIES.metricId],
    warningTicked: true,
    backupCardTicked: false,
    backupChoice: "card",
    onBackupStart: () => undefined,
    onTextChange: () => undefined,
    onToggleFigure: () => undefined,
    onWarningChange: () => undefined,
    onBackupCardChange: () => undefined,
    onCreatePress: () => undefined,
    onConfirmPress: () => undefined,
    ...extra,
  };
  return renderToStaticMarkup(createElement(WriteForm, props));
}

const BACKUP_ONLY = "data-backup-only-start";

describe("WriteForm Backup_Only_Start (spec 13, P7)", () => {
  it("renders the Backup_Only_Start button in the write tag", () => {
    const html = render({ state: { tag: "write" } as unknown as SealState });
    expect(html).toContain(BACKUP_ONLY);
    expect(html).toContain(LIVE_COPY.fallbackButton);
  });

  it.each(SEAL_FORM_TAGS.filter((tag) => tag !== "write"))(
    "does not render the Backup_Only_Start button in the %s tag",
    (tag) => {
      const html = render({ state: { tag } as unknown as SealState });
      expect(html).not.toContain(BACKUP_ONLY);
    },
  );

  it("ignores the Backup_Choice when deciding whether the button is blocked", () => {
    const unchosen = render({ backupChoice: null });
    const chosen = render({ backupChoice: "card" });
    const ariaDisabled = (html: string) =>
      /data-backup-only-start=""[^>]*aria-disabled="true"/.test(html);
    expect(ariaDisabled(unchosen)).toBe(false);
    expect(ariaDisabled(chosen)).toBe(false);
  });

  it("marks the button blocked when the form is not ready", () => {
    const html = render({ cryptoLoaded: false });
    expect(html).toMatch(/data-backup-only-start=""[^>]*aria-disabled="true"/);
  });
});
