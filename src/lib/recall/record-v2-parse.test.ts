import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import fc from "fast-check";
import { decryptOpeningRecord, encryptOpeningRecord } from "@/lib/crypto";
import { recallRecordV1Schema, type RecallRecordV1 } from "./record";
import { recallRecordV2Schema, type RecallRecordV2 } from "./record-v2";
import { parseRecallRecord } from "./parse-record";
import { freshOpeningKey } from "./fixtures.test-data";

// Requirements C3.7, C3.10, C3.11. Properties 12 and 13 (design.md).

// --- Generators for valid Recall_Record_V2 values ---------------------------

const digits = fc.array(fc.constantFrom(..."0123456789".split("")), {
  minLength: 1,
  maxLength: 20,
});

/** A v1 number answer: 1 to 40 characters matching the R3.3 rule. */
const numberValueArb: fc.Arbitrary<string> = fc
  .tuple(digits, fc.option(digits, { nil: null }))
  .map(([intPart, frac]) =>
    frac === null ? intPart.join("") : `${intPart.join("")}.${frac.join("")}`,
  )
  .filter((s) => s.length <= 40);

/** A text answer: trimmed, 1 to 1,000 code points, with a non-space character. */
const textValueArb: fc.Arbitrary<string> = fc
  .oneof(
    fc.string({ minLength: 1, maxLength: 80 }),
    fc.constantFrom("🙂".repeat(1000), "x".repeat(1000), "\u0001 note \u0001"),
  )
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && [...s].length <= 1000);

const v2RecordArb: fc.Arbitrary<RecallRecordV2> = fc
  .tuple(
    fc.uniqueArray(fc.constantFrom("a1", "a2", "a3", "a4"), { maxLength: 3 }),
    fc.uniqueArray(fc.constantFrom("q1", "q2", "q3", "q4", "q5"), {
      maxLength: 5,
    }),
    fc.array(textValueArb, { minLength: 3, maxLength: 3 }),
    fc.array(fc.tuple(numberValueArb, fc.boolean()), {
      minLength: 5,
      maxLength: 5,
    }),
    fc.array(fc.boolean(), { minLength: 5, maxLength: 5 }),
  )
  .map(([texts, numbers, textValues, numberValues, noAnswers]) => {
    const answers: RecallRecordV2["answers"] = [];
    texts.forEach((id, i) =>
      answers.push({ question_id: id, kind: "text", value: textValues[i] }),
    );
    numbers.forEach((id, i) => {
      const [value, sample] = numberValues[i];
      if (noAnswers[i]) {
        answers.push({ question_id: id, kind: "no_answer" });
      } else if (sample) {
        answers.push({ question_id: id, kind: "number", value, sample: true });
      } else {
        answers.push({ question_id: id, kind: "number", value });
      }
    });
    return { version: 2 as const, answers };
  });

// --- Property 12 -------------------------------------------------------------

// Feature: 10-own-questions, Property 12: The record round trip
describe("Property 12: a Recall_Record_V2 survives encryption and parsing", () => {
  let openingKey: CryptoKey;
  let letterId: Uint8Array;

  beforeAll(async () => {
    ({ openingKey, letterId } = await freshOpeningKey());
  });

  it("encrypt, decrypt and parse return a value deeply equal to the original", async () => {
    await fc.assert(
      fc.asyncProperty(v2RecordArb, async (record) => {
        expect(recallRecordV2Schema.safeParse(record).success).toBe(true);

        const box = await encryptOpeningRecord(openingKey, letterId, record);
        const decrypted = await decryptOpeningRecord(openingKey, letterId, box);
        const parsed = parseRecallRecord(decrypted);

        expect(parsed).toEqual({ ok: true, record });
      }),
      { numRuns: 25 },
    );
  });
});

// --- Property 13 -------------------------------------------------------------

const v1RecordArb: fc.Arbitrary<RecallRecordV1> = fc
  .array(
    fc.oneof(
      numberValueArb.map((value) => ({
        question_id: "q1",
        kind: "number" as const,
        value,
      })),
      fc.constant({ question_id: "q1", kind: "no_answer" as const }),
    ),
    { minLength: 1, maxLength: 1 },
  )
  .map((answers) => ({ version: 1 as const, answers: [...answers] }));

// Feature: 10-own-questions, Property 13: Version 1 records parse as before
describe("Property 13: a version 1 record parses exactly as the v1 schema does", () => {
  it("succeeds exactly when recallRecordV1Schema does, and returns the same value", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          v1RecordArb,
          v1RecordArb.map((r) => ({ ...r, extra: true })),
          v1RecordArb.map((r) => ({ ...r, version: 2 })),
          fc.anything(),
        ),
        (value) => {
          const expected = recallRecordV1Schema.safeParse(value);
          const actual = parseRecallRecord(value);
          if (expected.success) {
            // Version 1 values are the v1 schema's own result, nothing more.
            expect(actual).toEqual({ ok: true, record: expected.data });
          } else if (
            typeof value === "object" &&
            value !== null &&
            (value as { version?: unknown }).version === 1
          ) {
            expect(actual).toEqual({ ok: false });
          }
        },
      ),
      { numRuns: 300 },
    );
  });
});

// --- Examples ----------------------------------------------------------------

describe("parseRecallRecord — examples", () => {
  it("parses a version 2 record with a sample flag", () => {
    const value = {
      version: 2,
      answers: [
        { question_id: "q1", kind: "number", value: "3", sample: true },
      ],
    };
    expect(parseRecallRecord(value)).toEqual({ ok: true, record: value });
  });

  it("rejects an unknown version, a non-object, and an invalid version 2 record", () => {
    expect(parseRecallRecord({ version: 3, answers: [] })).toEqual({
      ok: false,
    });
    expect(parseRecallRecord(null)).toEqual({ ok: false });
    expect(parseRecallRecord("version 2")).toEqual({ ok: false });
    expect(parseRecallRecord([])).toEqual({ ok: false });
    expect(
      parseRecallRecord({
        version: 2,
        answers: [{ question_id: "a1", kind: "text", value: " x" }],
      }),
    ).toEqual({ ok: false });
  });
});

// --- Import boundary ---------------------------------------------------------

/** Every .ts and .tsx file under a directory, recursively. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const isTestFile = (file: string) => /\.test\.(ts|tsx)$/.test(file);

describe("the Record_Parser import boundary (C3.7)", () => {
  const srcDir = path.resolve(process.cwd(), "src");
  const files = sourceFiles(srcDir);
  const parserFile = path.resolve(srcDir, "lib/recall/parse-record.ts");
  const barrelFile = path.resolve(srcDir, "lib/recall/index.ts");

  it("scans a real source tree, so the checks below cannot pass on an empty list", () => {
    expect(files).toContain(parserFile);
    expect(files.length).toBeGreaterThan(100);
  });

  it("only tests and the recall barrel import parse-record.ts", () => {
    const importers = files.filter((file) => {
      if (file === parserFile || isTestFile(file)) return false;
      const text = readFileSync(file, "utf8");
      return /from\s+["'][^"']*\/parse-record["']/.test(text);
    });
    // The barrel re-exports the parser for callers. It does not call it.
    const nonBarrel = importers.filter((file) => file !== barrelFile);
    expect(nonBarrel).toEqual([]);
  });

  it("no production file calls parseRecallRecord", () => {
    const callers = files.filter((file) => {
      if (file === parserFile || isTestFile(file)) return false;
      return /\bparseRecallRecord\s*\(/.test(readFileSync(file, "utf8"));
    });
    expect(callers).toEqual([]);
  });
});
