import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DEMO_COPY } from "@/components/demo/copy";

/**
 * Markup tests for the Demo_Index page at `/demo` (R6.4, R6.5, R6.8). Rendered
 * with `renderToStaticMarkup` and `createElement` — no DOM library and no JSX,
 * so the page's full output is a string we can scan.
 *
 * The page reads the frozen `PERSONAS` list from `@/lib/personas`. To drive
 * the list-length acceptance criteria (one card per entry in list order; an
 * empty list shows `indexEmpty` and no cards) without touching the real
 * committed list, `@/lib/personas` is mocked here. The page is re-imported
 * after each mock so it binds to that run's `PERSONAS` value.
 */

/** Two example personas, enough to prove "one card per entry, in order". */
const TWO_PERSONAS = [
  {
    key: "us-maya",
    display_name: "Maya",
    region: "United States",
    written_as_of: "2024-05-12",
    opens_at: "2024-11-05T00:00:00.000Z",
  },
  {
    key: "se-erik",
    display_name: "Erik",
    region: "Sweden",
    written_as_of: "2022-08-20",
    opens_at: "2022-09-11T00:00:00.000Z",
  },
] as const;

/** Mock `@/lib/personas` with a chosen list, then import the page fresh. */
async function renderWithPersonas(
  personas: ReadonlyArray<(typeof TWO_PERSONAS)[number]>,
): Promise<string> {
  vi.resetModules();
  vi.doMock("@/lib/personas", () => ({ PERSONAS: personas }));
  const { default: DemoIndexPage } = await import("./page");
  return renderToStaticMarkup(createElement(DemoIndexPage));
}

beforeEach(() => {
  vi.resetModules();
  vi.doUnmock("@/lib/personas");
});

describe("Demo_Index page markup", () => {
  it("shows the Demo label, heading and intro note", async () => {
    const html = await renderWithPersonas(TWO_PERSONAS);
    expect(html).toContain(DEMO_COPY.demoLabel);
    expect(html).toContain(DEMO_COPY.heading);
    expect(html).toContain(DEMO_COPY.introNote);
  });

  it("puts the label and intro note before the first card (R6.4, R6.5)", async () => {
    const html = await renderWithPersonas(TWO_PERSONAS);
    const labelAt = html.indexOf(DEMO_COPY.demoLabel);
    const introAt = html.indexOf(DEMO_COPY.introNote);
    const firstCardAt = html.indexOf(TWO_PERSONAS[0].display_name);
    expect(labelAt).toBeGreaterThanOrEqual(0);
    expect(introAt).toBeGreaterThanOrEqual(0);
    expect(firstCardAt).toBeGreaterThanOrEqual(0);
    expect(labelAt).toBeLessThan(firstCardAt);
    expect(introAt).toBeLessThan(firstCardAt);
  });

  it("renders one card per persona, in list order", async () => {
    const html = await renderWithPersonas(TWO_PERSONAS);
    // One "Break the seal" link per persona.
    const sealLinks = html.match(
      new RegExp(DEMO_COPY.breakSeal, "g"),
    );
    expect(sealLinks).not.toBeNull();
    expect(sealLinks).toHaveLength(TWO_PERSONAS.length);

    // Each persona's link points at its own sealed letter.
    for (const persona of TWO_PERSONAS) {
      expect(html).toContain(`href="/demo/personas/${persona.key}"`);
      expect(html).toContain(persona.display_name);
      expect(html).toContain(persona.region);
    }

    // List order: the first persona appears before the second.
    expect(html.indexOf(TWO_PERSONAS[0].display_name)).toBeLessThan(
      html.indexOf(TWO_PERSONAS[1].display_name),
    );
  });

  it("does not render the empty-state text when the list is non-empty", async () => {
    const html = await renderWithPersonas(TWO_PERSONAS);
    expect(html).not.toContain(DEMO_COPY.indexEmpty);
  });

  it("renders indexEmpty and no cards for an empty list (R6.8)", async () => {
    const html = await renderWithPersonas([]);
    expect(html).toContain(DEMO_COPY.indexEmpty);
    // No persona cards: no "Break the seal" link appears.
    expect(html).not.toContain(DEMO_COPY.breakSeal);
    expect(html).not.toContain('href="/demo/personas/');
  });
});
