import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SELF_REPORTED_MAX } from "./constants";
import { LIVE_COPY } from "./copy";
import { selfReportedFieldKey } from "./form";
import { SelfReportedRows, type SelfReportedRowsProps } from "./SelfReportedRows";
import { INITIAL_TOUCHED, markAttempted, markTouched } from "./touched";
import {
  INITIAL_WRITE_DRAFT,
  initialWriteDraft,
  type SelfReportedRow,
} from "./write-draft";

const noop = () => {};
const SEALING_DAY = "2026-11-09";

const GOOD_ROW: SelfReportedRow = {
  name: "Rent",
  value: "950",
  unit: "per month",
  region: "My city",
  period: "2026-09",
};

function render(overrides: Partial<SelfReportedRowsProps> = {}): string {
  return renderToStaticMarkup(
    createElement(SelfReportedRows, {
      rows: [],
      sealingDay: SEALING_DAY,
      touched: INITIAL_TOUCHED,
      onTouch: noop,
      onAdd: noop,
      onChange: noop,
      onRemove: noop,
      ...overrides,
    }),
  );
}

/** The markup of each row, split on the row's class stem. */
function rowsOf(html: string): string[] {
  return html.split(/<div class="[^"]*selfRow[^"]*"/).slice(1);
}

describe("SelfReportedRows copy (spec 08 later-tasks, R26.1)", () => {
  it("uses the group heading and the add label", () => {
    expect(LIVE_COPY.selfReportedTitle).toBe("Your own numbers");
    expect(LIVE_COPY.selfReportedAdd).toBe("Add a number of your own");
  });

  it("names the five fields", () => {
    const html = render({ rows: [GOOD_ROW] });
    for (const label of [
      LIVE_COPY.selfReportedNameLabel,
      LIVE_COPY.selfReportedValueLabel,
      LIVE_COPY.selfReportedUnitLabel,
      LIVE_COPY.selfReportedRegionLabel,
      LIVE_COPY.selfReportedPeriodLabel,
    ]) {
      expect(html).toContain(label.replace(/'/g, "&#x27;"));
    }
  });
});

describe("SelfReportedRows rendering", () => {
  it("renders a fieldset whose legend is the group heading", () => {
    const html = render();
    expect(html).toContain("<fieldset");
    expect(html).toContain("<legend");
    expect(html).toContain(LIVE_COPY.selfReportedTitle);
  });

  it("shows no rows and the add button when empty", () => {
    const html = render({ rows: [] });
    expect(rowsOf(html)).toHaveLength(0);
    expect(html).toContain(LIVE_COPY.selfReportedAdd);
    expect(html).not.toContain("data-user-content");
  });

  it("gives each field a label tied to an input carrying data-user-content", () => {
    const html = render({ rows: [GOOD_ROW] });
    const inputs = html.match(/<input[^>]*>/g) ?? [];
    expect(inputs).toHaveLength(5);
    for (const input of inputs) {
      expect(input).toContain('data-user-content=""');
      expect(input).toMatch(/id="[^"]+"/);
    }
    const ids = inputs.map((input) => /id="([^"]+)"/.exec(input)?.[1]);
    for (const id of ids) {
      expect(html).toContain(`for="${id}"`);
    }
  });

  it("keeps the typed value in the input as written", () => {
    const html = render({ rows: [{ ...GOOD_ROW, value: " 3.4125 " }] });
    expect(html).toContain('value=" 3.4125 "');
  });

  it("labels each row Number n with a Remove button", () => {
    const html = render({ rows: [GOOD_ROW, GOOD_ROW] });
    expect(html).toContain("Number 1");
    expect(html).toContain("Number 2");
    expect(html).toContain("Remove number 1");
    expect(html).toContain("Remove number 2");
    expect(html).not.toContain("Number 3");
  });

  it("offers Add while fewer than the maximum rows exist, and the limit at the maximum", () => {
    const full = Array.from({ length: SELF_REPORTED_MAX }, () => GOOD_ROW);
    expect(render({ rows: full })).not.toContain(LIVE_COPY.selfReportedAdd);
    expect(render({ rows: full })).toContain(LIVE_COPY.selfReportedLimit);
    expect(render({ rows: [GOOD_ROW] })).toContain(LIVE_COPY.selfReportedAdd);
  });

  it("shows no problem message for a valid row, even when touched", () => {
    const html = render({
      rows: [GOOD_ROW],
      touched: markAttempted(INITIAL_TOUCHED),
    });
    expect(html).not.toContain(LIVE_COPY.selfReportedValue);
    expect(html).not.toContain(LIVE_COPY.selfReportedPeriod);
    expect(html).not.toContain(LIVE_COPY.selfReportedTextLength);
  });

  it("shows a field's message only once that field is touched", () => {
    const badValue: SelfReportedRow = { ...GOOD_ROW, value: "1e3" };
    const untouched = render({ rows: [badValue] });
    expect(untouched).not.toContain(LIVE_COPY.selfReportedValue);

    const touched = render({
      rows: [badValue],
      touched: markTouched(INITIAL_TOUCHED, selfReportedFieldKey(0, "value")),
    });
    expect(touched).toContain(LIVE_COPY.selfReportedValue);
  });

  it("shows the message for a bad period after a seal attempt", () => {
    const badPeriod: SelfReportedRow = { ...GOOD_ROW, period: "2030-01" };
    const html = render({
      rows: [badPeriod],
      touched: markAttempted(INITIAL_TOUCHED),
    });
    expect(html).toContain(LIVE_COPY.selfReportedPeriod);
    expect(html).toContain('aria-invalid="true"');
  });
});

describe("SelfReportedRows blank and partly filled rows (spec 08 later-tasks, R26.1)", () => {
  const BLANK_ROW: SelfReportedRow = {
    name: "",
    value: "",
    unit: "",
    region: "",
    period: "",
  };
  const PARTIAL_ROW: SelfReportedRow = { ...GOOD_ROW, value: "", period: "" };
  const missingLine = (text: string) =>
    LIVE_COPY.selfReportedMissing.replace("{fields}", text);

  it("starts with no row, so a new letter shows no number", () => {
    const draft = initialWriteDraft("real");
    expect(draft.selfReported).toEqual([]);
    expect(INITIAL_WRITE_DRAFT.selfReported).toEqual([]);
    expect(rowsOf(render({ rows: draft.selfReported }))).toHaveLength(0);
  });

  it("flags nothing for a blank row, even after a seal attempt", () => {
    const html = render({
      rows: [BLANK_ROW],
      touched: markAttempted(INITIAL_TOUCHED),
    });
    expect(rowsOf(html)).toHaveLength(1);
    expect(html).not.toContain("Still to fill in");
    expect(html).not.toContain(LIVE_COPY.selfReportedTextLength);
  });

  it("names the empty fields of a partly filled row once the row was touched", () => {
    const html = render({
      rows: [PARTIAL_ROW],
      touched: markTouched(INITIAL_TOUCHED, selfReportedFieldKey(0, "name")),
    });
    expect(html).toContain(missingLine("value, period"));
  });

  it("names the empty fields after a seal attempt, even untouched", () => {
    const html = render({
      rows: [PARTIAL_ROW],
      touched: markAttempted(INITIAL_TOUCHED),
    });
    expect(html).toContain(missingLine("value, period"));
  });

  it("shows no missing line on first load for a partly filled row", () => {
    const html = render({ rows: [PARTIAL_ROW] });
    expect(html).not.toContain("Still to fill in");
  });

  it("does not repeat a length message for an empty field", () => {
    const html = render({
      rows: [{ ...GOOD_ROW, name: "" }],
      touched: markAttempted(INITIAL_TOUCHED),
    });
    expect(html).toContain(missingLine("name"));
    expect(html).not.toContain(LIVE_COPY.selfReportedTextLength);
  });
});
