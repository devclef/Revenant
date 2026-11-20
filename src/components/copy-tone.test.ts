import { describe, expect, it } from "vitest";

import { collectStrings, toneProblems } from "./copy-tone";

describe("toneProblems", () => {
  it("flags an exclamation mark, a judgement word, a party term and a cliché", () => {
    expect(toneProblems("Well done!")).not.toEqual([]);
    expect(toneProblems("You were right about rent.")).not.toEqual([]);
    expect(toneProblems("Your party platform.")).not.toEqual([]);
    expect(toneProblems("A spooky letter.")).not.toEqual([]);
  });

  it("flags a sentence over 25 words", () => {
    const long = Array.from({ length: 26 }, () => "word").join(" ") + ".";
    expect(toneProblems(long)).not.toEqual([]);
  });

  it("passes plain everyday copy and does not match a word inside another word", () => {
    expect(toneProblems("Seal what you believe now, a goal, a worry.")).toEqual([]);
    expect(toneProblems("Your daylight and copyright notes.")).toEqual([]);
  });
});

describe("collectStrings", () => {
  it("collects strings from nested arrays and objects", () => {
    expect(collectStrings({ a: "x", b: [{ c: "y" }], d: 1 })).toEqual(["x", "y"]);
  });
});
