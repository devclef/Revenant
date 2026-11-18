// Feature: 14-write-desk, Task 6 (W12). Markup tests for the Own_Number_View.
// Static render only, no DOM.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { markTouched, INITIAL_TOUCHED } from "../touched";
import { selfReportedFieldKey } from "../form";
import type { SelfReportedRow } from "../write-draft";

import { DESK_COPY } from "./copy";
import { OwnNumberView, type OwnNumberViewProps } from "./OwnNumberView";

/** React writes an apostrophe in text as &#x27;, so tests compare the escaped form. */
const escapeHtml = (text: string): string => text.replace(/'/g, "&#x27;");

const BLANK: SelfReportedRow = {
  name: "",
  value: "",
  unit: "",
  region: "",
  period: "",
};

const FULL: SelfReportedRow = {
  name: "My rent",
  value: "1,200",
  unit: "USD per month",
  region: "My city",
  period: "2026-11-18",
};

const render = (props: Partial<OwnNumberViewProps> = {}) =>
  renderToStaticMarkup(
    createElement(OwnNumberView, {
      row: BLANK,
      sealingDay: "2026-11-18",
      touched: INITIAL_TOUCHED,
      onTouch: () => {},
      onChange: () => {},
      ...props,
    }),
  );

describe("OwnNumberView (W12)", () => {
  it("shows four labelled inputs with the placeholders for name and region", () => {
    const html = render();

    expect(html).toContain(`>${DESK_COPY.ownName}</label>`);
    expect(html).toContain(`>${DESK_COPY.ownAmount}</label>`);
    expect(html).toContain(`>${DESK_COPY.ownUnit}</label>`);
    expect(html).toContain(`>${DESK_COPY.ownWhere}</label>`);
    expect(html).toContain(`placeholder="${DESK_COPY.ownNamePlaceholder}"`);
    expect(html).toContain(`placeholder="${DESK_COPY.ownWherePlaceholder}"`);
    expect(html.match(/<input/g)?.length).toBe(4);
  });

  it("names the sealing day in the Dated line and states the self-reported line", () => {
    const html = render();

    expect(html).toContain("Dated ");
    expect(html).toContain(escapeHtml(DESK_COPY.ownMarked));
  });

  it("leaves the Dated line blank before the local day is known", () => {
    const html = render({ sealingDay: "" });

    expect(html).not.toContain("Dated ");
    expect(html).toContain(escapeHtml(DESK_COPY.ownMarked));
  });

  it("has no add, remove or limit control", () => {
    const html = render({ row: FULL });

    expect(html).not.toContain("<button");
    expect(html).not.toMatch(/Add a number|Remove number|up to 10/);
  });

  it("names the empty fields once a partly filled row is touched", () => {
    const partial: SelfReportedRow = { ...BLANK, name: "My rent" };
    const touched = markTouched(
      INITIAL_TOUCHED,
      selfReportedFieldKey(0, "name"),
    );
    const html = render({ row: partial, touched });

    expect(html).toContain(
      DESK_COPY.ownMissing.replace("{fields}", "value, unit, region"),
    );
  });

  it("does not name empty fields on a blank row, which seals nothing", () => {
    const touched = markTouched(
      INITIAL_TOUCHED,
      selfReportedFieldKey(0, "name"),
    );
    const html = render({ row: BLANK, touched });

    expect(html).not.toContain("Still to fill in");
  });

  it("keeps a typed value as the input value, not a rewritten one", () => {
    const html = render({ row: FULL });

    expect(html).toContain('value="1,200"');
    expect(html).toContain('value="My rent"');
  });
});
