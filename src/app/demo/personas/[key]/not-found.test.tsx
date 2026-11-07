import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CEREMONY_COPY } from "@/components/ceremony/copy";
import { DEMO_COPY } from "@/components/demo/copy";
import * as branded from "@/components/ui/BrandedPage";
import { UI_COPY } from "@/components/ui/copy";

/**
 * Tests for the persona not-found page (spec 09 task 3, A14). Next.js renders
 * this when `page.tsx` calls `notFound()` for an unknown `[key]`.
 *
 * The page renders BrandedPage with the not-found heading and body. BrandedPage
 * supplies the Top_Bar and the link to /demo. The page makes no API request.
 * The BrandedPage spy records the props the page passes, so the test checks the
 * page's own wiring rather than the markup.
 */

vi.mock("@/components/ui/BrandedPage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui/BrandedPage")>();
  return { ...actual, BrandedPage: vi.fn(actual.BrandedPage) };
});

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("the not-found page must not fetch");
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function renderPage(): Promise<string> {
  const { default: PersonaNotFound } = await import("./not-found");
  vi.mocked(branded.BrandedPage).mockClear();
  return renderToStaticMarkup(createElement(PersonaNotFound));
}

describe("persona not-found page", () => {
  it("renders the Top_Bar and no Demo chip, as every branded page does", async () => {
    const html = await renderPage();

    expect(html).toContain("data-topbar");
    expect(html).toContain(CEREMONY_COPY.calmOn);
    expect(html).not.toContain(DEMO_COPY.demoLabel);
  });
  it("renders BrandedPage with the not-found heading and body", async () => {
    await renderPage();

    const props = vi.mocked(branded.BrandedPage).mock.calls[0][0];
    expect(props.heading).toBe(DEMO_COPY.notFoundTitle);
    expect(props.body).toBe(DEMO_COPY.notFoundBody);
  });

  it("shows the heading and body in the markup", async () => {
    const html = await renderPage();

    expect(html).toContain(DEMO_COPY.notFoundTitle);
    expect(html).toContain(DEMO_COPY.notFoundBody);
  });

  it("links back to the demo letters index at /demo through BrandedPage", async () => {
    const html = await renderPage();

    expect(html).toContain('href="/demo"');
    expect(html).toContain(UI_COPY.branded.demoLink);
  });

  it("passes no action, so the page has one link only", async () => {
    await renderPage();

    const props = vi.mocked(branded.BrandedPage).mock.calls[0][0];
    expect(props.action).toBeUndefined();
  });

  it("makes no API request during render", async () => {
    await renderPage();

    expect(fetch).not.toHaveBeenCalled();
  });
});
