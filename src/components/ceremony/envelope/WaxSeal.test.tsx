// Markup tests for WaxSeal (07-judge-journey, design.md "The wax seal";
// R10.10, R10.11, R10.12). Property 18's seal clause: the wax seal markup is
// identical for every persona key.
//
// Rendered with `renderToStaticMarkup` so the full output is a string we can
// scan and compare.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { WaxSeal } from "./WaxSeal";

const renderSeal = (size?: number): string =>
  renderToStaticMarkup(createElement(WaxSeal, { size }));

const PERSONA_KEYS = ["us-maya", "eu-lotta", "se-erik", "us-dana"] as const;

describe("WaxSeal — one seal for every persona (Property 18, R10.10)", () => {
  it("renders byte-identical markup for every persona key", () => {
    const baseline = renderSeal();
    for (const key of PERSONA_KEYS) {
      // The seal takes no key, so the same render serves every persona.
      expect(renderSeal(), `seal for ${key}`).toBe(baseline);
    }
  });

  it("property: the seal markup is identical across any persona key", () => {
    const baseline = renderSeal();
    fc.assert(
      fc.property(fc.constantFrom(...PERSONA_KEYS), (key) => {
        // The key is a persona's identity and must not reach the seal.
        const html = renderSeal();
        return html === baseline && !html.includes(key);
      }),
      { numRuns: 100 },
    );
  });
});

describe("WaxSeal — one seal, two halves together (R10.12)", () => {
  it("draws the artwork twice, once clipped to each half", () => {
    const html = renderSeal();
    const clips = html.match(/<clipPath /g) ?? [];
    expect(clips).toHaveLength(2);
    // Each half holds the full wax blob, so the two halves sit together.
    const blobs = html.match(/<path d="M50 4 C74/g) ?? [];
    expect(blobs).toHaveLength(2);
  });

  it("draws the pressed ghost in the press ink, with two eyes", () => {
    const html = renderSeal();
    expect(html).toContain("var(--wax-press, #c4560a)");
    expect((html.match(/<ellipse/g) ?? []).length).toBe(4);
  });
});

describe("WaxSeal — accessibility and neutrality (R10.11)", () => {
  it("is hidden from assistive technology", () => {
    expect(renderSeal()).toContain('aria-hidden="true"');
  });

  it("uses only the orange wax tokens, with no judgement colour", () => {
    const html = renderSeal().toLowerCase();
    expect(html).toContain("var(--wax, #ff7b1c)");
    for (const colour of ["green", "red", "#0f0", "#f00", "limegreen"]) {
      expect(html).not.toContain(colour);
    }
  });

  it("carries no religious, national or political symbol (star, cross, crescent, flag)", () => {
    // The seal has only a blob, rings, a disc, a ghost and two eyes.
    const html = renderSeal();
    expect(html).not.toMatch(/star|cross|crescent|flag/i);
  });

  it("scales the rendered size without changing the artwork", () => {
    const stripSize = (html: string): string =>
      html.replace(/\swidth="\d+"/, "").replace(/\sheight="\d+"/, "");
    expect(stripSize(renderSeal(48))).toBe(stripSize(renderSeal(128)));
  });
});
