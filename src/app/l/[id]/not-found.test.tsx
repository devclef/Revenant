import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LIVE_COPY } from "@/components/live/copy";
import * as branded from "@/components/ui/BrandedPage";
import { UI_COPY } from "@/components/ui/copy";

/**
 * Tests for the /l/[id] not-found page (spec 09 task 3, A14). It renders
 * BrandedPage with the letter-not-found heading and body, and makes no request.
 */

vi.mock("@/components/ui/BrandedPage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/components/ui/BrandedPage")>();
  return { ...actual, BrandedPage: vi.fn(actual.BrandedPage) };
});

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("the letter not-found page must not fetch");
    }),
  );
});

async function renderPage(): Promise<string> {
  const { default: LetterNotFound } = await import("./not-found");
  vi.mocked(branded.BrandedPage).mockClear();
  return renderToStaticMarkup(createElement(LetterNotFound));
}

describe("/l/[id] not-found page", () => {
  it("renders BrandedPage with the letter-not-found heading and body", async () => {
    await renderPage();

    const props = vi.mocked(branded.BrandedPage).mock.calls[0][0];
    expect(props.heading).toBe(LIVE_COPY.letterNotFoundTitle);
    expect(props.body).toBe(LIVE_COPY.letterNotFound);
  });

  it("shows the heading and body in the markup", async () => {
    const html = await renderPage();

    expect(html).toContain(LIVE_COPY.letterNotFoundTitle);
    expect(html).toContain(LIVE_COPY.letterNotFound.replace(/'/g, "&#x27;"));
  });

  it("links to /demo through BrandedPage", async () => {
    const html = await renderPage();

    expect(html).toContain('href="/demo"');
    expect(html).toContain(UI_COPY.branded.demoLink);
  });

  it("makes no API request during render", async () => {
    await renderPage();

    expect(fetch).not.toHaveBeenCalled();
  });
});
