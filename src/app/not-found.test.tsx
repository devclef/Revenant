// Feature: 09-demo-polish, A14 (branded not-found and error pages)
//
// Render tests for the app-level not-found page. It must show the 404 copy and
// the branded body, link to /demo, and render no Soil_Canvas or crypto markup.

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { CEREMONY_COPY } from "@/components/ceremony/copy";
import { UI_COPY } from "@/components/ui/copy";

vi.mock("@/components/ceremony/motion", () => ({
  useMotion: () => ({ mode: "full", setCalm: () => {} }),
  MotionProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@/components/ceremony/skip", () => ({
  useSequence: () => ({ hasActive: false, register: () => () => {}, skipAll: () => {} }),
  SkipProvider: ({ children }: { children: ReactNode }) => children,
}));

// Imported after the mocks (vi.mock is hoisted).
import NotFound, { metadata } from "./not-found";

const html = renderToStaticMarkup(createElement(NotFound));

describe("app not-found page", () => {
  it("shows the 404 heading and body", () => {
    expect(html).toContain(UI_COPY.notFound.heading);
    expect(html).toContain(UI_COPY.notFound.body);
  });

  it("renders exactly one h1", () => {
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
  });

  it("links to /demo", () => {
    expect(html).toContain('href="/demo"');
    expect(html).toContain(UI_COPY.branded.demoLink);
  });

  it("renders the Top_Bar and not the Demo chip", () => {
    expect(html).toContain("data-topbar");
    expect(html).toContain(CEREMONY_COPY.calmOn);
  });

  it("renders no Soil_Canvas or ceremony markup", () => {
    expect(html).not.toContain("data-soil-canvas");
    expect(html).not.toContain("data-ceremony=");
  });

  it("exports the shared Not found title", () => {
    expect(metadata.title).toBe(UI_COPY.pageMeta.notFound.title);
  });
});
