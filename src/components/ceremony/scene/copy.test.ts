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

  it("holds the wordmark and the demo chip", () => {
    expect(SCENE_COPY.wordmark).toBe("revenant");
    expect(SCENE_COPY.demoChip).toBe("Demo");
  });

  it("holds the persona notice", () => {
    expect(SCENE_COPY.personaNotice).toBe(
      "{name} is fictional. This letter was prepared later as a demo.",
    );
  });

  it("holds the demo link copy", () => {
    expect(SCENE_COPY.landing.demoLink).toBe("Open the demo letters");
  });

  it("no longer holds the retired landing keys or the persona open-letter control", () => {
    expect(SCENE_COPY).not.toHaveProperty("openLetter");
    for (const key of [
      "paragraphs",
      "demoLinkOne",
      "demoLinkMany",
      "realLink",
      "liveLink",
      "liveNote",
      "howLink",
      "sourceLink",
    ]) {
      expect(SCENE_COPY.landing).not.toHaveProperty(key);
    }
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
    for (const [key, value] of ENTRIES) {
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
