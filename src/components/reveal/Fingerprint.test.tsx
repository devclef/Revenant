// Feature: 08-judge-polish (spec task 3, R14.3, R14.4, R14.8; Property 16/17)
//
// Markup tests for the opening Fingerprint block. Rendered with
// `renderToStaticMarkup` and `createElement` — no DOM library and no JSX,
// matching the existing reveal test style (SealedLetter, RememberedAnswers).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { Fingerprint } from "./Fingerprint";
import type { LetterKind } from "./FigureLine";
import { REVEAL_COPY } from "./copy";
import { formatFingerprint } from "@/lib/seal-format";

/** A fixed 64-char lowercase hex hash with 16 distinct groups. */
const HASH =
  "0123456789abcdef1122334455667788" + "99aabbccddeeff00a1b2c3d4e5f60718";

function render(envelopeHash: string, letterKind: LetterKind): string {
  return renderToStaticMarkup(
    createElement(Fingerprint, { envelopeHash, letterKind }),
  );
}

/** A generator of valid 64-char lowercase hex hashes. */
const hexHash = fc
  .array(fc.integer({ min: 0, max: 15 }), { minLength: 64, maxLength: 64 })
  .map((digits) => digits.map((d) => d.toString(16)).join(""));

describe("Fingerprint markup", () => {
  it('shows the "Fingerprint at sealing" heading as an h3 (R14.3)', () => {
    const html = render(HASH, "persona");
    expect(html).toContain("<h3");
    expect(html).toContain(REVEAL_COPY.fingerprintTitle);
    // The focus rule's newest h1/h2 is unchanged: this block adds no h1/h2.
    expect(html).not.toContain("<h1");
    expect(html).not.toContain("<h2");
  });

  it("shows all 16 groups of the envelope hash (R14.4)", () => {
    const html = render(HASH, "persona");
    const groups = (formatFingerprint(HASH) ?? "").split(" ");
    expect(groups).toHaveLength(16);
    for (const group of groups) {
      expect(html).toContain(group);
    }
  });

  it("shows the 16 groups as two lines of 8 (R14.3, design.md)", () => {
    const html = render(HASH, "persona");
    const groups = (formatFingerprint(HASH) ?? "").split(" ");
    const lineOne = groups.slice(0, 8).join(" ");
    const lineTwo = groups.slice(8).join(" ");
    expect(html).toContain(`>${lineOne}</span>`);
    expect(html).toContain(`>${lineTwo}</span>`);
  });

  it('marks the groups translate="no" so no browser rewrites the hex', () => {
    const html = render(HASH, "persona");
    expect(html).toContain('translate="no"');
  });

  it('always states the seal check passed (R14.3)', () => {
    for (const kind of ["persona", "live", "real"] as const) {
      const html = render(HASH, kind);
      expect(html).toContain(REVEAL_COPY.fingerprintPassed);
    }
  });

  it('a persona letter shows "demo letter" and no card wording (R14.8)', () => {
    const html = render(HASH, "persona");
    expect(html).toContain(REVEAL_COPY.fingerprintDemo);
    expect(html).not.toContain(REVEAL_COPY.fingerprintPassedCard);
  });

  it("a live letter shows the card sentence and no demo label (R14.3)", () => {
    const html = render(HASH, "live");
    expect(html).toContain(REVEAL_COPY.fingerprintPassedCard);
    expect(html).not.toContain(REVEAL_COPY.fingerprintDemo);
  });

  it("a real letter shows the card sentence and no demo label (R14.3)", () => {
    const html = render(HASH, "real");
    expect(html).toContain(REVEAL_COPY.fingerprintPassedCard);
    expect(html).not.toContain(REVEAL_COPY.fingerprintDemo);
  });

  it("renders nothing for a malformed hash (defensive, R14.6)", () => {
    expect(render("not-a-hash", "persona")).toBe("");
    // A letter that opened always carries a verified lowercase-hex hash, so an
    // uppercase or short hash is not expected; it must not render a fingerprint.
    expect(render(HASH.toUpperCase(), "live")).toBe("");
  });
});

describe("Property 16/17: the Reveal Fingerprint equals the sealed hash", () => {
  it("shows exactly formatFingerprint(hash), all 16 groups, for any valid hash", () => {
    fc.assert(
      fc.property(
        hexHash,
        fc.constantFrom<LetterKind>("persona", "live", "real"),
        (hash, kind) => {
          const fingerprint = formatFingerprint(hash);
          // A valid hash always formats.
          expect(fingerprint).not.toBeNull();
          const groups = (fingerprint ?? "").split(" ");
          expect(groups).toHaveLength(16);
          const html = render(hash, kind);
          // The exact formatted string, in two lines of 8, appears in the markup.
          const lineOne = groups.slice(0, 8).join(" ");
          const lineTwo = groups.slice(8).join(" ");
          expect(html).toContain(`>${lineOne}</span>`);
          expect(html).toContain(`>${lineTwo}</span>`);
          // Every group is present, so the Reveal shows the whole fingerprint.
          for (const group of groups) {
            expect(html).toContain(group);
          }
        },
      ),
    );
  });

  it("renders no Fingerprint for any invalid hash (Property 16)", () => {
    const invalid = fc.oneof(
      // Wrong length (0 to 63 lowercase hex characters).
      fc
        .array(fc.integer({ min: 0, max: 15 }), { minLength: 0, maxLength: 63 })
        .map((digits) => digits.map((d) => d.toString(16)).join("")),
      // Uppercase hex of the right length.
      hexHash.map((h) => h.toUpperCase()),
      // Right length but with a non-hex character.
      hexHash.map((h) => `${h.slice(0, 63)}g`),
    );
    fc.assert(
      fc.property(invalid, (hash) => {
        // Skip the rare valid 64-char lowercase hash the generators could emit.
        fc.pre(formatFingerprint(hash) === null);
        expect(render(hash, "persona")).toBe("");
      }),
    );
  });
});

/**
 * The Fingerprint renders on the dark desk surface (--bg), not inside a paper
 * panel. The shared `.fixtureLabel` base rule colours its text and border with
 * the paper ink (--ink, near-black), which is invisible on the desk. So the
 * demo label needs a desk-token override exactly like `.figuresThenNow
 * .fixtureLabel` has. The markup tests check the string is shown but not its
 * colour, so this reads the stylesheet to guard the desk override against
 * regression (a dropped override would make the demo label fail AA on --bg).
 */
describe("the demo label has a desk-surface colour override (contrast on --bg)", () => {
  const css = readFileSync(
    join(__dirname, "reveal.module.css"),
    "utf8",
  );

  it("overrides .fixtureLabel inside .fingerprint with desk tokens, not paper ink", () => {
    // The scoped rule must exist.
    const rule = css.match(/\.fingerprint\s+\.fixtureLabel\s*\{([^}]*)\}/);
    expect(rule, ".fingerprint .fixtureLabel rule must exist").not.toBeNull();
    const body = rule?.[1] ?? "";
    // Its text and border take the desk text token, so the near-black paper ink
    // never reaches the label on the dark desk.
    expect(body).toMatch(/color:\s*var\(--text\)/);
    expect(body).toMatch(/border-color:\s*var\(--text\)/);
    expect(body).not.toContain("--ink");
  });
});
