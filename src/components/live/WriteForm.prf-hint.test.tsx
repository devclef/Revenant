// Static-markup tests for the PRF_Hint on the Write step (spec 08, R16.2, R16.6).
// The hint shows only on `missing`, and it blocks nothing: the create button is
// the same with the hint on or off.

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
  isFixture: false,
};

function render(extra: Partial<WriteFormProps> = {}): string {
  const props: WriteFormProps = {
    series: [SERIES],
    state: { tag: "write" } as unknown as SealState,
    cryptoLoaded: true,
    text: "Dear future me.",
    metricIds: [SERIES.metricId],
    warningTicked: true,
    backupCardTicked: false,
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

describe("WriteForm PRF_Hint", () => {
  it("shows the prfHint copy on the Write step when the hint is missing", () => {
    const html = render({ prfHint: "missing" });
    expect(html).toContain(LIVE_COPY.prfHint);
  });

  it("shows no prfHint copy when the hint is none", () => {
    expect(render({ prfHint: "none" })).not.toContain(LIVE_COPY.prfHint);
    expect(render()).not.toContain(LIVE_COPY.prfHint);
  });

  it("blocks nothing: the create button is enabled with the hint missing", () => {
    const withHint = render({ prfHint: "missing" });
    const without = render({ prfHint: "none" });
    const disabled = (html: string) => /<button[^>]*disabled=""/.test(html);
    expect(disabled(withHint)).toBe(false);
    expect(disabled(without)).toBe(false);
  });
});
