import { describe, expect, it } from "vitest";

import { letterSeasonWord, textSeasonWord } from "./season-words";

describe("letterSeasonWord (letter files, R5.2)", () => {
  it("accepts a letter that names November and no banned word", () => {
    expect(
      letterSeasonWord("On Sunday in November the frost is on the fields."),
    ).toBeNull();
  });

  it.each([
    ["January", "It was cold in January."],
    ["February", "Back in February the roads were bad."],
    ["March", "March was wet."],
    ["April", "April brings the first buds."],
    ["June", "We went out in June."],
    ["July", "Holidays in July."],
    ["August", "The shop closed in August."],
    ["September", "School started in September."],
  ])("rejects the month %s", (month, sentence) => {
    expect(letterSeasonWord(sentence)).toBe(month);
  });

  it("rejects the month names in any letter case", () => {
    expect(letterSeasonWord("we went in JULY")).toBe("JULY");
    expect(letterSeasonWord("we went in april")).toBe("april");
  });

  it("rejects a capital May as the month", () => {
    expect(letterSeasonWord("I see her in May.")).toBe("May");
  });

  it("allows the verb may", () => {
    expect(letterSeasonWord("She may call on Sunday.")).toBeNull();
  });

  it("allows Maybe, which is not a whole-word match for May", () => {
    expect(letterSeasonWord("Maybe we ride in the van.")).toBeNull();
  });

  it("allows October, November and December", () => {
    expect(
      letterSeasonWord(
        "October was mild, November is dark, December is coming.",
      ),
    ).toBeNull();
  });

  it.each(["spring", "Spring", "SUMMER", "springtime", "Summertime"])(
    "rejects the season word %s",
    (word) => {
      expect(letterSeasonWord(`The ${word} was long.`)).toBe(word);
    },
  );

  it("allows autumn, fall and winter in a letter", () => {
    expect(
      letterSeasonWord("Autumn ended, the fall came, and winter is near."),
    ).toBeNull();
  });

  it("does not match a season word inside a longer word", () => {
    expect(letterSeasonWord("The springer spaniel barked.")).toBeNull();
    expect(letterSeasonWord("A summerhouse by the lake.")).toBeNull();
  });

  it("reports the earliest offending word", () => {
    expect(letterSeasonWord("In summer and then in March.")).toBe("summer");
    expect(letterSeasonWord("In March and then in summer.")).toBe("March");
  });

  it("does not check weekdays in a letter", () => {
    expect(letterSeasonWord("On Saturday we ride.")).toBeNull();
  });
});

describe("textSeasonWord (intro lines, questions, answers, recollections, R6.1 to R6.3)", () => {
  it("accepts November, Sunday and autumn", () => {
    expect(
      textSeasonWord("On a Sunday in November, in the autumn light."),
    ).toBeNull();
  });

  it("accepts fall and winter", () => {
    expect(textSeasonWord("The fall and the winter are quiet.")).toBeNull();
  });

  it.each([
    ["January", "Back in January the bus was late."],
    ["October", "October was mild."],
    ["December", "We plan for December."],
    ["August", "The shop closed in August."],
  ])("rejects a month other than November: %s", (month, sentence) => {
    expect(textSeasonWord(sentence)).toBe(month);
  });

  it.each([
    "I start on Monday.",
    "We ride on Saturday.",
    "The van comes on friday.",
  ])("does not report a weekday: %s", (sentence) => {
    expect(textSeasonWord(sentence)).toBeNull();
  });

  it.each(["spring", "Summer", "springtime", "SUMMERTIME"])(
    "rejects the season word %s",
    (word) => {
      expect(textSeasonWord(`It was the ${word} then.`)).toBe(word);
    },
  );

  it("rejects a capital May as the month and allows the verb may", () => {
    expect(textSeasonWord("We meet in May.")).toBe("May");
    expect(textSeasonWord("I may go.")).toBeNull();
  });

  it("reports the earliest offending word", () => {
    expect(textSeasonWord("On Monday in summer.")).toBe("summer");
    expect(textSeasonWord("In March on Monday, then summer.")).toBe("March");
    expect(textSeasonWord("In summer, then March.")).toBe("summer");
  });
});
