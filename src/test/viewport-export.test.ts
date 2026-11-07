import { describe, expect, it, vi } from "vitest";
import { HOME_DESCRIPTION } from "@/lib/page-metadata";

// The layout imports next/font/local and next/headers, which need the Next.js
// build pipeline. Stub them so the exports can be read in Node.
vi.mock("next/font/local", () => ({
  default: () => ({ variable: "" }),
}));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

describe("root layout viewport export", () => {
  it("exports the viewport with keyboard-resizing content", async () => {
    const mod = await import("@/app/layout");
    expect(mod.viewport).toEqual({
      width: "device-width",
      initialScale: 1,
      interactiveWidget: "resizes-content",
    });
  });

  it("sets the site description to HOME_DESCRIPTION", async () => {
    const mod = await import("@/app/layout");
    const meta = await mod.generateMetadata();
    expect(meta.description).toBe(HOME_DESCRIPTION);
  });
});
