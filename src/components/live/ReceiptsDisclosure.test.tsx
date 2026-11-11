import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LIVE_COPY } from "./copy";
import { ReceiptsDisclosure, type ReceiptsStatus } from "./ReceiptsDisclosure";

// The disclosure is rewritten for L1.4 and L1.5 (spec 11): one closed native
// details, titled "Add a receipt", with the explain line first and the picker
// and the self-reported rows inside the markup.
function render(status: ReceiptsStatus) {
  return renderToStaticMarkup(
    createElement(ReceiptsDisclosure, {
      status,
      picker: createElement("span", { "data-picker": "" }, "picker"),
      selfReported: createElement("span", { "data-own-numbers": "" }, "own"),
    }),
  );
}

describe("ReceiptsDisclosure copy", () => {
  it("uses the exact copy strings from the spec", () => {
    expect(LIVE_COPY.receiptsSummary).toBe("Add a receipt");
    expect(LIVE_COPY.receiptsExplain).toBe(
      "A receipt is a number sealed with its source and date, so you can compare it when the letter opens.",
    );
    expect(LIVE_COPY.receiptsLoading).toBe("Loading the receipts you can add.");
    expect(LIVE_COPY.receiptsUnavailable).toBe(
      "Receipts can't be added right now. Your letter doesn't need one.",
    );
  });
});

describe("ReceiptsDisclosure markup", () => {
  it("is one native details, closed by default, titled Add a receipt", () => {
    const html = render("ready");
    const match = html.match(/<details[^>]*>/);
    expect(match).not.toBeNull();
    expect(match?.[0]).not.toMatch(/\sopen(\s|=|>)/);
    expect(html.match(/<details/g)).toHaveLength(1);
    expect(html).toMatch(
      new RegExp(`<summary[^>]*>${LIVE_COPY.receiptsSummary}</summary>`),
    );
  });

  it("puts the explain sentence first, before the picker", () => {
    const html = render("ready");
    const explain = html.indexOf(
      LIVE_COPY.receiptsExplain.replace(/'/g, "&#x27;"),
    );
    const picker = html.indexOf("data-picker");
    expect(explain).toBeGreaterThan(-1);
    expect(explain).toBeLessThan(picker);
  });

  it("keeps the picker and the own-numbers rows inside the details", () => {
    const html = render("ready");
    const open = html.indexOf("<details");
    const close = html.indexOf("</details>");
    expect(html.indexOf("data-picker")).toBeGreaterThan(open);
    expect(html.indexOf("data-picker")).toBeLessThan(close);
    expect(html.indexOf("data-own-numbers")).toBeGreaterThan(open);
    expect(html.indexOf("data-own-numbers")).toBeLessThan(close);
  });
});

describe("ReceiptsDisclosure status", () => {
  it("shows the loading line and no picker while loading", () => {
    const html = render("loading");
    expect(html).toContain(LIVE_COPY.receiptsLoading);
    expect(html).not.toContain("data-picker");
  });

  it("shows the unavailable line and no picker when failed", () => {
    const html = render("failed");
    // React escapes the apostrophes in static markup.
    expect(html).toContain(
      LIVE_COPY.receiptsUnavailable.replace(/'/g, "&#x27;"),
    );
    expect(html).not.toContain(LIVE_COPY.receiptsLoading);
    expect(html).not.toContain("data-picker");
  });

  it("never says to check the connection or reload", () => {
    for (const status of ["loading", "failed"] as const) {
      const html = render(status).toLowerCase();
      expect(html).not.toContain("check your connection");
      expect(html).not.toContain("reload");
    }
  });

  it("renders the picker when ready and no status line", () => {
    const html = render("ready");
    expect(html).toContain("data-picker");
    expect(html).not.toContain('role="status"');
  });

  it("keeps the own-numbers rows in every status", () => {
    for (const status of ["loading", "ready", "failed"] as const) {
      expect(render(status), status).toContain("data-own-numbers");
    }
  });
});
