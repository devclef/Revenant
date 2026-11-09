import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  canAdvance,
  canAdvanceText,
  draftTextFor,
  initialField,
  pickReading,
  resolvedValue,
  setFromScale,
  textCodePoints,
  textValidity,
  typeText,
  type FieldState,
} from "./recall-field";
import { TEXT_ANSWER_MAX_CODE_POINTS } from "@/lib/recall/limits";
import { PAYLOAD_TEXT_1 } from "@/lib/recall/fixtures.test-data";

// Feature: 08-judge-polish, Task 1 (field state and Mark rules, R32).
// Property 30: The recall field never stores an unresolved number.
// Validates: Requirements 7.6, 32.5, 32.6, 32.7, 32.12, 32.13

const NUM_RUNS = 100;
const CANONICAL = /^[0-9]+(\.[0-9]+)?$/;

const empty = initialField({ text: "", noAnswer: false });
const typed = (s: FieldState, text: string) => typeText(s, text);

describe("initialField", () => {
  it("shows the draft text and puts the Mark on its value", () => {
    const s = initialField({ text: "12.5", noAnswer: false });
    expect(s.typed).toBe("12.5");
    expect(s.mark).toBe("12.5");
    expect(draftTextFor(s)).toBe("12.5");
    expect(canAdvance(s, false)).toBe(true);
  });

  it("draws no Mark for an empty draft", () => {
    expect(empty.mark).toBeNull();
    expect(canAdvance(empty, false)).toBe(false);
  });
});

describe("typeText — examples", () => {
  it("moves the Mark for a single value", () => {
    const s = typed(empty, "3.47");
    expect(s.mark).toBe("3.47");
    expect(draftTextFor(s)).toBe("3.47");
    expect(canAdvance(s, false)).toBe(true);
  });

  it("keeps the Mark and sends \"\" for an ambiguous entry", () => {
    const before = typed(empty, "3.47");
    const s = typed(before, "1.585");
    expect(s.mark).toBe("3.47");
    expect(s.parse.kind).toBe("ambiguous");
    expect(draftTextFor(s)).toBe("");
    expect(canAdvance(s, false)).toBe(false);
  });

  it("keeps the Mark and sends \"\" for an unreadable entry", () => {
    const before = typed(empty, "3.47");
    const s = typed(before, "12a");
    expect(s.mark).toBe("3.47");
    expect(draftTextFor(s)).toBe("");
    expect(canAdvance(s, false)).toBe(false);
  });

  it("clears the Mark for an empty field", () => {
    const s = typed(typed(empty, "3.47"), "");
    expect(s.mark).toBeNull();
    expect(draftTextFor(s)).toBe("");
  });
});

describe("pickReading — examples", () => {
  it("picks the decimal reading and moves the Mark to it", () => {
    const s = pickReading(typed(empty, "1.585"), "decimal");
    expect(s.mark).toBe("1.585");
    expect(draftTextFor(s)).toBe("1.585");
    expect(canAdvance(s, false)).toBe(true);
  });

  it("picks the grouping reading and moves the Mark to it", () => {
    const s = pickReading(typed(empty, "1.585"), "grouping");
    expect(s.mark).toBe("1585");
    expect(draftTextFor(s)).toBe("1585");
  });

  it("changes nothing when the field is not ambiguous", () => {
    const s = typed(empty, "12");
    expect(pickReading(s, "decimal")).toBe(s);
  });

  it("is dropped when the judge types again", () => {
    const picked = pickReading(typed(empty, "1.585"), "grouping");
    const s = typed(picked, "1.585");
    expect(s.pick).toBeNull();
    expect(draftTextFor(s)).toBe("");
  });
});

describe("setFromScale", () => {
  it("makes the typed text the canonical value of the new position", () => {
    const s = setFromScale(typed(empty, "1.585"), "3.47");
    expect(s.typed).toBe("3.47");
    expect(s.mark).toBe("3.47");
    expect(s.pick).toBeNull();
    expect(draftTextFor(s)).toBe("3.47");
  });
});

describe("resolvedValue", () => {
  it("is null for an unresolved field", () => {
    expect(resolvedValue(typed(empty, "1.585"))).toBeNull();
  });
});

// Property 30: The recall field never stores an unresolved number.
// Validates: Requirements 7.6, 32.5, 32.6, 32.7, 32.12, 32.13
describe("Property 30: the field never stores an unresolved number", () => {
  const typeArb = fc
    .oneof(
      fc.stringMatching(/^[0-9]{1,5}$/),
      fc.stringMatching(/^[0-9]{1,3}[.,][0-9]{3}$/),
      fc.stringMatching(/^[0-9]{1,4}[.,][0-9]{1,3}$/),
      fc.constantFrom("", "12a", "-3", "1.585,760,5", "1 585", " 2.5 "),
    )
    .map((text) => ({ kind: "type" as const, text }));
  const pickArb = fc.constantFrom<"decimal" | "grouping">("decimal", "grouping").map(
    (reading) => ({ kind: "pick" as const, reading }),
  );
  const scaleArb = fc
    .stringMatching(/^[0-9]{1,4}$/)
    .map((canonical) => ({ kind: "scale" as const, canonical }));
  const toggleArb = fc.constant({ kind: "toggle" as const });

  const eventArb = fc.oneof(typeArb, pickArb, scaleArb, toggleArb);

  it("holds after every event in any sequence", () => {
    fc.assert(
      fc.property(fc.array(eventArb, { maxLength: 30 }), (events) => {
        let s = empty;
        let noAnswer = false;

        for (const event of events) {
          const before = s;
          if (event.kind === "type") {
            s = typeText(s, event.text);
            expect(s.pick).toBeNull();
            if (s.parse.kind !== "value" && s.parse.kind !== "rejected") {
              expect(s.mark).toBe(before.mark);
            }
            if (s.parse.kind === "rejected" && s.parse.reason !== "empty") {
              expect(s.mark).toBe(before.mark);
            }
          } else if (event.kind === "pick") {
            s = pickReading(s, event.reading);
          } else if (event.kind === "scale") {
            s = setFromScale(s, event.canonical);
          } else {
            noAnswer = !noAnswer;
          }

          const resolved =
            s.parse.kind === "value" ||
            (s.parse.kind === "ambiguous" && s.pick !== null);
          expect(canAdvance(s, false)).toBe(resolved);
          expect(canAdvance(s, noAnswer)).toBe(noAnswer || resolved);

          const sent = draftTextFor(s);
          if (resolved) {
            expect(sent).toMatch(CANONICAL);
          } else {
            expect(sent).toBe("");
          }
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// Feature: spec 10 (own questions), task 1: text answer validity (C4.5, C4.6).
// Uses the astral-character cases the count must get right: a code point is
// one character here, even when JavaScript counts it as two UTF-16 units.

describe("textCodePoints counts code points of the trimmed text (C4.5)", () => {
  it("counts an astral character once", () => {
    expect(textCodePoints("\u{1F600}")).toBe(1);
    expect(textCodePoints("a\u{1F600}b")).toBe(3);
  });

  it("ignores leading and trailing whitespace", () => {
    expect(textCodePoints("  a\u{1F600}  ")).toBe(2);
    expect(textCodePoints("   ")).toBe(0);
  });
});

describe("textValidity: empty and over-limit are invalid (C4.6)", () => {
  it("is empty for a blank text", () => {
    expect(textValidity("")).toBe("empty");
    expect(textValidity(" \n\t ")).toBe("empty");
  });

  it("is valid up to 1,000 code points, even when that is 2,000 UTF-16 units", () => {
    const max = "\u{1F600}".repeat(TEXT_ANSWER_MAX_CODE_POINTS);
    expect(max.length).toBe(2 * TEXT_ANSWER_MAX_CODE_POINTS);
    expect(textValidity(max)).toBe("valid");
  });

  it("is too long at 1,001 code points", () => {
    expect(
      textValidity("a".repeat(TEXT_ANSWER_MAX_CODE_POINTS + 1)),
    ).toBe("too-long");
  });
});

describe("canAdvanceText: a text question is ready when valid or No answer is set (C4.6)", () => {
  it("is not ready for an empty answer without No answer", () => {
    expect(canAdvanceText("", false)).toBe(false);
  });

  it("is ready for a valid answer", () => {
    expect(canAdvanceText("My rent was 900.", false)).toBe(true);
  });

  it("is not ready for an over-limit answer without No answer", () => {
    expect(canAdvanceText("a".repeat(1001), false)).toBe(false);
  });

  it("is ready for an empty or over-limit answer when No answer is set", () => {
    expect(canAdvanceText("", true)).toBe(true);
    expect(canAdvanceText("a".repeat(1001), true)).toBe(true);
  });

  it("uses the author's question fixture text without changing it", () => {
    const question = PAYLOAD_TEXT_1.recall_questions[0];
    expect(question.answer_type).toBe("text");
    expect(canAdvanceText(question.text, false)).toBe(true);
  });
});
