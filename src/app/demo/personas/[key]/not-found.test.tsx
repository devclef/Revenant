import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEMO_COPY } from "@/components/demo/copy";

/**
 * Tests for the persona not-found page (spec 03-persona-demo Task 7, design.md
 * "Persona route"). Next.js renders this when `page.tsx` calls `notFound()`
 * for an unknown `[key]`.
 *
 * It is a pure server component: it shows `notFoundTitle`, `notFoundBody` and a
 * link back to the demo letters index at `/demo`, and makes no API request
 * (tech.md: a server route never fetches letter data, and `lib/crypto` is
 * browser-only). Rendered with `renderToStaticMarkup` + `createElement` — no
 * DOM library, no JSX — so its full output is a scannable string.
 *
 * A fetch guard fails any call to `global.fetch`: rendering the empty state
 * must not touch the network.
 */

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

describe("persona not-found page", () => {
  it("shows the not-found title and body", async () => {
    const { default: PersonaNotFound } = await import("./not-found");
    const html = renderToStaticMarkup(createElement(PersonaNotFound));

    expect(html).toContain(DEMO_COPY.notFoundTitle);
    expect(html).toContain(DEMO_COPY.notFoundBody);
  });

  it("shows the Demo label", async () => {
    const { default: PersonaNotFound } = await import("./not-found");
    const html = renderToStaticMarkup(createElement(PersonaNotFound));

    expect(html).toContain(DEMO_COPY.demoLabel);
  });

  it("links back to the demo letters index at /demo", async () => {
    const { default: PersonaNotFound } = await import("./not-found");
    const html = renderToStaticMarkup(createElement(PersonaNotFound));

    expect(html).toContain('href="/demo"');
    expect(html).toContain(DEMO_COPY.backToDemo);
  });

  it("makes no API request during render", async () => {
    const { default: PersonaNotFound } = await import("./not-found");
    renderToStaticMarkup(createElement(PersonaNotFound));

    expect(fetch).not.toHaveBeenCalled();
  });
});
