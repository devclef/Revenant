import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pageMetadata } from "@/lib/page-metadata";

// The layout imports next/font/local and next/headers, which need the Next.js
// build pipeline. Stub them so the exported generateMetadata can run in Node.
vi.mock("next/font/local", () => ({
  default: () => ({ variable: "" }),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

const ORIGIN_ENV = "APP_ORIGIN";
const FALLBACK = "http://localhost:3000/";

describe("root layout metadata", () => {
  const original = process.env[ORIGIN_ENV];

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env[ORIGIN_ENV];
    } else {
      process.env[ORIGIN_ENV] = original;
    }
  });

  async function loadMetadata() {
    const mod = await import("@/app/layout");
    return mod.generateMetadata();
  }

  it("uses the title template '%s · Revenant'", async () => {
    process.env[ORIGIN_ENV] = "https://revenant.devclef.se";
    const meta = await loadMetadata();
    expect(meta.title).toEqual({
      default: "Revenant",
      template: "%s · Revenant",
    });
  });

  it("points the icons at /icon.svg and /apple-icon", async () => {
    process.env[ORIGIN_ENV] = "https://revenant.devclef.se";
    const meta = await loadMetadata();
    expect(meta.icons).toEqual({
      icon: "/icon.svg",
      apple: "/apple-icon",
    });
  });

  it("sets metadataBase to APP_ORIGIN", async () => {
    process.env[ORIGIN_ENV] = "https://revenant.devclef.se/";
    const meta = await loadMetadata();
    expect(String(meta.metadataBase)).toBe("https://revenant.devclef.se/");
  });

  it("resolves Open Graph url and image to absolute URLs on APP_ORIGIN", async () => {
    process.env[ORIGIN_ENV] = "https://revenant.devclef.se";
    const meta = await loadMetadata();
    const og = pageMetadata({ title: "Demo", description: "d" }, "/demo")
      .openGraph;
    const base = meta.metadataBase as URL;

    const url = new URL(og?.url as string, base).href;
    const image = new URL((og?.images as string[])[0], base).href;

    expect(url).toBe("https://revenant.devclef.se/demo");
    expect(image.startsWith("https://revenant.devclef.se/")).toBe(true);
    expect(image).toBe("https://revenant.devclef.se/opengraph-image");
  });

  it("falls back to localhost when APP_ORIGIN is unset", async () => {
    delete process.env[ORIGIN_ENV];
    const meta = await loadMetadata();
    expect(String(meta.metadataBase)).toBe(FALLBACK);
  });
});
