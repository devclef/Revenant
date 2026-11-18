import { describe, expect, it } from "vitest";

import type { SelfReportedRow } from "../write-draft";

import { envelopeChecklist, wordCount } from "./checklist";

const OWN: SelfReportedRow = {
  name: "Rent",
  value: "1250",
  unit: "USD per month",
  region: "U.S.",
  period: "2026-11",
};

const EMPTY_INPUT = {
  text: "",
  questions: [] as string[],
  metricIds: [] as string[],
  ownNumber: null,
};

describe("wordCount", () => {
  it("counts runs of non-space characters", () => {
    expect(wordCount("")).toBe(0);
    expect(wordCount("   \t\n  ")).toBe(0);
    expect(wordCount("one")).toBe(1);
    expect(wordCount("  one  ")).toBe(1);
    expect(wordCount("a  b\n c")).toBe(3);
  });
});

describe("envelopeChecklist", () => {
  it("states an empty envelope in its empty forms", () => {
    const list = envelopeChecklist(EMPTY_INPUT);
    expect(list.letter).toBe("not written yet");
    expect(list.questions).toBe("0 of 3");
    expect(list.receipt).toBe("none yet");
    expect(list.present).toEqual({
      letter: false,
      questions: false,
      receipt: false,
    });
    expect(list.phoneLine).toBe("No letter yet · no questions · no receipt");
  });

  it("uses the singular for one word", () => {
    const list = envelopeChecklist({ ...EMPTY_INPUT, text: "Dear" });
    expect(list.letter).toBe("1 word");
    expect(list.present.letter).toBe(true);
    expect(list.phoneLine.startsWith("Letter · ")).toBe(true);
  });

  it("counts words in a longer letter", () => {
    const list = envelopeChecklist({
      ...EMPTY_INPUT,
      text: "Dear me, keep the kitchen light on",
    });
    expect(list.letter).toBe("7 words");
  });

  it("counts only the question rows that are not blank", () => {
    const list = envelopeChecklist({
      ...EMPTY_INPUT,
      questions: ["What did you expect?", "   ", "Who was there?"],
    });
    expect(list.questions).toBe("2 of 3");
    expect(list.present.questions).toBe(true);
    expect(list.phoneLine).toContain("2 questions");
  });

  it("uses the singular phone wording for one question", () => {
    const list = envelopeChecklist({ ...EMPTY_INPUT, questions: ["Why?"] });
    expect(list.questions).toBe("1 of 3");
    expect(list.phoneLine).toContain("1 question");
  });

  it("counts figures once each, singular and plural", () => {
    const one = envelopeChecklist({ ...EMPTY_INPUT, metricIds: ["a"] });
    expect(one.receipt).toBe("1 price");
    expect(one.present.receipt).toBe(true);

    const two = envelopeChecklist({ ...EMPTY_INPUT, metricIds: ["a", "b"] });
    expect(two.receipt).toBe("2 prices");

    const repeated = envelopeChecklist({
      ...EMPTY_INPUT,
      metricIds: ["a", "a"],
    });
    expect(repeated.receipt).toBe("1 price");
  });

  it("counts a complete own number and ignores an incomplete one", () => {
    const complete = envelopeChecklist({ ...EMPTY_INPUT, ownNumber: OWN });
    expect(complete.receipt).toBe("1 own number");
    expect(complete.present.receipt).toBe(true);

    const noUnit = envelopeChecklist({
      ...EMPTY_INPUT,
      ownNumber: { ...OWN, unit: "" },
    });
    expect(noUnit.receipt).toBe("none yet");

    const blankRegion = envelopeChecklist({
      ...EMPTY_INPUT,
      ownNumber: { ...OWN, region: "   " },
    });
    expect(blankRegion.receipt).toBe("none yet");
  });

  it("joins the receipt parts with a middle dot", () => {
    const list = envelopeChecklist({
      ...EMPTY_INPUT,
      metricIds: ["a", "b"],
      ownNumber: OWN,
    });
    expect(list.receipt).toBe("2 prices · 1 own number");
  });

  it("builds the full phone line from the same counts", () => {
    const list = envelopeChecklist({
      text: "Dear me",
      questions: ["a", "b", "c"],
      metricIds: ["a", "b"],
      ownNumber: OWN,
    });
    expect(list.phoneLine).toBe(
      "Letter · 3 questions · 2 prices · 1 own number",
    );
  });

  it("says no receipt on the phone line when there is none", () => {
    const list = envelopeChecklist({
      ...EMPTY_INPUT,
      text: "Dear me",
      questions: ["a"],
    });
    expect(list.phoneLine).toBe("Letter · 1 question · no receipt");
  });
});
