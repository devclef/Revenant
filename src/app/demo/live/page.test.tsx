import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LIVE_COPY } from "@/components/live/copy";

/**
 * Markup tests for `/demo/live` (spec 06, R12.8). The page reads RP_ID and
 * APP_ORIGIN from the environment at request time, so each test sets them with
 * vi.stubEnv and then calls the page function.
 */

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function renderLivePage(): Promise<string> {
  const { default: LivePage } = await import("./page");
  return renderToStaticMarkup(createElement(LivePage));
}

describe("/demo/live page", () => {
  it("shows the unavailable state with a link to /demo when RP_ID is empty (R12.8)", async () => {
    vi.stubEnv("RP_ID", "");
    vi.stubEnv("APP_ORIGIN", "");
    const html = await renderLivePage();
    expect(html).toContain(LIVE_COPY.unavailable);
    expect(html).toContain('href="/demo"');
    expect(html).not.toContain("data-rp-id");
    expect(html).not.toContain("<button");
  });

  it("renders the Seal_Page with rpId and appOrigin when RP_ID is set", async () => {
    vi.stubEnv("RP_ID", "revenant.devclef.se");
    vi.stubEnv("APP_ORIGIN", "https://revenant.devclef.se/");
    const html = await renderLivePage();
    expect(html).toContain('data-rp-id="revenant.devclef.se"');
    // The trailing slash is dropped so the origin has no trailing slash.
    expect(html).toContain('data-app-origin="https://revenant.devclef.se"');
    expect(html).toContain(LIVE_COPY.heading);
    expect(html).not.toContain(LIVE_COPY.unavailable);
  });
});
