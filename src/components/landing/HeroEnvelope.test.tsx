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

  it("sets the seal to 120 user units, centred on the flap", () => {
    expect(css).toMatch(
      /\.sealFrame :global\(\[data-seal-hash\]\) \{\s*width: 120px;\s*height: 120px;\s*transform: translate\(-28px, -28px\);\s*\}/,
    );
  });
});
