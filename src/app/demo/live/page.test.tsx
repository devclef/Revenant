import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LIVE_COPY } from "@/components/live/copy";
import pageShell from "@/components/ui/PageShell.module.css";
import sceneStyles from "@/components/ceremony/scene/scene.module.css";
import { SCENE_COPY } from "@/components/ceremony/scene/copy";

const pageShellClass = pageShell.shell;
const sceneClass = sceneStyles.scene;

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
    // The only button is the Top_Bar's Calm control. No seal control renders.
    expect(html.match(/<button/g)?.length ?? 0).toBe(1);
  });

  it("renders the Seal_Page with rpId and appOrigin when RP_ID is set", async () => {
    vi.stubEnv("RP_ID", "revenant.devclef.se");
    vi.stubEnv("APP_ORIGIN", "https://revenant.devclef.se/");
    const html = await renderLivePage();
    expect(html).toContain('data-rp-id="revenant.devclef.se"');
    // The trailing slash is dropped so the origin has no trailing slash.
    expect(html).toContain('data-app-origin="https://revenant.devclef.se"');
    expect(html).toContain("data-live-stepper");
    expect(html).toContain(LIVE_COPY.letterLabel);
    expect(html).not.toContain(LIVE_COPY.unavailable);
  });

  it("sits on the plain Scene shell, not PageShell (spec 07 task 1)", async () => {
    vi.stubEnv("RP_ID", "");
    vi.stubEnv("APP_ORIGIN", "");
    const html = await renderLivePage();
    // The plain shell carries the scene token class and no PageShell class.
    expect(html).not.toContain(pageShellClass);
    expect(html).toContain(sceneClass);
    // The plain shell has no ceremony root.
    expect(html).not.toContain("data-ceremony=");
  });

  it("shows the Demo chip and a wordmark that links to /", async () => {
    vi.stubEnv("RP_ID", "");
    vi.stubEnv("APP_ORIGIN", "");
    const html = await renderLivePage();
    expect(html).toContain(SCENE_COPY.demoChip);
    expect(html).toContain('href="/"');
    expect(html).toContain("data-wordmark");
  });
});

