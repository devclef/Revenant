// Feature: 07-judge-journey (R10.10, R10.11, R10.12) and 13-the-seal (U1.3, U2)
//
// Markup tests for WaxSeal. Rendered with `renderToStaticMarkup` so the full
// output is a string we can scan and compare. Without a hash the seal is the
// Blank_Signet, the same for every persona (R10.10). With a valid hash the seal
// draws that hash's relief (spec 13 U1 to U2).

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

describe("WaxSeal — the Blank_Signet is one markup for every persona key (Property 18, R10.10)", () => {
  // Without a hash the seal takes no letter-specific input, so the Blank_Signet
  // is the same markup for every persona key. Spec 13 U1.3 keeps this.
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

// --- The hash prop (spec 13 U1.3, U2) ----------------------------------------

const HASH_A = "5925def5dd62f6719db9f9bbc05fbbf210eac1fdd3d4c3018b3b97cb84a4728f";
const HASH_B = "a0d025aef084492157f823e72b809b7c802a690bb2fbd75a07b467c0f02a54c6";

const renderHashed = (hash: unknown): string =>
  renderToStaticMarkup(createElement(WaxSeal, { hash: hash as string }));

describe("WaxSeal — a missing or bad hash draws the Blank_Signet (U1.3, U5.1)", () => {
  it.each([
    ["no hash", undefined],
    ["an empty string", ""],
    ["an uppercase hash", HASH_A.toUpperCase()],
    ["a 63-character hash", HASH_A.slice(0, 63)],
    ["a non-hex character", `${HASH_A.slice(0, 63)}g`],
    ["a number", 12345],
  ])("%s gives the same markup as the bare seal", (_label, hash) => {
    const html = renderHashed(hash);
    expect(html).toBe(renderSeal());
    expect(html).not.toContain("data-seal-hash");
    expect(html).not.toContain("data-coarse");
  });
});

describe("WaxSeal — a valid hash draws its relief (U1.3, U2)", () => {
  it("sets data-seal-hash to the hash and data-coarse to a signature", () => {
    const html = renderHashed(HASH_A);
    expect(html).toContain(`data-seal-hash="${HASH_A}"`);
    expect(html).toMatch(/data-coarse="[^"]+"/);
  });

  it("is deterministic: the same hash gives the same markup", () => {
    expect(renderHashed(HASH_A)).toBe(renderHashed(HASH_A));
  });

  it("draws a different seal for a different hash", () => {
    expect(renderHashed(HASH_A)).not.toBe(renderHashed(HASH_B));
  });

  it("adds relief elements on top of the Blank_Signet, and no text", () => {
    const blank = renderSeal();
    const hashed = renderHashed(HASH_A);
    const count = (html: string, tag: string) =>
      (html.match(new RegExp(`<${tag}[ />]`, "g")) ?? []).length;
    expect(count(hashed, "path")).toBeGreaterThan(count(blank, "path"));
    expect(hashed).not.toContain("<text");
  });

  it("keeps the two clipped halves and the aria-hidden root", () => {
    const html = renderHashed(HASH_A);
    expect(html.match(/<clipPath /g) ?? []).toHaveLength(2);
    expect(html).toContain('aria-hidden="true"');
  });
});

describe("Envelope — the flap seal takes the hash and can be turned off", () => {
  it("passes sealHash to the flap seal", () => {
    const html = renderToStaticMarkup(
      createElement(Envelope, { state: "turned", sealHash: HASH_A }),
    );
    expect(html).toContain(`data-seal-hash="${HASH_A}"`);
  });

  it("draws the Blank_Signet on the flap when no sealHash is given", () => {
    const html = renderToStaticMarkup(createElement(Envelope, { state: "turned" }));
    expect(html).not.toContain("data-seal-hash");
  });

  it('draws no seal on the back with seal="none"', () => {
    const html = renderToStaticMarkup(
      createElement(Envelope, { state: "turned", seal: "none" }),
    );
    expect(html.match(/viewBox="0 0 100 100"/g) ?? []).toHaveLength(0);
  });
});
