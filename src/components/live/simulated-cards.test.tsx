// Feature: 20-easier-sealing-and-receipts, Part B (Requirement 12.7).
//
// The backup key card and the letter card of a Simulated_Letter must not show
// any of the phrases that describe a passkey on the device. Both cards are
// rendered with renderToStaticMarkup and the visible text is checked, with the
// Demo label on and off.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BackupKeyCard } from "./BackupKeyCard";
import { LetterCard } from "./LetterCard";

const APP_ORIGIN = "https://revenant.devclef.se";
const LETTER_ID = "abc123letterid00";
const KEY = "3ABC-DEFG-HJKM-NPQR-STVW-XYZ0-12A";
const OPENS_AT = "2026-12-01T00:00:00.000Z";
const ENVELOPE_HASH = "a".repeat(64);

/** The phrases Requirement 12.7 forbids on a Simulated_Letter's cards. */
const FORBIDDEN = [
  "passkey manager",
  "saved as",
  "revenant demo",
  "on your device",
  "your device will ask",
];

/** Visible text of a markup string: tags removed, whitespace collapsed, lower-cased. */
function visibleText(markup: string): string {
  return markup
    .replace(/<[^>]*>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function expectNoForbiddenText(markup: string): void {
  const text = visibleText(markup);
  for (const phrase of FORBIDDEN) {
    expect(text, `forbidden phrase "${phrase}"`).not.toContain(phrase);
  }
}

describe("Simulated_Letter cards carry no passkey-on-device wording (Requirement 12.7)", () => {
  it("BackupKeyCard shows none of the forbidden phrases with the Demo label on", () => {
    expectNoForbiddenText(
      renderToStaticMarkup(
        createElement(BackupKeyCard, {
          letterId: LETTER_ID,
          appOrigin: APP_ORIGIN,
          keyText: KEY,
        }),
      ),
    );
  });

  it("BackupKeyCard shows none of the forbidden phrases with the Demo label off", () => {
    expectNoForbiddenText(
      renderToStaticMarkup(
        createElement(BackupKeyCard, {
          letterId: LETTER_ID,
          appOrigin: APP_ORIGIN,
          keyText: KEY,
          showDemoLabel: false,
        }),
      ),
    );
  });

  it("LetterCard shows none of the forbidden phrases with the Demo label on", () => {
    expectNoForbiddenText(
      renderToStaticMarkup(
        createElement(LetterCard, {
          letterId: LETTER_ID,
          appOrigin: APP_ORIGIN,
          opensAt: OPENS_AT,
          envelopeHash: ENVELOPE_HASH,
        }),
      ),
    );
  });

  it("LetterCard shows none of the forbidden phrases with the Demo label off", () => {
    expectNoForbiddenText(
      renderToStaticMarkup(
        createElement(LetterCard, {
          letterId: LETTER_ID,
          appOrigin: APP_ORIGIN,
          opensAt: OPENS_AT,
          envelopeHash: ENVELOPE_HASH,
          showDemoLabel: false,
        }),
      ),
    );
  });
});
