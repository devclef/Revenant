import { describe, expect, it } from "vitest";
import {
  ELECTION_PARTY_TERMS,
  TERM_RULES,
  findBannedTerms,
  firstBannedTerm,
  firstPoliticalTerm,
} from "./banned-terms";

describe("TERM_RULES", () => {
  it("has exactly one rule for every entry of ELECTION_PARTY_TERMS", () => {
    expect(Object.keys(TERM_RULES).sort()).toEqual(
      [...ELECTION_PARTY_TERMS].sort(),
    );
  });
});

// One positive sentence per entry added by spec 18 (R8.1, design item 4). Each
// sentence must report the matched term as written in the sentence.
const POSITIVE: ReadonlyArray<readonly [string, string]> = [
  ["electoral", "The electoral map changed in the spring."],
  ["inaugurat", "She was inaugurated in March."],
  ["poll", "The poll closed early."],
  ["polls", "Polls opened at seven."],
  ["referendum", "A referendum is planned for June."],
  ["midterm", "The midterm results came in late."],
  ["primaries", "The primaries start next month."],
  ["caucus", "The caucus met on Monday."],
  ["swing state", "The swing state lines moved again."],
  ["thanksgiving", "We cooked for Thanksgiving."],
  ["veterans day", "Veterans Day falls on a Monday."],
  ["armistice", "The Armistice Day parade was small."],
  ["remembrance", "Remembrance Sunday was quiet."],
  ["black friday", "Black Friday deals start early."],
  ["holiday", "Holidays are always busy."],
  ["christmas", "Christmas lunch is booked."],
  ["new year", "The New Year plans are set."],
];

describe("banned terms: one positive sentence per added entry", () => {
  for (const [entry, sentence] of POSITIVE) {
    it(`matches "${entry}" and names it in "${sentence}"`, () => {
      const term = firstBannedTerm(sentence);
      expect(term).not.toBeNull();
      expect(term?.toLowerCase()).toContain(entry.split(" ")[0]);
      expect(findBannedTerms(sentence).length).toBeGreaterThan(0);
    });
  }

  it("reports the entry's own letters, as written in the text", () => {
    expect(firstBannedTerm("The poll closed early.")).toBe("poll");
    expect(firstBannedTerm("Holidays are always busy.")).toBe("Holiday");
    expect(firstBannedTerm("She was inaugurated in March.")).toBe("inaugurat");
  });

  it("matches inflected prefix forms", () => {
    expect(findBannedTerms("Two caucuses met.")).toHaveLength(1);
    expect(findBannedTerms("Two midterms passed.")).toHaveLength(1);
    expect(firstBannedTerm("Two midterms passed.")).toBe("midterm");
  });
});

describe("banned terms: phrases and whitespace", () => {
  it("matches a two-word phrase across a line break", () => {
    expect(firstBannedTerm("The swing\nstate lines moved.")).toBe(
      "swing\nstate",
    );
    expect(firstBannedTerm("Black\nFriday deals start.")).toBe("Black\nFriday");
    expect(firstBannedTerm("Veterans\nDay is near.")).toBe("Veterans\nDay");
  });

  it("matches the possessive forms of veterans day", () => {
    expect(firstBannedTerm("Veteran's Day is near.")).toBe("Veteran's Day");
    expect(firstBannedTerm("Veterans' day is near.")).toBe("Veterans' day");
  });

  it("reports the 1-based line of a match", () => {
    const text = "First line.\nSecond line.\nHolidays here.";
    expect(findBannedTerms(text)).toEqual([
      { term: "Holiday", index: text.indexOf("Holidays"), line: 3 },
    ]);
  });
});

describe("banned terms: negatives match nothing", () => {
  const NEGATIVES = [
    "pollen",
    "pollinate",
    "electric",
    "selection",
    "primary",
    "remember",
    "remembered",
    "black",
    "Friday",
    "state",
    "day",
    "holy",
    "devote",
    "apolicy",
    "electorate",
    "newly",
    "yearly",
  ];

  for (const word of NEGATIVES) {
    it(`does not match "${word}"`, () => {
      expect(findBannedTerms(word)).toEqual([]);
      expect(firstBannedTerm(word)).toBeNull();
    });
  }
});

describe("firstPoliticalTerm (deprecated alias)", () => {
  it("is the same function as firstBannedTerm", () => {
    expect(firstPoliticalTerm).toBe(firstBannedTerm);
    expect(firstPoliticalTerm("Vote today.")).toBe("Vote");
    expect(firstPoliticalTerm("A quiet walk.")).toBeNull();
  });
});
