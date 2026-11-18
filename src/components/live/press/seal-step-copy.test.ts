// Feature: 13-the-seal
//
// Copy evidence for the Seal step (spec 13, G2.7): the rendered Seal step
// holds no Retired_Phrase, no judgement word from tools/hooks/tone-check.mjs
// and no exclamation mark. The phrase list is the subset of
// src/test/retired-phrases.test.ts that can reach the Seal step, plus the
// judgement and scoring words of tone.md. Only visible text is searched: tags
// and attributes are removed first.

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PickableSeries } from "../catalogue-list";
import { WriteForm, type WriteFormProps } from "../WriteForm";
import type { SealState } from "../seal-machine";

const SERIES: PickableSeries[] = [
  {
    metricId: "us-gasoline-regular",
    displayName: "Regular gasoline",
    unit: "USD per gallon",
    region: "U.S.",
    latestPeriod: "2026-10-26",
    periodType: "weekly",
    source: "U.S. Energy Information Administration (EIA), Weekly Retail Gasoline and Diesel Prices",
    isFixture: false,
  },
];

/** Retired wording from src/test/retired-phrases.test.ts, the parts a Seal step could show. */
const RETIRED_PHRASES: readonly { name: string; pattern: RegExp }[] = [
  { name: "the retired tagline", pattern: /your past self returns with the receipts/i },
  { name: "rose-tinted", pattern: /rose[- ]tinted/i },
  { name: "pick up the letter", pattern: /pick up the letter/i },
  { name: "check your connection and reload the page", pattern: /check your connection and reload the page/i },
  { name: "the old seal instruction", pattern: /press and hold the seal to break it, or use the button below\./i },
  { name: "seal the figures", pattern: /seal the figures/i },
  { name: "fuel prices from the US or the EU", pattern: /fuel prices from the US or the EU/i },
  { name: "what's on your mind right now?", pattern: /what['\u2019]s on your mind right now\?/i },
];

/** Judgement and scoring words (tone.md, tools/hooks/tone-check.mjs). */
const JUDGEMENT_WORDS: readonly { name: string; pattern: RegExp }[] = [
  { name: "soared", pattern: /\bsoared\b/i },
  { name: "plunged", pattern: /\bplunged\b/i },
  { name: "skyrocketed", pattern: /\bskyrocketed\b/i },
  { name: "finally", pattern: /\bfinally\b/i },
  { name: "cheaper", pattern: /\bcheaper\b/i },
  { name: "dearer", pattern: /\bdearer\b/i },
  { name: "better", pattern: /\bbetter\b/i },
  { name: "worse", pattern: /\bworse\b/i },
  { name: "accuracy", pattern: /\baccuracy\b/i },
  { name: "accurate", pattern: /\baccurate\b/i },
  { name: "score", pattern: /\bscore\b/i },
  { name: "off by", pattern: /\boff by\b/i },
  { name: "caught", pattern: /\bcaught\b/i },
  { name: "you misremembered", pattern: /misremember/i },
];

function visibleText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ");
}

function props(overrides: Partial<WriteFormProps> = {}): WriteFormProps {
  return {
    series: SERIES,
    state: { tag: "write" } satisfies SealState,
    cryptoLoaded: true,
    text: "Dear me, the kitchen smelled of bread.",
    metricIds: ["us-gasoline-regular"],
    warningTicked: false,
    backupCardTicked: false,
    backupChoice: null,
    onTextChange: () => {},
    onToggleFigure: () => {},
    onWarningChange: () => {},
    onBackupCardChange: () => {},
    onCreatePress: () => {},
    onConfirmPress: () => {},
    ...overrides,
  };
}

/** Raw markup of the live Seal step (section "seal"), where the press lives. */
const renderRaw = (overrides: Partial<WriteFormProps> = {}) =>
  renderToStaticMarkup(
    createElement(WriteForm, props({ section: "seal", ...overrides })),
  );

const renderSeal = (overrides: Partial<WriteFormProps> = {}) =>
  visibleText(renderRaw(overrides));

const STATES: { name: string; html: string }[] = [
  { name: "write, no backup choice", html: renderSeal() },
  { name: "write, backup card chosen", html: renderSeal({ backupChoice: "card", warningTicked: true, backupCardTicked: true }) },
  { name: "write, skip chosen", html: renderSeal({ backupChoice: "skip", warningTicked: true }) },
  { name: "created (Setting_State)", html: renderSeal({ state: { tag: "created" }, backupChoice: "skip", warningTicked: true }) },
];

describe("Seal step copy (G2.7)", () => {
  for (const { name, html } of STATES) {
    it(`holds no Retired_Phrase in the rendered ${name}`, () => {
      for (const { name: phrase, pattern } of RETIRED_PHRASES) {
        expect(html, phrase).not.toMatch(pattern);
      }
    });

    it(`holds no judgement or scoring word in the rendered ${name}`, () => {
      for (const { name: word, pattern } of JUDGEMENT_WORDS) {
        expect(html, word).not.toMatch(pattern);
      }
    });

    it(`has no exclamation mark in the rendered ${name}`, () => {
      expect(html).not.toContain("!");
    });
  }

  it("the Seal step names the press, and the press is the only orange control on it", () => {
    const raw = renderRaw({ backupChoice: "skip", warningTicked: true });
    expect(raw).toContain('aria-label="Press the seal"');
    // The one legacy orange button (the "Press the seal with your passkey"
    // button) is gone from the live Seal step.
    expect(raw).not.toContain("Press the seal with your passkey");
  });

  it("the Setting_State shows one plain line and no Confirm your passkey (P5.5)", () => {
    const html = renderSeal({ state: { tag: "created" }, backupChoice: "skip", warningTicked: true });
    expect(html).toContain("Your device will ask once more to set the seal. Press the wax.");
    expect(html).not.toContain("Confirm your passkey");
    expect(html).not.toContain("Press the button to confirm it.");
  });
});
