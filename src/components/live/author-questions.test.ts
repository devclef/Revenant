import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  AUTHOR_QUESTION_MAX_CODE_POINTS,
  AUTHOR_QUESTIONS_MAX,
  focusAfterRemove,
  questionRowProblem,
  questionsForSeal,
} from "./author-questions";

// Property tests for the Author_Question rules (spec 10, C2.1 to C2.3). The
// Question_Starters retired in spec 11 (L2.7), so no starter operation remains.

/** Any text, including whitespace-only, astral and over-long strings. */
const anyRow = fc.oneof(
  fc.string({ maxLength: 260 }),
  fc.stringMatching(/^[ \t\n]{0,6}$/),
  fc
    .array(fc.constantFrom("🎃", "a", " ", "é"), { maxLength: 240 })
    .map((c) => c.join("")),
);

const operation = fc.oneof(
  fc.constant({ kind: "add" as const }),
  fc.record({
    kind: fc.constant("change" as const),
    index: fc.nat(4),
    text: anyRow,
  }),
  fc.record({ kind: fc.constant("remove" as const), index: fc.nat(4) }),
);

type Operation =
  | { kind: "add" }
  | { kind: "change"; index: number; text: string }
  | { kind: "remove"; index: number };

/** Applies one operation the way the form reducer does (C2.1). */
function apply(rows: string[], op: Operation): string[] {
  // Every kind is handled below, so the switch is exhaustive.
  switch (op.kind) {
    case "add":
      return rows.length < AUTHOR_QUESTIONS_MAX ? [...rows, ""] : rows;
    case "change":
      return rows.map((row, i) => (i === op.index ? op.text : row));
    case "remove":
      return rows.filter((_, i) => i !== op.index);
  }
}

describe("Property 2: Author_Question rows stay within 0 to 3", () => {
  it("keeps 0 to 3 rows for any sequence of operations", () => {
    fc.assert(
      fc.property(
        fc.array(anyRow, { maxLength: 3 }),
        fc.array(operation, { maxLength: 30 }),
        (start, ops) => {
          let rows = [...start];
          for (const op of ops) {
            rows = apply(rows, op);
            expect(rows.length).toBeGreaterThanOrEqual(0);
            expect(rows.length).toBeLessThanOrEqual(AUTHOR_QUESTIONS_MAX);
          }
        },
      ),
    );
  });
});

describe("Property 3: empty rows are dropped and only long rows block", () => {
  it("questionsForSeal returns the non-empty rows, trimmed and in order", () => {
    fc.assert(
      fc.property(fc.array(anyRow, { maxLength: 3 }), (rows) => {
        const expected = rows.map((r) => r.trim()).filter((r) => r !== "");
        expect(questionsForSeal(rows)).toEqual(expected);
      }),
    );
  });

  it("questionRowProblem flags exactly the rows over 200 code points after trimming", () => {
    fc.assert(
      fc.property(anyRow, (row) => {
        const length = [...row.trim()].length;
        const flagged = questionRowProblem(row) === "question_too_long";
        expect(flagged).toBe(length > AUTHOR_QUESTION_MAX_CODE_POINTS);
      }),
    );
  });

  it("counts an astral character as one code point", () => {
    const exactly200 = "🎃".repeat(AUTHOR_QUESTION_MAX_CODE_POINTS);
    const over = "🎃".repeat(AUTHOR_QUESTION_MAX_CODE_POINTS + 1);
    expect(questionRowProblem(exactly200)).toBeNull();
    expect(questionRowProblem(over)).toBe("question_too_long");
  });

  it("does not flag a long row of whitespace, because it is empty after trimming", () => {
    expect(questionRowProblem(" ".repeat(500))).toBeNull();
    expect(questionsForSeal([" ".repeat(500)])).toEqual([]);
  });
});

describe("Property 7: removing a question leaves focus on the nearest remaining row, or on Add", () => {
  it("returns the row now at the removed index, else the row before it, else Add", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: AUTHOR_QUESTIONS_MAX }),
        fc.nat(AUTHOR_QUESTIONS_MAX - 1),
        (countBefore, rawIndex) => {
          const removedIndex = rawIndex % countBefore;
          const countAfter = countBefore - 1;
          const target = focusAfterRemove(countBefore, removedIndex);
          if (countAfter === 0) {
            expect(target).toEqual({ kind: "add" });
            return;
          }
          expect(target.kind).toBe("row");
          if (target.kind !== "row") return;
          expect(target.index).toBeGreaterThanOrEqual(0);
          expect(target.index).toBeLessThan(countAfter);
          if (removedIndex < countAfter) {
            expect(target.index).toBe(removedIndex);
          } else {
            expect(target.index).toBe(countAfter - 1);
          }
        },
      ),
    );
  });

  it("gives the expected focus for each case", () => {
    expect(focusAfterRemove(1, 0)).toEqual({ kind: "add" });
    expect(focusAfterRemove(2, 0)).toEqual({ kind: "row", index: 0 });
    expect(focusAfterRemove(2, 1)).toEqual({ kind: "row", index: 0 });
    expect(focusAfterRemove(3, 1)).toEqual({ kind: "row", index: 1 });
    expect(focusAfterRemove(3, 2)).toEqual({ kind: "row", index: 1 });
  });
});
