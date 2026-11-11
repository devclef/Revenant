// Feature: 09-demo-polish (landing hero, B1.2 to B1.4, B2.1, B2.3)
//
// Render tests for LandingHero with zero, one and two personas and Demo_2_On
// off. Checks the one Accent button, its href, the singular or plural label
// and that no persona name reaches the markup.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { LandingHero } from "./LandingHero";
import { LANDING_COPY } from "./copy";

function markup(personaCount: number, demo2On = false): string {
  return renderToStaticMarkup(
    <LandingHero personaCount={personaCount} demo2On={demo2On} />,
  );
}

/** The class attribute values of every element that carries the Accent class. */
function accentCount(html: string): number {
  return (html.match(/class="[^"]*accent[^"]*"/g) ?? []).length;
}

describe("LandingHero with zero personas", () => {
  it("renders no primary call to action", () => {
    const html = markup(0);
    expect(html).not.toContain('data-cta="primary"');
    expect(accentCount(html)).toBe(0);
    expect(html).not.toContain(LANDING_COPY.primaryCtaOne);
    expect(html).not.toContain(LANDING_COPY.primaryCtaMany);
  });

  it("still renders the eyebrow, the tagline as h1 and the sentence", () => {
    const html = markup(0);
    expect(html).toContain("The wax seal, resurrected.");
    expect(html).toMatch(/<h1[^>]*>Memory rewrites itself\. <span[^>]*>Revenant\u00a0doesn&#x27;t\.<\/span><\/h1>/);
    expect(html).toContain("Seal what you believe now");
  });
});

describe("LandingHero with one persona", () => {
  it("renders exactly one Accent button to /demo with the singular label", () => {
    const html = markup(1);
    expect(accentCount(html)).toBe(1);
    expect(html).toContain('data-cta="primary"');
    expect(html).toContain('href="/demo"');
    expect(html).toContain(">Open the demo letter<");
    expect(html).not.toContain(">Open the demo letters<");
  });

  it("renders no secondary call to action while Demo_2_On is off", () => {
    const html = markup(1);
    expect(html).not.toContain('data-cta="secondary"');
    expect(html).not.toContain("/demo/live");
  });
});

describe("LandingHero with two personas", () => {
  it("renders exactly one Accent button to /demo with the plural label", () => {
    const html = markup(2);
    expect(accentCount(html)).toBe(1);
    expect(html).toContain('data-cta="primary"');
    expect(html).toContain('href="/demo"');
    expect(html).toContain(">Open the demo letters<");
  });

  it("names no persona in the markup", () => {
    const html = markup(2);
    for (const name of ["Maya", "Tomas", "Emma"]) {
      expect(html).not.toContain(name);
    }
    expect(html).not.toMatch(/href="\/demo\/personas\//);
  });
});

describe("LandingHero blocks and reserved ghost box", () => {
  it("carries data-block on every content block", () => {
    const html = markup(2);
    for (const block of ["eyebrow", "headline", "sentence", "actions", "ghost"]) {
      expect(html).toContain(`data-block="${block}"`);
    }
  });

  it("reserves the Landing_Ghost box after the calls to action", () => {
    const html = markup(2);
    expect(html.indexOf('data-block="actions"')).toBeLessThan(
      html.indexOf('data-block="ghost"'),
    );
  });
});
