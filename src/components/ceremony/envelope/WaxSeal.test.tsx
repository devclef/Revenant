// Markup tests for WaxSeal (05-reveal-ceremony, design.md "Envelope and seal";
// R8.4, R10.1, Property 4's render clause).
//
// WaxSeal is pure presentation seeded only by `patternKey`. Rendered with
// `renderToStaticMarkup` and `createElement` — no DOM library and no JSX — so
// the disc's full output is a string we can scan and compare.
//
// What these pin:
//   - Property 4 (render clause): the same key renders byte-identical markup
//     across repeated renders, so the server and the client draw one seal.
//   - R10.1: the wax fill is the --seal-wax token, and that fill is identical
//     whatever the key, so no seal's colour carries meaning.
//   - A seal reads only its key: nothing from a letter payload appears.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { WaxSeal } from "./WaxSeal";
import { GLYPH_COUNT, SEAL_WAX_TOKEN, sealPattern } from "./seal-pattern";

const renderSeal = (patternKey: string, size?: number): string =>
  renderToStaticMarkup(createElement(WaxSeal, { patternKey, size }));

describe("WaxSeal — markup stable per key (Property 4, R8.4)", () => {
  it("renders byte-identical markup across repeated renders for the same key", () => {
    const keys = ["", "a", "us-maya", "eu-lotta", "se-erik", "ünîçødé"];
    for (const key of keys) {
      const first = renderSeal(key);
      const second = renderSeal(key);
      const third = renderSeal(key);
      expect(second).toBe(first);
      expect(third).toBe(first);
    }
  });

  it("renders different keys as (at least some) different markup", () => {
    // Not a property — just a guard that the key actually drives the pattern,
    // so the stability test above is not trivially true for all inputs.
    const a = renderSeal("us-maya");
    const b = renderSeal("eu-lotta");
    const c = renderSeal("se-erik");
    const distinct = new Set([a, b, c]);
    expect(distinct.size).toBeGreaterThan(1);
  });
});

describe("WaxSeal — one wax colour for every key (R10.1)", () => {
  it("fills the wax disc with the --seal-wax token", () => {
    const html = renderSeal("us-maya");
    // The disc fill references the single wax token, not a literal colour that
    // could be varied per key.
    expect(html).toContain(`var(${SEAL_WAX_TOKEN},`);
  });

  it("uses the same wax fill regardless of key", () => {
    // Pull the wax-token fill fragment out of each render and confirm it is the
    // same string for every key. The disc's fill never depends on the key.
    const waxFill = /fill="var\(--seal-wax,[^"]*\)"/;
    const keys = ["", "a", "us-maya", "eu-lotta", "se-erik"];
    const fills = new Set(
      keys.map((key) => {
        const match = renderSeal(key).match(waxFill);
        expect(match, `wax fill must appear for key "${key}"`).not.toBeNull();
        return match?.[0];
      }),
    );
    expect(fills.size).toBe(1);
  });

  it("renders no green/red directional colour (neutrality, R10.1)", () => {
    const html = renderSeal("us-maya").toLowerCase();
    // The seal names only the wax tokens; no judgement palette appears.
    for (const colour of ["green", "red", "#0f0", "#f00", "limegreen"]) {
      expect(html).not.toContain(colour);
    }
  });
});

describe("WaxSeal — reads only its key, never a letter payload", () => {
  it("renders nothing from a sealed letter's contents", () => {
    const html = renderSeal("us-maya").toLowerCase();
    // A seal is seeded by a key alone and takes no payload prop, so none of
    // these could appear. Guards against a future prop leak.
    const payloadStrings = [
      "letter text",
      "USD per gallon",
      "U.S. EIA",
      "3.412",
      "self-reported",
      "format_version",
      "serverSecret",
      "ciphertext",
    ];
    for (const needle of payloadStrings) {
      expect(
        html,
        `seal markup must not contain payload string "${needle}"`,
      ).not.toContain(needle.toLowerCase());
    }
  });

  it("the markup shape does not change with the rendered size", () => {
    // size scales the <svg> width/height but must not alter the inner geometry
    // (coordinates live in a fixed 100×100 user space). Strip the width/height
    // attributes and confirm the remainder is identical across sizes.
    const stripSize = (html: string): string =>
      html.replace(/\swidth="\d+"/, "").replace(/\sheight="\d+"/, "");
    const small = stripSize(renderSeal("us-maya", 48));
    const large = stripSize(renderSeal("us-maya", 128));
    expect(small).toBe(large);
  });
});

describe("WaxSeal — no six-point star in the glyph set (R10.1)", () => {
  it("draws the glyph at index 4 as three dots, not the removed six-point star", () => {
    // Glyph 4 used to be the two-triangle star path. Every seal key that lands
    // on glyph 4 must now draw dots instead, so the old path is gone everywhere.
    let key: string | undefined;
    for (let i = 0; key === undefined && i < 1000; i += 1) {
      if (sealPattern(`probe-${i}`).glyph === 4) key = `probe-${i}`;
    }
    expect(key).toBeDefined();
    const markup = renderSeal(key ?? "");
    expect(markup).toContain("<circle");
    expect(markup).not.toContain("M50 37 L61 56 L39 56 Z");
    expect(markup).not.toContain("M50 63 L39 44 L61 44 Z");
  });

  it("keeps the glyph count at 12, so the pattern ranges do not change", () => {
    expect(GLYPH_COUNT).toBe(12);
  });
});
