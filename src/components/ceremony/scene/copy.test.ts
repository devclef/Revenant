// Feature: 07-judge-journey, Property 23 (design.md)
//
// Every string in scene/copy.ts matches its design.md text character for
// character, and no Scene_Copy_Module string holds a scoring word (R24.6, R24.7).
// Only string values are checked, never identifiers.

import { describe, expect, it } from "vitest";

import { SCENE_COPY } from "./copy";

/** Every string value in the object, keyed by a readable path. */
function flatten(obj: Record<string, unknown>, prefix = ""): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.push([path, value]);
    else if (Array.isArray(value)) value.forEach((v, i) => out.push([`${path}[${i}]`, v]));
    else if (value && typeof value === "object") {
      out.push(...flatten(value as Record<string, unknown>, path));
    }
  }
  return out;
}

const ENTRIES = flatten(SCENE_COPY as unknown as Record<string, unknown>);

/** Scoring_Words_Always (R24.6): banned in every copy module. */
const SCORING_ALWAYS = ["accuracy", "score", "off by"];
/** Scoring_Words_Scene (R24.7): banned in the Scene_Copy_Modules. */
const SCORING_SCENE = ["close", "right", "wrong"];

describe("SCENE_COPY is exact (Property 23)", () => {
  it("no longer holds the retired headline parts (F2)", () => {
    expect(SCENE_COPY).not.toHaveProperty("headlineLead");
    expect(SCENE_COPY).not.toHaveProperty("headlineAccent");
  });

  it("holds the wordmark, the demo chip and the open-letter control", () => {
    expect(SCENE_COPY.wordmark).toBe("revenant");
    expect(SCENE_COPY.demoChip).toBe("Demo");
    expect(SCENE_COPY.openLetter).toBe("Open {name}'s letter");
  });

  it("holds the persona notice", () => {
    expect(SCENE_COPY.personaNotice).toBe(
      "{name} is fictional. This letter was prepared later as a demo.",
    );
  });

  it("holds the four landing paragraphs and the link copy, verbatim from SCENE_COPY", () => {
    expect(SCENE_COPY.landing.paragraphs).toEqual([
      "Revenant seals a letter to your future self. It opens on a date you choose, and you testify before you read it.",
      "You write what is on your mind, and you choose figures to seal with it: weekly fuel prices for the United States and the European Union, each from an official source, kept with its date and where it came from.",
      "You pick a date to open it. Then you seal the letter. Once sealed, it cannot be changed, not even by you, and no one else can read it.",
      "When that date arrives, the letter opens. First it asks how you remember things. Then it shows what you wrote, and the numbers then beside the numbers now. The space between the two is yours to read.",
    ]);
    expect(SCENE_COPY.landing.demoLink).toBe("Open the demo letters");
    expect(SCENE_COPY.landing.demoLinkOne).toBe("Open the demo letter");
    expect(SCENE_COPY.landing.demoLinkMany).toBe("Open the demo letters");
    expect(SCENE_COPY.landing.liveLink).toBe("Seal your own letter");
    expect(SCENE_COPY.landing.liveNote).toBe("It opens 30 seconds after you seal it.");
    expect(SCENE_COPY.landing.realLink).toBe("Seal a letter to your future self");
    expect(SCENE_COPY.landing.howLink).toBe("How a letter is sealed");
    expect(SCENE_COPY.landing.sourceLink).toBe("Source code on GitHub");
  });

  it("names fuel prices for the two regions only, with no groceries, rent or other figures", () => {
    const landing = SCENE_COPY.landing.paragraphs.join(" ");
    expect(landing).toContain("fuel prices");
    expect(landing).toContain("United States");
    expect(landing).toContain("European Union");
    expect(landing).toContain("future self");
    expect(landing).not.toMatch(/time capsule/i);
    expect(landing).not.toMatch(/\b(groceries|rent)\b/i);
  });
});

describe("SCENE_COPY tone and scoring words (Property 23, R24.6, R24.7)", () => {
  it("has no exclamation mark", () => {
    for (const [key, value] of ENTRIES) {
      expect(value, `${key} must not contain "!"`).not.toContain("!");
    }
  });

  it("contains no scoring word of either kind as a whole word", () => {
    for (const [key, value] of ENTRIES) {
      for (const word of [...SCORING_ALWAYS, ...SCORING_SCENE]) {
        const whole = new RegExp(`\\b${word}\\b`, "i");
        expect(whole.test(value), `${key} contains scoring word "${word}"`).toBe(false);
      }
    }
  });

  it("has no sentence over 25 words, ignoring {placeholders}", () => {
    // Property 23: the 25-word limit applies to new strings. The landing
    // paragraphs are copied verbatim from page.tsx (R24.3), so they are
    // checked for exact text above and skipped here.
    const checked = ENTRIES.filter(([key]) => !key.startsWith("landing.paragraphs"));
    for (const [key, value] of checked) {
      const sentences = value
        .replace(/\{[^}]*\}/g, " ")
        .split(/[.!?]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      for (const sentence of sentences) {
        const words = sentence.split(/\s+/).length;
        expect(words, `${key}: sentence over 25 words -> "${sentence}"`).toBeLessThanOrEqual(25);
      }
    }
  });
});
