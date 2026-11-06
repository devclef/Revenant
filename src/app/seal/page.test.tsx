import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

// `server-only` throws outside a server runtime. Tests run in Node.
vi.mock("server-only", () => ({}));

// notFound() throws in Next. The stand-in throws a marked error so the test
// can see that the page asked for a 404.
const NOT_FOUND = "NEXT_NOT_FOUND";
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error(NOT_FOUND);
  },
}));

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

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  sealPageCalls.length = 0;
});

async function loadPage() {
  return (await import("./page")).default;
}

describe("/seal page", () => {
  it("is not found while REAL_SEALING is off (R25.5)", async () => {
    vi.stubEnv("REAL_SEALING", "");
    vi.stubEnv("RP_ID", "revenant.devclef.se");
    const RealSealPage = await loadPage();
    expect(() => renderToStaticMarkup(createElement(RealSealPage))).toThrow(
      NOT_FOUND,
    );
    expect(sealPageCalls).toHaveLength(0);
  });

  it("is not found for any value other than exactly \"on\" (R25.4)", async () => {
    vi.stubEnv("REAL_SEALING", "yes");
    vi.stubEnv("RP_ID", "revenant.devclef.se");
    const RealSealPage = await loadPage();
    expect(() => renderToStaticMarkup(createElement(RealSealPage))).toThrow(
      NOT_FOUND,
    );
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
