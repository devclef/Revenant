import { describe, expect, it } from "vitest";

import {
  AUTHOR_ANSWER_MAX_CODE_POINTS,
  AUTHOR_QUESTION_MAX_CODE_POINTS,
} from "../author-questions";
import { MAX_LETTER_CODE_POINTS } from "../constants";
import type { SelfReportedRow } from "../write-draft";

import {
  firstFailingField,
  writeCheck,
  type WriteCheckInput,
} from "./write-check";

const ANSWER_MAX = AUTHOR_ANSWER_MAX_CODE_POINTS;

const SEALING_DAY = "2026-11-18";

const OWN: SelfReportedRow = {
  name: "Rent",
  value: "1250",
  unit: "USD per month",
  region: "U.S.",
  period: "2026-11",
};

const BLANK: SelfReportedRow = {
  name: "",
  value: "",
  unit: "",
  region: "",
  period: "",
};

const VALID: WriteCheckInput = {
  text: "Dear me",
  questions: [],
  metricIds: ["us-gasoline-regular"],
  selfReported: [],
  maxFigures: 4,
  sealingDay: SEALING_DAY,
};

describe("writeCheck", () => {
  it("passes a letter with a figure and no warning", () => {
    const result = writeCheck(VALID);
    expect(result.ok).toBe(true);
    expect(result.problems).toEqual([]);
    expect(result.first).toBeNull();
  });

  it("never reports the Seal-step warning", () => {
    const result = writeCheck({
      ...VALID,
      questions: ["Who was there?"],
      answers: ["My sister, at the door."],
    });
    expect(result.problems).not.toContain("warning_unticked");
    expect(result.ok).toBe(true);
  });

  it("fails a question with no answer and names that answer, not the letter", () => {
    const result = writeCheck({
      ...VALID,
      questions: ["Who was there?"],
      answers: [""],
    });
    expect(result.ok).toBe(false);
    expect(result.first).toEqual({ kind: "answer", index: 0 });
  });

  it("names the first unanswered question and no other", () => {
    const result = writeCheck({
      ...VALID,
      questions: ["First?", "Second?", "Third?"],
      answers: ["Yes", "", ""],
    });
    expect(result.first).toEqual({ kind: "answer", index: 1 });
  });

  it("passes when every question with text has an answer", () => {
    const result = writeCheck({
      ...VALID,
      questions: ["First?", "Second?"],
      answers: ["Yes", "No"],
    });
    expect(result.ok).toBe(true);
    expect(result.first).toBeNull();
  });

  it("treats a missing answers list as unanswered", () => {
    const result = writeCheck({ ...VALID, questions: ["First?"] });
    expect(result.ok).toBe(false);
    expect(result.first).toEqual({ kind: "answer", index: 0 });
  });

  it("does not require an answer for a blank question row", () => {
    const result = writeCheck({
      ...VALID,
      questions: ["", "Second?"],
      answers: ["", "No"],
    });
    expect(result.ok).toBe(true);
  });

  it("names an over-long answer and does not pass", () => {
    const long = "a".repeat(ANSWER_MAX + 1);
    const result = writeCheck({
      ...VALID,
      questions: ["Short?", "Second?"],
      answers: ["Yes", long],
    });
    expect(result.ok).toBe(false);
    expect(result.first).toEqual({ kind: "answer", index: 1 });
  });

  it("accepts an answer of exactly 1,000 code points", () => {
    const result = writeCheck({
      ...VALID,
      questions: ["Short?"],
      answers: ["a".repeat(ANSWER_MAX)],
    });
    expect(result.ok).toBe(true);
  });

  it("puts a question's own problem before its answer", () => {
    const long = "q".repeat(AUTHOR_QUESTION_MAX_CODE_POINTS + 1);
    const result = writeCheck({
      ...VALID,
      questions: [long],
      answers: [""],
    });
    expect(result.first).toEqual({ kind: "question", index: 0 });
  });

  it("puts an earlier row's unanswered answer before a later over-long question", () => {
    const long = "q".repeat(AUTHOR_QUESTION_MAX_CODE_POINTS + 1);
    const result = writeCheck({
      ...VALID,
      questions: ["First?", long],
      answers: ["", ""],
    });
    expect(result.first).toEqual({ kind: "answer", index: 0 });
  });

  it("fails an empty letter and targets the letter", () => {
    const result = writeCheck({ ...VALID, text: "   " });
    expect(result.ok).toBe(false);
    expect(result.problems).toEqual(["letter_empty"]);
    expect(result.first).toEqual({ kind: "letter" });
  });

  it("fails a letter over the limit and targets the letter", () => {
    const text = "a".repeat(MAX_LETTER_CODE_POINTS + 1);
    const result = writeCheck({ ...VALID, text });
    expect(result.ok).toBe(false);
    expect(result.first).toEqual({ kind: "letter" });
  });

  it("targets the first over-long question row", () => {
    const long = "a".repeat(AUTHOR_QUESTION_MAX_CODE_POINTS + 1);
    const result = writeCheck({
      ...VALID,
      questions: ["Short", long],
      answers: ["Yes", "Yes"],
    });
    expect(result.problems).toContain("question_too_long");
    expect(result.first).toEqual({ kind: "question", index: 1 });
  });

  it("targets write_own when nothing is chosen and there are no rows", () => {
    const result = writeCheck({ ...VALID, metricIds: [] });
    expect(result.problems).toEqual(["nothing_to_testify"]);
    expect(result.first).toEqual({ kind: "write_own" });
  });

  it("targets row 0 when nothing is chosen and only blank rows exist", () => {
    const result = writeCheck({
      ...VALID,
      metricIds: [],
      questions: ["   "],
    });
    expect(result.problems).toEqual(["nothing_to_testify"]);
    expect(result.first).toEqual({ kind: "question", index: 0 });
  });

  it("fails more figures than the limit, and still names a target", () => {
    const result = writeCheck({
      ...VALID,
      metricIds: ["a", "b", "c", "d", "e"],
      maxFigures: 4,
    });
    expect(result.ok).toBe(false);
    expect(result.problems).toContain("figures_too_many");
    expect(result.first).not.toBeNull();
  });

  it("passes a blank own-number row, because it changes nothing", () => {
    const result = writeCheck({ ...VALID, selfReported: [BLANK] });
    expect(result.ok).toBe(true);
    expect(result.first).toBeNull();
  });

  it("targets the first missing own-number field in name, value, unit, region order", () => {
    const result = writeCheck({
      ...VALID,
      selfReported: [{ ...OWN, name: "", value: "" }],
    });
    expect(result.ok).toBe(false);
    expect(result.first).toEqual({ kind: "own_number", field: "name" });
  });

  it("targets a missing value when only the value is empty", () => {
    const result = writeCheck({
      ...VALID,
      selfReported: [{ ...OWN, value: "" }],
    });
    expect(result.first).toEqual({ kind: "own_number", field: "value" });
  });

  it("targets an invalid value with more than four decimal places", () => {
    const result = writeCheck({
      ...VALID,
      selfReported: [{ ...OWN, value: "1.23456" }],
    });
    expect(result.ok).toBe(false);
    expect(result.first).toEqual({ kind: "own_number", field: "value" });
  });

  it("targets the period when only the period breaks", () => {
    const result = writeCheck({
      ...VALID,
      selfReported: [{ ...OWN, period: "2026-12" }],
    });
    expect(result.ok).toBe(false);
    expect(result.first).toEqual({ kind: "own_number", field: "period" });
  });

  it("puts the letter before later failures in page order", () => {
    const result = writeCheck({
      ...VALID,
      text: "",
      selfReported: [{ ...OWN, unit: "" }],
    });
    expect(result.first).toEqual({ kind: "letter" });
  });
});

describe("firstFailingField", () => {
  it("returns null when the write passes", () => {
    expect(firstFailingField(VALID)).toBeNull();
  });

  it("agrees with writeCheck on the target", () => {
    const input = { ...VALID, text: "", metricIds: [] };
    expect(firstFailingField(input)).toEqual(writeCheck(input).first);
  });
});
