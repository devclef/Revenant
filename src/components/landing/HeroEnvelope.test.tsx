// Feature: 09-demo-polish (landing hero seal, issue #429, L1 and L3)
//
// Render tests for HeroEnvelope. The seal is drawn from LANDING_SEAL_HASH, so
// its relief paths must be in the server HTML. The box names no letter, shows
// no Fingerprint text and carries no script, canvas or image.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { HeroEnvelope } from "./HeroEnvelope";
import { LANDING_SEAL_HASH } from "./constants";

const here = fileURLToPath(new URL(".", import.meta.url));

const html = renderToStaticMarkup(<HeroEnvelope />);

describe("HeroEnvelope markup", () => {
  it("marks the seal box with data-landing-seal", () => {
    expect(html).toContain("data-landing-seal");
  });

  it("draws the turned envelope with the landing seal hash", () => {
    expect(html).toContain('data-envelope-state="turned"');
    expect(html).toContain(`data-seal-hash="${LANDING_SEAL_HASH}"`);
  });

  it("includes the relief paths for LANDING_SEAL_HASH", () => {
    const paths = html.match(/<path[\s>]/g) ?? [];
    expect(paths.length).toBeGreaterThan(0);
  });

  it("has no script, canvas or img element", () => {
    expect(html).not.toMatch(/<script[\s>]/i);
    expect(html).not.toMatch(/<canvas[\s>]/i);
    expect(html).not.toMatch(/<img[\s>]/i);
  });

  it("shows no Fingerprint text and no letter claim", () => {
    expect(html.toLowerCase()).not.toContain("fingerprint");
    expect(html).not.toMatch(/written as of|opens |sealed on/i);
  });

  it("renders the same markup on every call", () => {
    expect(renderToStaticMarkup(<HeroEnvelope />)).toBe(html);
  });
});

describe("HeroEnvelope seal size (landing.module.css)", () => {
  const css = readFileSync(join(here, "landing.module.css"), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );

  it("sets the envelope frame to at most 420px wide", () => {
    expect(css).toMatch(/\.sealFrame \{\s*width: min\(100%, 420px\);\s*\}/);
  });

  it("scales the seal by 2 about its origin, centred on the flap tip", () => {
    expect(css).toMatch(
      /\.sealFrame :global\(\[data-seal-hash\]\) \{\s*transform: translate\(-32px, -32px\) scale\(2\);\s*\}/,
    );
  });
});

describe("HeroEnvelope draws no ghost", () => {
  // The page's one ghost is the backdrop Landing_Ghost (src/app/page.tsx).
  it("renders no Ghost pit, hero ghost box or ghost gradient", () => {
    expect(html).not.toContain("data-ghost-pit");
    expect(html).not.toContain("data-hero-pit");
    expect(html).not.toContain("data-hero-ghost");
    expect(html).not.toContain("ghost-body-");
  });

  it("still renders the envelope", () => {
    expect(html).toContain("data-envelope-state");
  });
});
