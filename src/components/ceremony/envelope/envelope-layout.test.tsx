// Feature: 07-judge-journey (spec 07 task 4)
//
// Envelope front layout: the narrow front holds only the two date lines, each
// a data-date element that never wraps; the art is aria-hidden; and the front is
// identical for every letter (Property 18, fast-check).

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { Envelope, type EnvelopePersona } from "./Envelope";

const persona = (overrides: Partial<EnvelopePersona> = {}): EnvelopePersona => ({
  key: "maya",
  written_as_of: "2024-05-12",
  opens_at: "2024-11-05T00:00:00Z",
  demo: true,
  ...overrides,
});

const render = (
  layout: "narrow" | "wide" | "responsive",
  p: EnvelopePersona,
): string =>
  renderToStaticMarkup(
    createElement(Envelope, { state: "closed", layout, persona: p }),
  );

describe("Envelope — narrow front holds only the two date lines (Property 21)", () => {
  it("renders exactly two data-date lines and no demo note", () => {
    const html = render("narrow", persona());
    expect(html.match(/data-date="true"/g)).toHaveLength(2);
    expect(html).not.toContain("data-demo-note");
    expect(html).not.toContain("Prepared later as a demo.");
  });

  it("wide and responsive fronts also hold only the two date lines (spec 09 OD5)", () => {
    for (const layout of ["wide", "responsive"] as const) {
      const html = render(layout, persona());
      expect(html.match(/data-date="true"/g)).toHaveLength(2);
      expect(html).not.toContain("Prepared later as a demo.");
    }
  });

  it("marks the layout on the root element", () => {
    expect(render("narrow", persona())).toContain('data-envelope-layout="narrow"');
  });
});

describe("Envelope — accessibility and dirt band", () => {
  it("hides the art from assistive technology", () => {
    const html = render("wide", persona());
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain('role="img"');
  });

  it("draws the dirt band and the torn edge in every state", () => {
    for (const state of ["closed", "turned", "open"] as const) {
      const html = renderToStaticMarkup(
        createElement(Envelope, { state, persona: persona() }),
      );
      expect(html).toContain("dirtBand");
      expect(html).toContain("tear");
    }
  });
});

describe("Envelope — the front is identical for every letter (Property 18)", () => {
  it("renders the same front markup for any persona with the same dates shape", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.date({ noInvalidDate: true, min: new Date("2000-01-01"), max: new Date("2030-12-31") }),
        (key, d) => {
          const iso = d.toISOString().slice(0, 10);
          const a = render("narrow", persona({ key, written_as_of: iso }));
          // The art (SVG) must not depend on the persona at all.
          const artOf = (html: string) =>
            html.slice(html.indexOf("<svg"), html.indexOf("</svg>"));
          const b = render("narrow", persona({ key: "fixed", written_as_of: "2024-05-12" }));
          expect(artOf(a)).toBe(artOf(b));
        },
      ),
      { numRuns: 50 },
    );
  });
});
