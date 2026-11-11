import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LIVE_COPY } from "./copy";
import { ReceiptsDisclosure } from "./ReceiptsDisclosure";

function render(status: "loading" | "ready" | "failed") {
  return renderToStaticMarkup(
    createElement(
      ReceiptsDisclosure,
      { status },
      createElement("span", { "data-picker": "" }, "picker"),
    ),
  );
}

describe("ReceiptsDisclosure", () => {
  it("uses the exact copy strings from the spec", () => {
    expect(LIVE_COPY.receiptsLoading).toBe("Loading the receipts you can add.");
    expect(LIVE_COPY.receiptsUnavailable).toBe(
      "Receipts can't be added right now. Your letter doesn't need one.",
    );
  });

  it("shows the loading line and no picker while loading", () => {
    const html = render("loading");
    expect(html).toContain("Loading the receipts you can add.");
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
});
