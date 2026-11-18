import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LIVE_COPY } from "./copy";
import { DESK_COPY } from "./desk/copy";
import { ReceiptsDisclosure, type ReceiptsStatus } from "./ReceiptsDisclosure";
import { WriteForm } from "./WriteForm";
import type { SealState } from "./seal-machine";

// The disclosure is rewritten for L1.4 and L1.5 (spec 11): one closed native
// details, titled "Receipts", with the explain line first and the picker
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
    expect(LIVE_COPY.receiptsSummary).toBe("Receipts");
    expect(LIVE_COPY.receiptsAction).toBe("Add a receipt");
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
  it("is one native details, closed by default, titled Receipts", () => {
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

// The openRequest counter opens the disclosure and moves focus in an effect,
// which static markup never runs. The markup must still stay closed and the
// same whatever the counter holds, so the page can raise it at any time.
describe("ReceiptsDisclosure openRequest", () => {
  function renderWith(openRequest: number | undefined) {
    return renderToStaticMarkup(
      createElement(ReceiptsDisclosure, {
        status: "ready",
        picker: createElement("span", { "data-picker": "" }, "picker"),
        selfReported: createElement("span", { "data-own-numbers": "" }, "own"),
        openRequest,
      }),
    );
  }

  it("is closed in the markup whatever the counter holds", () => {
    const closedMarkup = renderWith(undefined);
    expect(renderWith(0)).toBe(closedMarkup);
    expect(renderWith(3)).toBe(closedMarkup);
    expect(renderWith(3).match(/<details[^>]*>/)?.[0]).not.toMatch(
      /\sopen(\s|=|>)/,
    );
  });

  it("keeps the picker and own-numbers rows inside the details with the counter set", () => {
    const html = renderWith(1);
    expect(html.indexOf("data-picker")).toBeGreaterThan(
      html.indexOf("<details"),
    );
    expect(html.indexOf("data-own-numbers")).toBeLessThan(
      html.indexOf("</details>"),
    );
  });
});

// source: the Write desk has no Add a receipt control. The receipt card replaces
// it (spec 14, W10.2), so the section write source no longer wires the counter.
describe("WriteForm wiring for the receipt card", () => {
  const source = readFileSync(
    new URL("./WriteForm.tsx", import.meta.url),
    "utf8",
  );

  it("no longer raises the Add a receipt counter", () => {
    expect(source).not.toContain("setReceiptsRequest");
    expect(source).not.toContain("{LIVE_COPY.receiptsAction}");
  });

  it("hands the Write desk the ReceiptPanel data, not the disclosure", () => {
    expect(source).toContain("receipt={deskReceipt}");
    expect(source).not.toContain("actions={writeActions}");
  });
});

describe("ReceiptsDisclosure closed state (spec 11, W6)", () => {
  it("shows only its summary while closed, with every receipt line inside the details", () => {
    const html = render("loading");
    const summaryEnd = html.indexOf("</summary>");
    expect(summaryEnd).toBeGreaterThan(-1);
    expect(html.indexOf(LIVE_COPY.receiptsLoading)).toBeGreaterThan(summaryEnd);
    expect(html.indexOf("data-own-numbers")).toBeGreaterThan(summaryEnd);
  });
});

// Spec 11, W6. The summary is not a visible control: it is visually hidden,
// out of the Tab order and hidden from assistive tech, so Add a receipt is the
// only way to open the disclosure.
describe("ReceiptsDisclosure hidden summary (spec 11, W6)", () => {
  it("renders the summary visually hidden, out of tab order and aria-hidden", () => {
    const html = render("ready");
    const summary = html.match(/<summary[^>]*>/)?.[0] ?? "";
    expect(summary).toContain('tabindex="-1"');
    expect(summary).toContain('aria-hidden="true"');
    expect(summary).toMatch(/class="[^"]*visuallyHidden/);
    expect(summary).not.toMatch(/moreSummary/);
  });

  it("keeps the disclosure closed in every status", () => {
    for (const status of ["loading", "ready", "failed"] as const) {
      const match = render(status).match(/<details[^>]*>/);
      expect(match?.[0], status).not.toMatch(/\sopen(\s|=|>)/);
    }
  });
});

// Example: on the Write step the words Add a receipt appear once, and no
// Receipts link exists anywhere on the step.
describe("WriteForm write step receipt control (spec 11, W6)", () => {
  it("shows one receipt card and no Add a receipt or Receipts link", () => {
    const html = renderToStaticMarkup(
      createElement(WriteForm, {
        series: [],
        state: { tag: "write" } as SealState,
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
      }),
    );
    expect(html).not.toContain(LIVE_COPY.receiptsAction);
    expect(html.split(`<h2 id="`).length - 1).toBeGreaterThanOrEqual(1);
    expect(html).toMatch(new RegExp(`<h2[^>]*>${DESK_COPY.receiptTitle}</h2>`));
    expect(html).not.toContain("data-receipts-disclosure");
    expect(html).not.toMatch(/<a\b[^>]*>[^<]*Receipts[^<]*<\/a>/);
  });
});
