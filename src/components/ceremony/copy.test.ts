// Feature: 05-reveal-ceremony, Task 8 (R15.2-R15.3)
import { describe, expect, it } from "vitest";

import { CEREMONY_COPY } from "./copy";
import type { Stage } from "./stages";

/**
 * Scans every user-facing string in the ceremony copy module against the
 * tone.md and neutrality.md constraints the reveal ceremony must satisfy. No
 * DOM library: these are plain string assertions, mirroring
 * reveal/copy.test.ts and demo/copy.test.ts so all three copy modules are held
 * to the same bar:
 *
 *   R15.2  no exclamation mark anywhere.
 *   R15.3  no sentence over 25 words; none of tone.md's clichés/puns and none
 *          of neutrality.md's evaluative ("soared", "finally", "plunged")
 *          words.
 *
 * `{...}` placeholders are render-time values, not sentences, so they are
 * stripped before the sentence-length and word checks so a filled-in value can
 * never make a sentence falsely long. They carry no judgement by construction.
 *
 * The flattener walks the `stageLive` sub-object so its one line per Stage is
 * held to the same bar, keyed `stageLive.<stage>` for a readable failure.
 */
const flattenStrings = (
  obj: Record<string, unknown>,
  prefix = "",
): Array<readonly [string, string]> => {
  const out: Array<readonly [string, string]> = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") {
      out.push([path, value]);
    } else if (value && typeof value === "object") {
      out.push(...flattenStrings(value as Record<string, unknown>, path));
    }
  }
  return out;
};

const ENTRIES: ReadonlyArray<readonly [string, string]> = flattenStrings(
  CEREMONY_COPY as unknown as Record<string, unknown>,
);

/**
 * tone.md's banned clichés and puns: boo / spook / skull / mwahaha / blood /
 * gore and the documented puns ("boo-tiful", "spooktacular"). Matched
 * case-insensitively as substrings, which also catches the puns.
 */
const CLICHES = [
  "boo",
  "spook",
  "skull",
  "mwahaha",
  "blood",
  "gore",
  "boo-tiful",
  "bootiful",
  "spooktacular",
] as const;

/**
 * neutrality.md's evaluative words: copy must not describe a change as good or
 * bad ("rent soared" / "rent finally fell" are called out by name). Matched as
 * whole words, case-insensitively, so a neutral word that merely contains one
 * of these as a substring does not trip.
 */
const EVALUATIVE = [
  "soared",
  "soar",
  "plunged",
  "plunge",
  "plummeted",
  "skyrocketed",
  "crashed",
  "finally",
  "surged",
  "collapsed",
  "exploded",
  "booming",
] as const;

/** Drop `{...}` placeholders so a render-time value never skews a word count. */
const stripPlaceholders = (text: string): string =>
  text.replace(/\{[^}]*\}/g, " ");

const countWords = (sentence: string): number =>
  sentence
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

/** Split a string into sentences on ., ! or ? so each can be length-checked. */
const splitSentences = (text: string): string[] =>
  text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

/**
 * Every `Stage` value from stages.ts. Kept in sync with the `Stage` union by
 * the exhaustive `satisfies` check below: adding a Stage without listing it
 * here (or vice versa) is a compile error, so this list cannot silently drift
 * from the union the live region must cover.
 */
const ALL_STAGES = [
  "emerging",
  "sealed",
  "envelope",
  "intact",
  "recall",
  "marks",
  "seal",
  "letter",
  "figures",
  "close",
  "error",
] as const satisfies ReadonlyArray<Stage>;

// Compile-time guard: every Stage appears in ALL_STAGES (no missing member).
type _AllStagesCovered = Exclude<Stage, (typeof ALL_STAGES)[number]> extends never
  ? true
  : never;
const _allStagesCovered: _AllStagesCovered = true;
void _allStagesCovered;

describe("CEREMONY_COPY tone and neutrality", () => {
  it("has at least one string to scan", () => {
    expect(ENTRIES.length).toBeGreaterThan(0);
  });

  it("contains no exclamation mark (R15.2)", () => {
    for (const [key, value] of ENTRIES) {
      expect(value, `${key} must not contain "!"`).not.toContain("!");
    }
  });

  it("has no sentence longer than 25 words (R15.3)", () => {
    for (const [key, value] of ENTRIES) {
      for (const sentence of splitSentences(stripPlaceholders(value))) {
        expect(
          countWords(sentence),
          `${key}: sentence over 25 words -> "${sentence}"`,
        ).toBeLessThanOrEqual(25);
      }
    }
  });

  it("contains none of tone.md's clichés or puns (R15.3)", () => {
    for (const [key, value] of ENTRIES) {
      const lower = value.toLowerCase();
      for (const cliche of CLICHES) {
        expect(
          lower.includes(cliche),
          `${key} contains banned cliché/pun "${cliche}"`,
        ).toBe(false);
      }
    }
  });

  it("contains none of neutrality.md's evaluative words (R15.3)", () => {
    for (const [key, value] of ENTRIES) {
      for (const word of EVALUATIVE) {
        const whole = new RegExp(`\\b${word}\\b`, "i");
        expect(
          whole.test(value),
          `${key} contains evaluative word "${word}" -> "${value}"`,
        ).toBe(false);
      }
    }
  });

  it("has the desk string, non-empty", () => {
    expect(CEREMONY_COPY.deskEmpty.trim().length).toBeGreaterThan(0);
  });

  it("has a stageLive entry for every Stage except emerging (none missing)", () => {
    // The emerging line comes from stages.emergingStatus (see stages.test.ts).
    const liveStages = ALL_STAGES.filter((stage) => stage !== "emerging");
    const liveKeys = Object.keys(CEREMONY_COPY.stageLive).sort();
    expect(liveKeys).toEqual([...liveStages].sort());

    for (const stage of liveStages) {
      const line = (CEREMONY_COPY.stageLive as Record<string, string>)[stage];
      expect(line, `stageLive.${stage} must be a non-empty string`).toBeTypeOf(
        "string",
      );
      expect(
        line.trim().length,
        `stageLive.${stage} must not be empty`,
      ).toBeGreaterThan(0);
    }
  });

  // Property 23 (spec 07, design.md): each new or changed string matches its
  // design.md text character for character, including the changed error line
  // (R24.8).
  it("gives the new Stage lines and the changed error line their exact text (Property 23)", () => {
    expect(CEREMONY_COPY.stageLive.sealed).toBe("The letter is still sealed.");
    expect(CEREMONY_COPY.stageLive.error).toBe(
      "The letter could not be opened. You can try again.",
    );
  });

  it("keeps the R24.5 strings it does not change (Property 23)", () => {
    expect(CEREMONY_COPY.skip).toBe("Skip");
    expect(CEREMONY_COPY.sealButton).toBe("Break the seal");
    expect(CEREMONY_COPY.envelopeOpens).toBe("Opens {date}");
  });

  // Property 23 (spec 07 task 6): the figures stage line is added here, and the
  // retired strings are gone from the Ceremony copy.
  it("gives the figures stage line its exact text and drops the retired then, passage and now lines (Property 23)", () => {
    expect(CEREMONY_COPY.stageLive.figures).toBe("The figures are coming in.");
    expect(CEREMONY_COPY.stageLive).not.toHaveProperty("then");
    expect(CEREMONY_COPY.stageLive).not.toHaveProperty("passage");
    expect(CEREMONY_COPY.stageLive).not.toHaveProperty("now");
    expect(CEREMONY_COPY).not.toHaveProperty("passageLive");
    expect(CEREMONY_COPY).not.toHaveProperty("figuresLive");
    expect(CEREMONY_COPY).not.toHaveProperty("closeTitle");
    expect(CEREMONY_COPY).not.toHaveProperty("closeBody");
    expect(CEREMONY_COPY).not.toHaveProperty("closeBack");
  });

  it("the figures stage line has no '!', no scoring word and no sentence over 25 words (Property 23)", () => {
    const line = CEREMONY_COPY.stageLive.figures;
    expect(line).not.toContain("!");
    expect(line.split(/[.!?]+/).every((sentence) => sentence.trim().split(/\s+/).length <= 25)).toBe(true);
    expect(line).not.toMatch(/\b(close|right|wrong|accuracy|score|off by)\b/i);
  });

  // Property 23 (spec 07 task 6): the Close strings, exact and checked.
  it("gives the Close strings their exact text (Property 23)", () => {
    expect(CEREMONY_COPY.closeLine).toBe(
      "Your testimony sits beside the record. What lies between them is yours to read.",
    );
    expect(CEREMONY_COPY.closeLink).toBe("Seal your own. It opens 30 seconds after you seal it.");
    expect(CEREMONY_COPY.closeNote).toBe(
      "That is the whole letter. Nothing has been added to what you remembered, what was written, or the record.",
    );
    expect(CEREMONY_COPY.startOver).toBe("Start over");
  });

  it("the Close strings have no '!', no scoring word and no sentence over 25 words (Property 23)", () => {
    const strings = [
      CEREMONY_COPY.closeLine,
      CEREMONY_COPY.closeLink,
      CEREMONY_COPY.closeNote,
      CEREMONY_COPY.startOver,
    ];
    for (const s of strings) {
      expect(s).not.toContain("!");
      expect(s).not.toMatch(/\b(close|right|wrong|accuracy|score|off by)\b/i);
      expect(s.split(/[.!?]+/).every((sentence) => sentence.trim().split(/\s+/).filter(Boolean).length <= 25)).toBe(true);
    }
  });
});

describe("CEREMONY_COPY has no tilt strings (no device-motion code exists)", () => {
  it("omits tiltEnable and tiltPermissionNote, which retired with spec 07", () => {
    expect("tiltEnable" in CEREMONY_COPY).toBe(false);
    expect("tiltPermissionNote" in CEREMONY_COPY).toBe(false);
  });
});

describe("CEREMONY_COPY has no public-event strings (opening_event retired)", () => {
  it("omits introOpensEvent and introEventSource, which named an event and linked its source", () => {
    expect("introOpensEvent" in CEREMONY_COPY).toBe(false);
    expect("introEventSource" in CEREMONY_COPY).toBe(false);
  });

  it("keeps the plain envelope opening line that shows only the date", () => {
    expect(CEREMONY_COPY.envelopeOpens).toBe("Opens {date}");
  });
});

describe("spec 09 Step_Indicator and recall copy (C2, design.md Copy)", () => {
  it("gives the four steps in order, with the step label and announce line", () => {
    expect(CEREMONY_COPY.stepsLabel).toBe("Your progress");
    expect([...CEREMONY_COPY.steps]).toEqual([
      "Testify",
      "Break the seal",
      "Read",
      "See the receipts",
    ]);
    expect(CEREMONY_COPY.stepAnnounce).toBe("Step {n} of {total}: {label}");
  });

  it("gives the recall live line its ritual wording", () => {
    expect(CEREMONY_COPY.stageLive.recall).toBe("Testify. Say what you remember.");
    expect(CEREMONY_COPY.stageLive.recall).not.toContain("Tell us how");
  });
});

// Feature: 09-demo-polish, task 17 (C4.2, C7.1, F5.1): the Skip_Link and close strings.
describe("spec 09 Skip_Link and close copy (C4.2, C7.1, F5.1)", () => {
  it("gives the Skip_Link its exact text (C4.2)", () => {
    expect(CEREMONY_COPY.skipToReceipts).toBe("Skip to the receipts");
  });

  it("names the testimony and the record in the close line, and leaves the meaning to the reader (F5.1)", () => {
    expect(CEREMONY_COPY.closeLine).toMatch(/testimony/);
    expect(CEREMONY_COPY.closeLine).toMatch(/record/);
    expect(CEREMONY_COPY.closeLine).toMatch(/yours to read\.$/);
  });

  it("keeps the close line free of judgement, direction and scoring words (F5.2)", () => {
    expect(CEREMONY_COPY.closeLine).not.toContain("!");
    expect(CEREMONY_COPY.closeLine).not.toMatch(
      /\b(accuracy|score|off by|close|right|wrong|better|worse|rose|fell|rise|fall|up|down|more|less|higher|lower|increase|decrease|gain|loss|soar|drop|cheaper|dearer)\b/i,
    );
  });
});
