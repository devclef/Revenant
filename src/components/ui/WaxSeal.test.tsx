// Markup tests for WaxSeal (07-judge-journey, design.md "The wax seal";
// R10.10, R10.11, R10.12). Property 18's seal clause: the wax seal markup is
// identical for every persona key.
//
// Rendered with `renderToStaticMarkup` so the full output is a string we can
// scan and compare.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";

import { Envelope } from "@/components/ceremony/envelope/Envelope";
import { PersonaCard } from "@/components/demo/PersonaCard";

import { WaxSeal, normaliseWaxSealIds } from "./WaxSeal";

// PersonaCard reads the router, which only exists inside the app. The stub is
// hoisted so the mock factory can reach it.
const routerStub = vi.hoisted(() => ({
  prefetch: () => undefined,
  push: () => undefined,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => routerStub,
}));

/** The seal's own <svg>, found by its fixed 100 x 100 viewBox. */
function sealSvg(html: string): string {
  const match = html.match(/<svg[^>]*viewBox="0 0 100 100"[\s\S]*?<\/svg>/);
  if (match === null) throw new Error("no seal svg in markup");
  return match[0];
}

/** The seal's markup with its per-place size and class stripped, for comparison. */
function sealShape(html: string): string {
  return normaliseWaxSealIds(sealSvg(html))
    .replace(/ (width|height)="\d+"/g, "")
    .replace(/ class="[^"]*"/g, "");
}

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
  it("gives two seals on one page different clip ids", () => {
    const html = renderToStaticMarkup(
      createElement(
        "div",
        null,
        createElement(WaxSeal, { size: 48 }),
        createElement(WaxSeal, { size: 48 }),
      ),
    );
    const ids = [...html.matchAll(/<clipPath id="([^"]+)"/g)].map((m) => m[1]);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
    for (const id of ids) {
      expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

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

describe("WaxSeal — one seal markup in each place it is used", () => {
  const personaProps = {
    personaKey: "us-maya",
    display_name: "Maya",
    region: "United States",
    written_as_of: "2024-05-12",
    opens_at: "2024-11-05T00:00:00.000Z",
  };

  it("draws the same seal on the bare component, the persona card and the envelope back", () => {
    const bare = sealShape(renderToStaticMarkup(createElement(WaxSeal, { size: 48 })));
    const card = sealShape(
      renderToStaticMarkup(createElement(PersonaCard, personaProps)),
    );
    const envelope = sealShape(
      renderToStaticMarkup(createElement(Envelope, { state: "turned" })),
    );
    expect(card).toBe(bare);
    expect(envelope).toBe(bare);
  });

  it("draws the seal once on the envelope back and nowhere on the front", () => {
    const html = renderToStaticMarkup(createElement(Envelope, { state: "turned" }));
    expect(html.match(/viewBox="0 0 100 100"/g) ?? []).toHaveLength(1);
  });
});

describe("WaxSeal — the seal sits on the envelope flap", () => {
  // The flap is the triangle M6 6 L294 6 L150 104 Z, so its tip is (150, 104).
  // The seal is 64 units across and placed by translate(x y), so its centre is
  // (x + 32, y + 32). The centre must land on the tip, and the seal must be drawn
  // after the flap so it sits on top of it.
  const html = renderToStaticMarkup(createElement(Envelope, { state: "turned" }));

  it("draws the flap before the seal", () => {
    const flapAt = html.indexOf('d="M6 6 L294 6 L150 104 Z"');
    const sealAt = html.search(/<g transform="translate\([\d.-]+ [\d.-]+\)"><svg/);
    expect(flapAt).toBeGreaterThan(-1);
    expect(sealAt).toBeGreaterThan(flapAt);
  });

  it("centres the seal on the flap tip", () => {
    const m = html.match(/<g transform="translate\(([\d.-]+) ([\d.-]+)\)"><svg[^>]*viewBox="0 0 100 100"/);
    expect(m, "seal placement").not.toBeNull();
    const centreX = Number(m![1]) + 32;
    const centreY = Number(m![2]) + 32;
    expect(centreX).toBeCloseTo(150, 5);
    expect(centreY).toBeCloseTo(104, 5);
  });
});

describe("Envelope front — no postmark and no seal-like circle", () => {
  const closed = renderToStaticMarkup(createElement(Envelope, { state: "closed" }));

  it("has no postmark rings or cancel bars", () => {
    expect(closed).not.toContain("cx=\"242\"");
    expect(closed).not.toMatch(/<line /);
  });
});
