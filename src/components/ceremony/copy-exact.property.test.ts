// Feature: 07-judge-journey, Property 23: Copy is exact and scoring words stay
// out of copy strings (design.md "Correctness Properties", R24.3 to R24.8).
//
// Three layers:
//   1. Example checks: every string of the R24.3 table matches character for
//      character, and every R24.5 string is unchanged.
//   2. Scoring words (R24.6, R24.7): Scoring_Words_Always in every copy module,
//      Scoring_Words_Scene only in the Scene_Copy_Modules. live/copy.ts is not
//      checked for Scoring_Words_Scene and is not reworded (R24.7, R17.3).
//   3. A fast-check property (numRuns 100) that draws any string value from the
//      copy modules and checks the tone rules on it. Only string values are
//      checked, never identifiers, keys or code.

import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { DEMO_COPY } from "@/components/demo/copy";
import { LIVE_COPY as REVEAL_LIVE_COPY, REVEAL_COPY } from "@/components/reveal/copy";
import { LIVE_COPY as LIVE_PAGE_COPY } from "@/components/live/copy";
import { SCENE_COPY } from "./scene/copy";
import { CEREMONY_COPY } from "./copy";

/** Scoring_Words_Always (R24.6): banned in every copy module. */
const SCORING_ALWAYS = ["accuracy", "score", "off by"] as const;
/** Scoring_Words_Scene (R24.7): banned only in the Scene_Copy_Modules. */
const SCORING_SCENE = ["close", "right", "wrong"] as const;

/** Flatten an object to `[path, value]` pairs for string leaves only. */
function stringLeaves(obj: unknown, prefix = ""): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  if (typeof obj === "string") return [[prefix, obj]];
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      out.push(...stringLeaves(item, `${prefix}[${index}]`));
    });
    return out;
  }
  if (obj && typeof obj === "object") {
    for (const [key, value] of Object.entries(obj)) {
      out.push(...stringLeaves(value, prefix ? `${prefix}.${key}` : key));
    }
  }
  return out;
}

type Module = { name: string; entries: Array<[string, string]>; scene: boolean };

/**
 * Every copy module. `scene` marks the Scene_Copy_Modules (ceremony/, reveal/,
 * ceremony/scene/ and demo/). live/copy.ts is listed with scene: false.
 */
const MODULES: readonly Module[] = [
  { name: "ceremony/copy.ts", entries: stringLeaves(CEREMONY_COPY), scene: true },
  { name: "ceremony/scene/copy.ts", entries: stringLeaves(SCENE_COPY), scene: true },
  { name: "reveal/copy.ts", entries: stringLeaves(REVEAL_COPY), scene: true },
  { name: "reveal/copy.ts (LIVE_COPY)", entries: stringLeaves(REVEAL_LIVE_COPY), scene: true },
  { name: "demo/copy.ts", entries: stringLeaves(DEMO_COPY), scene: true },
  { name: "live/copy.ts", entries: stringLeaves(LIVE_PAGE_COPY), scene: false },
];

/** Every string value across every module, tagged with its module. */
const ALL_ENTRIES = MODULES.flatMap((module) =>
  module.entries.map(([path, value]) => ({ module, path, value })),
);

/** Strip `{placeholder}` markers: a render-time value is never a sentence. */
const stripPlaceholders = (text: string): string => text.replace(/\{[^}]*\}/g, " ");

/** Whole-word, case-insensitive match. */
const hasWord = (text: string, word: string): boolean =>
  new RegExp(`\\b${word.replace(/\s+/g, "\\s+")}\\b`, "i").test(text);

/**
 * The landing paragraphs are copied verbatim from src/app/page.tsx (R24.3) and
 * are longer than 25 words, so the length rule skips them. Their exact text is
 * checked in the example tests below.
 */
const isVerbatimLanding = (path: string): boolean =>
  path.startsWith("landing.paragraphs");

describe("Property 23, example checks: the R24.3 table matches exactly", () => {
  it("holds the headline on / and the persona page, Accent on receipts.", () => {
    expect(`${SCENE_COPY.headlineLead} ${SCENE_COPY.headlineAccent}`).toBe(
      "Your past self returns with the receipts.",
    );
  });

  it("holds the landing button, persona notice and Demo chip", () => {
    expect(SCENE_COPY.openLetter).toBe("Open {name}'s letter");
    expect(SCENE_COPY.personaNotice).toBe(
      "{name} is fictional. This letter was prepared later as a demo.",
    );
    expect(SCENE_COPY.demoChip).toBe("Demo");
  });

  it("holds the Envelope_Front strings for wide viewports (R8.7)", () => {
    expect(CEREMONY_COPY.envelopeWrittenAsOf).toBe("Written as of {date}");
    expect(CEREMONY_COPY.envelopeOpens).toBe("Opens {date}");
    expect(CEREMONY_COPY.envelopeDemoNote).toBe("Prepared later as a demo.");
  });

  it("builds the narrow Envelope_Front lines from the same strings (R8.7)", () => {
    expect(CEREMONY_COPY.envelopeWrittenAsOf.replace(" {date}", "")).toBe(
      "Written as of",
    );
    expect(CEREMONY_COPY.envelopeOpens.replace(" {date}", "")).toBe("Opens");
  });

  it("holds the Pick_Up_Button, Figure_Entry and Recall_Pager strings", () => {
    expect(REVEAL_COPY.pickUp).toBe("Pick up the letter");
    expect(REVEAL_COPY.yourAnswer).toBe("Your answer");
    expect(REVEAL_COPY.noAnswer).toBe("No answer");
    expect(REVEAL_COPY.nextQuestion).toBe("Next question");
    expect(REVEAL_COPY.previousQuestion).toBe("Previous question");
  });

  it("composes the persona and Live_Letter counter lines (R11.5)", () => {
    const persona = `${REVEAL_COPY.questionCounter}${REVEAL_COPY.questionCounterSeparator}${REVEAL_COPY.questionCounterAsOf}`;
    expect(persona).toBe("Question {n} of {total} · as of {date}");
    expect(REVEAL_COPY.questionCounter).toBe("Question {n} of {total}");
  });

  it("holds the Demo_Index card link", () => {
    expect(DEMO_COPY.openLetter).toBe("Open the letter");
  });

  it("holds the close line, close link, close note and restart", () => {
    expect(CEREMONY_COPY.closeLine).toBe(
      "The space between the two is yours to read.",
    );
    expect(CEREMONY_COPY.closeLink).toBe(
      "Seal your own. It opens 30 seconds after you seal it.",
    );
    expect(CEREMONY_COPY.closeNote).toBe(
      "That is the whole letter. Nothing has been added to what you remembered, what was written, or the record.",
    );
    expect(CEREMONY_COPY.startOver).toBe("Start over");
  });

  it("holds the changed Ceremony error line (R24.8)", () => {
    expect(CEREMONY_COPY.stageLive.error).toBe(
      "The letter could not be opened. You can try again.",
    );
  });

  it("keeps the R24.5 strings unchanged", () => {
    expect(REVEAL_COPY.loading).toBe("Bringing the letter into the light.");
    expect(REVEAL_COPY.verifying).toBe("Checking the seal.");
    expect(REVEAL_COPY.sealIntact).toBe(
      "The seal is intact. Nothing here has changed since it was sealed.",
    );
    expect(CEREMONY_COPY.sealButton).toBe("Break the seal");
    expect(REVEAL_COPY.stage2Next).toBe("See the numbers");
  });

  it("no string anywhere still carries the retired error wording", () => {
    for (const { value, path, module } of ALL_ENTRIES) {
      expect(value, `${module.name} ${path}`).not.toContain("Something went wrong");
    }
  });
});

describe("Property 23, scoring words (R24.6, R24.7)", () => {
  it("bans Scoring_Words_Always in every copy module", () => {
    for (const { value, path, module } of ALL_ENTRIES) {
      for (const word of SCORING_ALWAYS) {
        expect(hasWord(value, word), `${module.name} ${path} contains "${word}"`).toBe(false);
      }
    }
  });

  it("bans Scoring_Words_Scene in the Scene_Copy_Modules", () => {
    for (const { value, path, module } of ALL_ENTRIES) {
      if (!module.scene) continue;
      for (const word of SCORING_SCENE) {
        expect(hasWord(value, word), `${module.name} ${path} contains "${word}"`).toBe(false);
      }
    }
  });

  it("does not check live/copy.ts for Scoring_Words_Scene", () => {
    const live = MODULES.find((module) => module.name === "live/copy.ts");
    expect(live?.scene).toBe(false);
    expect(live?.entries.length ?? 0).toBeGreaterThan(0);
  });
});

describe("Property 23: copy strings meet the tone rules (fast-check)", () => {
  it("every drawn copy string has no exclamation mark and no sentence over 25 words", () => {
    fc.assert(
      fc.property(fc.constantFrom(...ALL_ENTRIES), ({ value, path, module }) => {
        expect(value, `${module.name} ${path}`).not.toContain("!");
        if (isVerbatimLanding(path)) return;
        const sentences = stripPlaceholders(value)
          .split(/[.!?]+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        for (const sentence of sentences) {
          const words = sentence.split(/\s+/).length;
          expect(words, `${module.name} ${path}: "${sentence}"`).toBeLessThanOrEqual(25);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("every drawn copy string holds no Scoring_Words_Always word", () => {
    fc.assert(
      fc.property(fc.constantFrom(...ALL_ENTRIES), ({ value, path, module }) => {
        for (const word of SCORING_ALWAYS) {
          expect(hasWord(value, word), `${module.name} ${path}`).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("every drawn Scene_Copy_Modules string holds no Scoring_Words_Scene word", () => {
    const sceneEntries = ALL_ENTRIES.filter(({ module }) => module.scene);
    expect(sceneEntries.length).toBeGreaterThan(0);
    fc.assert(
      fc.property(fc.constantFrom(...sceneEntries), ({ value, path, module }) => {
        for (const word of SCORING_SCENE) {
          expect(hasWord(value, word), `${module.name} ${path}`).toBe(false);
        }
      }),
      { numRuns: 100 },
    );
  });
});
