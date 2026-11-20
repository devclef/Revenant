import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { UI_COPY } from "@/components/ui/copy";

// `server-only` throws outside a server runtime. Tests run in Node.
vi.mock("server-only", () => ({}));

// Capture the props the page hands to SealPage, without rendering the flow.
const sealPageCalls: Array<Record<string, unknown>> = [];
vi.mock("@/components/live/SealPage", () => ({
  SealPage: (props: Record<string, unknown>) => {
    sealPageCalls.push(props);
    return null;
  },
}));

vi.mock("@/components/ceremony/scene/SceneShell", () => ({
  SceneShell: ({ children }: { children: unknown }) => children,
}));

// The not-found screen (BrandedPage) uses the motion and skip providers.
vi.mock("@/components/ceremony/motion", () => ({
  useMotion: () => ({ mode: "full", setCalm: () => {} }),
  MotionProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/ceremony/skip", () => ({
  useSequence: () => ({ hasActive: false, register: () => () => {}, skipAll: () => {} }),
  SkipProvider: ({ children }: { children: ReactNode }) => children,
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  sealPageCalls.length = 0;
});

async function loadPage() {
  return (await import("./page")).default;
}

describe("/seal page", () => {
  it("shows the not-found screen while REAL_SEALING is off (R25.5)", async () => {
    vi.stubEnv("REAL_SEALING", "");
    vi.stubEnv("RP_ID", "revenant.devclef.se");
    const RealSealPage = await loadPage();
    const html = renderToStaticMarkup(createElement(RealSealPage));
    expect(html).toContain(UI_COPY.notFound.heading);
    expect(html).toContain(UI_COPY.notFound.body);
    expect(html).toContain('href="/demo/live"');
    expect(html).toContain('href="/demo"');
    expect(sealPageCalls).toHaveLength(0);
  });

  it("shows the not-found screen for any value other than exactly \"on\" (R25.4)", async () => {
    vi.stubEnv("REAL_SEALING", "yes");
    vi.stubEnv("RP_ID", "revenant.devclef.se");
    const RealSealPage = await loadPage();
    const html = renderToStaticMarkup(createElement(RealSealPage));
    expect(html).toContain(UI_COPY.notFound.heading);
    expect(sealPageCalls).toHaveLength(0);
  });

  it("renders SealPage in real mode when REAL_SEALING is on", async () => {
    vi.stubEnv("REAL_SEALING", "on");
    vi.stubEnv("RP_ID", "revenant.devclef.se");
    vi.stubEnv("APP_ORIGIN", "https://revenant.devclef.se/");
    const RealSealPage = await loadPage();
    renderToStaticMarkup(createElement(RealSealPage));
    expect(sealPageCalls).toHaveLength(1);
    expect(sealPageCalls[0]).toMatchObject({
      rpId: "revenant.devclef.se",
      appOrigin: "https://revenant.devclef.se",
      mode: "real",
    });
  });
});
