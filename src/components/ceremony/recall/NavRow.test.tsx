// Feature: 14-write-desk, T1.5 (Nav_Row order and the main button on every
// question). The row renders to static markup, like the other recall tests.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { NavRow, type NavRowProps } from "./NavRow";
import { REVEAL_COPY } from "@/components/reveal/copy";

const MAIN = "Record my answers";

function render(overrides: Partial<NavRowProps> = {}): string {
  const props: NavRowProps = {
    showPrevious: false,
    onPrevious: () => undefined,
    mainLabel: MAIN,
    mainDisabled: false,
    onMain: () => undefined,
    ...overrides,
  };
  return renderToStaticMarkup(createElement(NavRow, props));
}

function buttonCount(markup: string): number {
  return markup.split("<button").length - 1;
}

describe("NavRow on question 1", () => {
  it("shows the main button only, with no Previous control", () => {
    const markup = render({ showPrevious: false });
    expect(buttonCount(markup)).toBe(1);
    expect(markup).toContain(MAIN);
    expect(markup).not.toContain(REVEAL_COPY.previousQuestion);
  });

  it("keeps an empty placeholder so the main button stays on the right", () => {
    const markup = render({ showPrevious: false });
    expect(markup).toContain("data-nav-row");
    expect(markup).toMatch(/<span class="[^"]*" aria-hidden="true"><\/span>/);
  });

  it("disables the main button while its action cannot run", () => {
    const markup = render({ showPrevious: false, mainDisabled: true });
    expect(markup).toMatch(/<button[^>]*disabled=""[^>]*>/);
  });
});

describe("NavRow on question 2 onward", () => {
  it("shows Previous on the left and the main button on the right", () => {
    const markup = render({ showPrevious: true });
    expect(buttonCount(markup)).toBe(2);
    const previousAt = markup.indexOf(REVEAL_COPY.previousQuestion);
    const mainAt = markup.indexOf(MAIN);
    expect(previousAt).toBeGreaterThan(-1);
    expect(mainAt).toBeGreaterThan(previousAt);
  });

  it("does not render the placeholder when Previous is shown", () => {
    const markup = render({ showPrevious: true });
    expect(markup).not.toContain('aria-hidden="true"');
  });

  it("uses type=button on both controls, so the pager's form decides submit", () => {
    const markup = render({ showPrevious: true });
    expect(markup.match(/type="button"/g)?.length).toBe(2);
    expect(markup).not.toContain('type="submit"');
  });
});
