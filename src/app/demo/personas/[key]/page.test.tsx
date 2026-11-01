import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for the persona letter route at `/demo/personas/[key]` (spec
 * 03-persona-demo Task 7, design.md "Persona route"). The page is an async
 * server component: it awaits `params`, looks the `[key]` up in the frozen
 * `PERSONAS` list, calls `notFound()` for an unknown key, and otherwise renders
 * `DemoLabel` and `<OpeningFlow letterId=... personaName=... />`.
 *
 * To drive both the found and not-found paths without the real committed list,
 * `@/lib/personas` is mocked with a chosen list. `OpeningFlow` is a client
 * component whose real hook fetches, so it is replaced by a server-renderable
 * probe that echoes its props: this lets a static render prove the route passes
 * the list's `letter_id` and `display_name` straight through (R16.5), without
 * any I/O. `next/navigation`'s `notFound()` is mocked to a throwing stub (as
 * the real one throws to abort rendering), so the unknown-key path is
 * observable and never renders `OpeningFlow`.
 *
 * A fetch guard (beforeEach) fails any call to `global.fetch`: neither path may
 * reach the network during render.
 */

/** One example persona, enough to prove the known-key render passes props. */
const PERSONA = {
  key: "us-maya",
  display_name: "Maya",
  region: "United States",
  letter_id: "wom_GdH6gqP6AGgnyhIMgA",
  written_as_of: "2024-05-12",
  opens_at: "2024-11-05T00:00:00.000Z",
} as const;

/** A unique sentinel `notFound()` throws, so we can assert it was called. */
const NOT_FOUND = Symbol("not-found");

const notFound = vi.fn(() => {
  throw NOT_FOUND;
});

/**
 * Mock the page's collaborators, then import it fresh so it binds to this run's
 * mocks. `OpeningFlow` is a probe that renders its props into the markup.
 */
async function loadPage(personas: ReadonlyArray<typeof PERSONA>) {
  vi.resetModules();
  vi.doMock("@/lib/personas", () => ({ PERSONAS: personas }));
  vi.doMock("next/navigation", () => ({ notFound }));
  vi.doMock("@/components/reveal/OpeningFlow", () => ({
    OpeningFlow: ({
      letterId,
      personaName,
    }: {
      letterId: string;
      personaName: string;
    }) =>
      createElement(
        "div",
        { "data-opening-flow": true },
        createElement("span", { "data-letter-id": true }, letterId),
        createElement("span", { "data-persona-name": true }, personaName),
      ),
  }));
  const mod = await import("./page");
  return mod.default;
}

beforeEach(() => {
  vi.resetModules();
  notFound.mockClear();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => {
      throw new Error("the persona route must not fetch during render");
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock("@/lib/personas");
  vi.doUnmock("next/navigation");
  vi.doUnmock("@/components/reveal/OpeningFlow");
});

describe("persona letter route", () => {
  it("renders DemoLabel and OpeningFlow for a known key", async () => {
    const Page = await loadPage([PERSONA]);
    const element = await Page({ params: Promise.resolve({ key: PERSONA.key }) });
    const html = renderToStaticMarkup(element);

    // The "Demo" label is present (DemoLabel renders the demo badge text).
    const { DEMO_COPY } = await import("@/components/demo/copy");
    expect(html).toContain(DEMO_COPY.demoLabel);

    // OpeningFlow was rendered.
    expect(html).toContain("data-opening-flow");

    // notFound() was NOT called for a known key.
    expect(notFound).not.toHaveBeenCalled();
  });

  it("passes the list's letter_id and personaName to OpeningFlow (R16.5)", async () => {
    const Page = await loadPage([PERSONA]);
    const element = await Page({ params: Promise.resolve({ key: PERSONA.key }) });
    const html = renderToStaticMarkup(element);

    // The letter ID and persona name come from the list entry only, not the URL.
    expect(html).toContain(PERSONA.letter_id);
    expect(html).toContain(PERSONA.display_name);
  });

  it("calls notFound() for an unknown key and never renders OpeningFlow", async () => {
    const Page = await loadPage([PERSONA]);

    await expect(
      Page({ params: Promise.resolve({ key: "no-such-persona" }) }),
    ).rejects.toBe(NOT_FOUND);

    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("awaits params and matches the key exactly", async () => {
    const Page = await loadPage([PERSONA]);

    // A near-miss key (extra segment) is not the persona, so notFound() fires.
    await expect(
      Page({ params: Promise.resolve({ key: `${PERSONA.key}-x` }) }),
    ).rejects.toBe(NOT_FOUND);
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("does not fetch during render on either path", async () => {
    const Page = await loadPage([PERSONA]);

    await Page({ params: Promise.resolve({ key: PERSONA.key }) });
    await Page({ params: Promise.resolve({ key: "missing" }) }).catch(() => {});

    expect(fetch).not.toHaveBeenCalled();
  });
});
