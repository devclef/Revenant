import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  AUTHOR_QUESTION_MAX_CODE_POINTS,
  AUTHOR_QUESTIONS_MAX,
  applyStarter,
  questionRowProblem,
  questionsForSeal,
  starterTargetIndex,
} from "./author-questions";

// Property tests for the Author_Question rules (spec 10, C2.1 to C2.4).

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
  fc.record({ kind: fc.constant("starter" as const), text: anyRow }),
);

type Operation =
  | { kind: "add" }
  | { kind: "change"; index: number; text: string }
  | { kind: "remove"; index: number }
  | { kind: "starter"; text: string };

/** Applies one operation the way the form reducer will (C2.1, C2.4). */
function apply(rows: string[], op: Operation): string[] {
  // Every kind is handled below, so the switch is exhaustive.
  switch (op.kind) {
    case "add":
      return rows.length < AUTHOR_QUESTIONS_MAX ? [...rows, ""] : rows;
    case "change":
      return rows.map((row, i) => (i === op.index ? op.text : row));
    case "remove":
      return rows.filter((_, i) => i !== op.index);
    case "starter":
      return applyStarter(rows, op.text);
  }
}

describe("Property 2: Author_Question rows stay within 0 to 3", () => {
  it("keeps 0 to 3 rows for any sequence of operations, and starters never pass 3", () => {
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

  it("a starter fills the first row that is empty after trimming", () => {
    fc.assert(
      fc.property(
        fc.array(anyRow, { minLength: 1, maxLength: 3 }),
        anyRow,
        (rows, text) => {
          const firstEmpty = rows.findIndex((r) => r.trim().length === 0);
          fc.pre(firstEmpty !== -1);
          const next = applyStarter(rows, text);
          expect(next.length).toBe(rows.length);
          expect(next[firstEmpty]).toBe(text);
        },
      ),
    );
  });

  it("a starter appends a row when every row has text and fewer than 3 exist", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc
            .string({ minLength: 1, maxLength: 20 })
            .filter((s) => s.trim() !== ""),
          { maxLength: 2 },
        ),
        fc.string({ minLength: 1, maxLength: 20 }),
        (rows, text) => {
          const next = applyStarter(rows, text);
          expect(next).toEqual([...rows, text]);
        },
      ),
    );
  });

  it("a starter does nothing when 3 rows are full", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc
            .string({ minLength: 1, maxLength: 20 })
            .filter((s) => s.trim() !== ""),
          {
            minLength: 3,
            maxLength: 3,
          },
        ),
        anyRow,
        (rows, text) => {
          expect(starterTargetIndex(rows)).toBeNull();
          expect(applyStarter(rows, text)).toEqual(rows);
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

describe("starterTargetIndex", () => {
  it("points at the first empty row, then at the new row, then nowhere", () => {
    expect(starterTargetIndex([])).toBe(0);
    expect(starterTargetIndex(["a", "  "])).toBe(1);
    expect(starterTargetIndex(["a", "b"])).toBe(2);
    expect(starterTargetIndex(["a", "b", "c"])).toBeNull();
  });
});
