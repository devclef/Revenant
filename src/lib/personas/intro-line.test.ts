// Schema tests for the intro_line on a persona (spec 09 C1.1).
//
// The intro_line is one everyday line shown above the letter. It is 1 to 160
// characters, has no digit, and uses none of the spec 03 R1.10 election or
// party terms. These tests also check the committed Persona_List.

import { describe, expect, it } from "vitest";

import rawPersonaList from "../../../content/personas/personas.json";

import { isLetterId } from "../seal-format/base64url";

import { parsePersonaList } from "./schema";

// A valid 22-char base64url letter ID (16 bytes).
const ID_A = "wom_GdH6gqP6AGgnyhIMgA";

/** A one-persona list whose intro_line is the given value. */
function listWithIntro(introLine: unknown): unknown {
  return {
    personas: [
      {
        key: "us-test",
        display_name: "Test",
        intro_line: introLine,
        region: "United States",
        letter_id: ID_A,
        written_as_of: "2024-05-12",
        opens_at: "2024-11-05T00:00:00.000Z",
        metrics: [
          {
            metric_id: "us-gasoline-regular",
            recall_subject: "a gallon of regular gasoline",
          },
        ],
        letter_path: "letters/us-test.txt",
      },
    ],
    retired_letter_ids: [],
  };
}

describe("persona intro_line", () => {
  it("accepts a plain everyday line", () => {
    expect(() =>
      parsePersonaList(listWithIntro("Maya writes about work and the week.")),
    ).not.toThrow();
  });

  it("accepts a line of exactly 160 characters", () => {
    const line = "a".repeat(160);
    expect(() => parsePersonaList(listWithIntro(line))).not.toThrow();
  });

  it("rejects a line of 161 characters", () => {
    const line = "a".repeat(161);
    expect(() => parsePersonaList(listWithIntro(line))).toThrow();
  });

  it("rejects an empty line", () => {
    expect(() => parsePersonaList(listWithIntro(""))).toThrow();
  });

  it("rejects a missing intro_line", () => {
    const list = listWithIntro("A line.") as {
      personas: Record<string, unknown>[];
    };
    delete list.personas[0].intro_line;
    expect(() => parsePersonaList(list)).toThrow();
  });

  it("rejects a non-string intro_line", () => {
    expect(() => parsePersonaList(listWithIntro(42))).toThrow();
  });

  it.each(["Written in 2024, it says.", "Filed on the 5th.", "Page 3."])(
    "rejects a digit in %j",
    (line) => {
      expect(() => parsePersonaList(listWithIntro(line))).toThrow();
    },
  );

  it.each([
    "She will vote in the spring.",
    "Her ballot is in the drawer.",
    "The campaign is on the radio.",
    "He is a Republican at heart.",
    "The Parliament met on Monday.",
    "Local politics bores her.",
  ])("rejects an R1.10 election or party term in %j", (line) => {
    expect(() => parsePersonaList(listWithIntro(line))).toThrow();
  });

  it("accepts a word that only contains a term inside it", () => {
    // \"devoted\" contains \"vote\" but does not start with it.
    expect(() =>
      parsePersonaList(listWithIntro("She is devoted to her garden.")),
    ).not.toThrow();
  });
});

describe("committed Persona_List intro_line and opening date", () => {
  it("gives every persona a valid intro_line", () => {
    const parsed = parsePersonaList(rawPersonaList);
    for (const persona of parsed.personas) {
      expect(persona.intro_line.length).toBeGreaterThan(0);
      expect(persona.intro_line.length).toBeLessThanOrEqual(160);
    }
  });

  it("opens us-maya on 5 November 2024 with no event name", () => {
    const maya = parsePersonaList(rawPersonaList).personas.find(
      (p) => p.key === "us-maya",
    );
    expect(maya?.opens_at).toBe("2024-11-05T00:00:00.000Z");
    expect("opening_event" in (maya ?? {})).toBe(false);
  });

  it("gives us-maya a valid letter ID that is not retired", () => {
    // Read from the Persona_List, not hard-coded: the letter ID was rotated
    // (spec 10 P2.1), so the test checks the rule instead of a fixed value.
    const parsed = parsePersonaList(rawPersonaList);
    const maya = parsed.personas.find((p) => p.key === "us-maya");
    expect(maya).toBeDefined();
    expect(isLetterId(maya?.letter_id ?? "")).toBe(true);
    expect(parsed.retired_letter_ids).not.toContain(maya?.letter_id);
  });
});
