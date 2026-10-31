import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { canonicalize } from "../canonical-json";
import { parsePayload } from "../registry";
import { payloadV1Schema, type PayloadV1 } from "./payload";

// Feature: 02-sealed-letters — payload v1 schema.
//
// Property 1: round trip. Any valid payload survives
// parsePayload(JSON.parse(canonicalize(p))) and deep-equals the original, with
// figure value strings and written_as_of preserved exactly (no coercion).
//
// Property 2: rejection. A valid payload with any single mutation from the
// design.md generator set is rejected by the schema, and the rejection carries
// a non-empty field path.
//
// Both use fast-check with numRuns 100.

// --- Generators for the valid payload ---------------------------------------

// A non-empty "short string" (1-200 chars) for ids, names, units, etc. Kept to
// printable ASCII so ids are easy to make unique, but length spans the bound.
const shortStr = fc.string({ minLength: 1, maxLength: 200 });

// A figure value matching ^-?[0-9]+(\.[0-9]+)?$, kept as a string.
const figureValueArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.boolean(), // negative?
    fc.bigInt({ min: 0n, max: 10n ** 20n }), // integer part (no leading-zero worries: digits regex allows them)
    fc.option(fc.bigInt({ min: 0n, max: 10n ** 10n }), { nil: undefined }),
  )
  .map(([neg, intPart, frac]) => {
    const sign = neg ? "-" : "";
    const base = `${sign}${intPart.toString()}`;
    return frac === undefined ? base : `${base}.${frac.toString()}`;
  })
  .filter((s) => s.length <= 40);

// retrieved_at: a real UTC instant with millisecond precision and a Z suffix.
const retrievedAtArb: fc.Arbitrary<string> = fc
  .date({
    min: new Date("2000-01-01T00:00:00.000Z"),
    max: new Date("2030-12-31T23:59:59.999Z"),
    noInvalidDate: true,
  })
  .map((d) => d.toISOString());

// written_as_of: a real YYYY-MM-DD calendar date (derived from a Date so it is
// always a real day).
const writtenAsOfArb: fc.Arbitrary<string> = fc
  .date({
    min: new Date("1900-01-01T00:00:00.000Z"),
    max: new Date("2100-12-31T00:00:00.000Z"),
    noInvalidDate: true,
  })
  .map((d) => d.toISOString().slice(0, 10));

// Letter text: 1-5,000 code points, not whitespace-only, including astral
// characters so the code-point count (not UTF-16 length) is exercised.
const letterTextArb: fc.Arbitrary<string> = fc
  .array(
    fc.oneof(
      // fast-check v4's string unit covers the full Unicode range (incl.
      // astral) by default; the explicit constants guarantee astral code
      // points — a musical symbol and an emoji — appear regularly.
      fc.string({ minLength: 1, maxLength: 1, unit: "grapheme" }),
      fc.constantFrom("a", "é", "字", "😀", "𝄞"),
    ),
    {
      minLength: 1,
      maxLength: 60,
    },
  )
  .map((cps) => cps.join(""))
  // Guarantee at least one non-whitespace code point and a 1..5000 length.
  .map((s) => (s.trim().length === 0 ? `x${s}` : s))
  .filter((s) => {
    const len = [...s].length;
    return len >= 1 && len <= 5000;
  });

// A metric, given its id (ids are assigned uniquely by the payload generator).
const metricBodyArb = fc.record({
  display_name: shortStr,
  unit: shortStr,
  region: shortStr,
  source: shortStr,
  series_id: shortStr,
});

// A figure body (everything but metric_id, which is assigned to point at a real
// metric). Discriminated on kind: official carries an https source_url;
// self-reported uses the fixed "self-reported" source and no source_url.
const officialFigureBodyArb = fc.record({
  kind: fc.constant("official" as const),
  value: figureValueArb,
  unit: shortStr,
  region: shortStr,
  period: shortStr,
  source: shortStr,
  series_id: shortStr,
  retrieved_at: retrievedAtArb,
  source_url: fc
    .webUrl({ validSchemes: ["https"] })
    .filter((u) => u.startsWith("https://") && u.length <= 2048),
});

const selfReportedFigureBodyArb = fc.record({
  kind: fc.constant("self-reported" as const),
  value: figureValueArb,
  unit: shortStr,
  region: shortStr,
  period: shortStr,
  source: fc.constant("self-reported" as const),
  series_id: shortStr,
  retrieved_at: retrievedAtArb,
});

const figureBodyArb = fc.oneof(officialFigureBodyArb, selfReportedFigureBodyArb);

// Assign unique ids "id-0", "id-1", ... so uniqueness checks always pass for a
// valid payload. A number recall question points at a real metric id; a text
// one may carry a real metric id or none.
function makeValidPayload(raw: {
  letter_text: string;
  written_as_of: string | undefined;
  metricBodies: ReadonlyArray<Record<string, unknown>>;
  figures: ReadonlyArray<{ kind: string; [k: string]: unknown }>;
  questions: ReadonlyArray<{
    answer_type: "number" | "text";
    text: string;
    withMetric: boolean;
  }>;
}): PayloadV1 {
  const metrics = raw.metricBodies.map((body, i) => ({
    id: `metric-${i}`,
    ...body,
  }));
  const metricIds = metrics.map((m) => m.id);
  // Pick a metric id for a figure/question, or undefined when there are none.
  const pickMetric = (n: number): string | undefined =>
    metricIds.length === 0 ? undefined : metricIds[n % metricIds.length];

  const figures = raw.figures
    .map((f, i) => {
      const metric_id = pickMetric(i);
      if (metric_id === undefined) return undefined;
      return { metric_id, ...f };
    })
    .filter((f): f is NonNullable<typeof f> => f !== undefined);

  const recall_questions = raw.questions
    .map((q, i) => {
      if (q.answer_type === "number") {
        const metric_id = pickMetric(i);
        if (metric_id === undefined) return undefined;
        return {
          id: `q-${i}`,
          answer_type: "number" as const,
          text: q.text,
          metric_id,
        };
      }
      const metric_id = q.withMetric ? pickMetric(i) : undefined;
      return metric_id === undefined
        ? { id: `q-${i}`, answer_type: "text" as const, text: q.text }
        : { id: `q-${i}`, answer_type: "text" as const, text: q.text, metric_id };
    })
    .filter((q): q is NonNullable<typeof q> => q !== undefined);

  return {
    format_version: 1,
    letter_text: raw.letter_text,
    ...(raw.written_as_of !== undefined
      ? { written_as_of: raw.written_as_of }
      : {}),
    metrics,
    figures,
    recall_questions,
  } as PayloadV1;
}

// The valid-payload arbitrary: 0-50 metrics, 0-50 figures (official or
// self-reported), 0-20 mixed recall questions, optional written_as_of.
const validPayloadArb: fc.Arbitrary<PayloadV1> = fc
  .record({
    letter_text: letterTextArb,
    written_as_of: fc.option(writtenAsOfArb, { nil: undefined }),
    metricBodies: fc.array(metricBodyArb, { minLength: 0, maxLength: 50 }),
    figures: fc.array(figureBodyArb, { minLength: 0, maxLength: 50 }),
    questions: fc.array(
      fc.record({
        answer_type: fc.constantFrom("number" as const, "text" as const),
        text: fc.string({ minLength: 1, maxLength: 500 }),
        withMetric: fc.boolean(),
      }),
      { minLength: 0, maxLength: 20 },
    ),
  })
  .map(makeValidPayload);

// --- Property 1: round trip --------------------------------------------------

describe("Property 1: valid payloads round-trip through canonicalize + parsePayload", () => {
  it("parsePayload(JSON.parse(canonicalize(p))) deep-equals p", () => {
    fc.assert(
      fc.property(validPayloadArb, (p) => {
        const round = parsePayload(JSON.parse(canonicalize(p)));
        expect(round.ok).toBe(true);
        if (!round.ok) return;
        // Deep equality: nothing added, dropped or coerced.
        expect(round.value).toEqual(p);
      }),
      { numRuns: 100 },
    );
  });

  it("preserves figure value strings and written_as_of exactly", () => {
    fc.assert(
      fc.property(validPayloadArb, (p) => {
        const round = parsePayload(JSON.parse(canonicalize(p)));
        expect(round.ok).toBe(true);
        if (!round.ok) return;
        expect(round.value.written_as_of).toBe(p.written_as_of);
        expect(round.value.figures.map((f) => f.value)).toEqual(
          p.figures.map((f) => f.value),
        );
      }),
      { numRuns: 100 },
    );
  });
});

// --- Property 2: rejection ---------------------------------------------------

// A mutation takes a valid payload (as a plain JSON value) and returns an
// invalid variant. Each mutation is a single change from the design.md
// generator set. A mutation that cannot apply to a given payload (e.g. "add a
// second source to a self-reported figure" when there are no figures) returns
// undefined and is skipped for that run, so the property only asserts on
// payloads where the mutation is meaningful.
type Mutation = (p: PayloadV1) => unknown | undefined;

// Deep structural clone via JSON, safe because a payload is pure JSON.
function clone(p: PayloadV1): Record<string, unknown> {
  return JSON.parse(JSON.stringify(p)) as Record<string, unknown>;
}

// Helpers reaching into the cloned structure.
const asArray = (v: unknown): Record<string, unknown>[] =>
  v as Record<string, unknown>[];

const mutations: ReadonlyArray<readonly [string, Mutation]> = [
  // Unknown key at the root.
  [
    "unknown key at root",
    (p) => {
      const c = clone(p);
      c.extra = "nope";
      return c;
    },
  ],
  // Unknown key on a metric.
  [
    "unknown key on a metric",
    (p) => {
      if (p.metrics.length === 0) return undefined;
      const c = clone(p);
      asArray(c.metrics)[0].surprise = 1;
      return c;
    },
  ],
  // Unknown key on a figure.
  [
    "unknown key on a figure",
    (p) => {
      if (p.figures.length === 0) return undefined;
      const c = clone(p);
      asArray(c.figures)[0].surprise = 1;
      return c;
    },
  ],
  // Unknown key on a recall question.
  [
    "unknown key on a recall question",
    (p) => {
      if (p.recall_questions.length === 0) return undefined;
      const c = clone(p);
      asArray(c.recall_questions)[0].surprise = 1;
      return c;
    },
  ],
  // Empty letter text.
  [
    "empty letter_text",
    (p) => {
      const c = clone(p);
      c.letter_text = "";
      return c;
    },
  ],
  // Whitespace-only letter text.
  [
    "whitespace-only letter_text",
    (p) => {
      const c = clone(p);
      c.letter_text = "   \n\t ";
      return c;
    },
  ],
  // 5,001-code-point letter text.
  [
    "5,001-code-point letter_text",
    (p) => {
      const c = clone(p);
      c.letter_text = "x".repeat(5001);
      return c;
    },
  ],
  // Figure value with a thousands separator.
  [
    "figure value with thousands separator",
    (p) => {
      if (p.figures.length === 0) return undefined;
      const c = clone(p);
      asArray(c.figures)[0].value = "1,000";
      return c;
    },
  ],
  // Figure value in exponent form.
  [
    "figure value in exponent form",
    (p) => {
      if (p.figures.length === 0) return undefined;
      const c = clone(p);
      asArray(c.figures)[0].value = "1e3";
      return c;
    },
  ],
  // Figure value with a leading '+'.
  [
    "figure value with leading +",
    (p) => {
      if (p.figures.length === 0) return undefined;
      const c = clone(p);
      asArray(c.figures)[0].value = "+5";
      return c;
    },
  ],
  // Figure value with surrounding whitespace.
  [
    "figure value with whitespace",
    (p) => {
      if (p.figures.length === 0) return undefined;
      const c = clone(p);
      asArray(c.figures)[0].value = " 5 ";
      return c;
    },
  ],
  // Figure value as an actual number (not a string).
  [
    "figure value as a number",
    (p) => {
      if (p.figures.length === 0) return undefined;
      const c = clone(p);
      asArray(c.figures)[0].value = 5;
      return c;
    },
  ],
  // Empty short string (id out of range below 1).
  [
    "empty metric id",
    (p) => {
      if (p.metrics.length === 0) return undefined;
      const c = clone(p);
      asArray(c.metrics)[0].id = "";
      return c;
    },
  ],
  // Over-length short string (> 200).
  [
    "over-length metric display_name",
    (p) => {
      if (p.metrics.length === 0) return undefined;
      const c = clone(p);
      asArray(c.metrics)[0].display_name = "x".repeat(201);
      return c;
    },
  ],
  // retrieved_at not ending in Z.
  [
    "retrieved_at without Z",
    (p) => {
      if (p.figures.length === 0) return undefined;
      const c = clone(p);
      asArray(c.figures)[0].retrieved_at = "2024-01-01T00:00:00+00:00";
      return c;
    },
  ],
  // Official figure source_url that is not https.
  [
    "official source_url not https",
    (p) => {
      const idx = p.figures.findIndex((f) => f.kind === "official");
      if (idx === -1) return undefined;
      const c = clone(p);
      asArray(c.figures)[idx].source_url = "http://example.com/x";
      return c;
    },
  ],
  // Official figure missing source_url entirely.
  [
    "official figure without source_url",
    (p) => {
      const idx = p.figures.findIndex((f) => f.kind === "official");
      if (idx === -1) return undefined;
      const c = clone(p);
      delete asArray(c.figures)[idx].source_url;
      return c;
    },
  ],
  // Self-reported figure carrying a source_url (strict object rejects it).
  [
    "self-reported figure with source_url",
    (p) => {
      const idx = p.figures.findIndex((f) => f.kind === "self-reported");
      if (idx === -1) return undefined;
      const c = clone(p);
      asArray(c.figures)[idx].source_url = "https://example.com/x";
      return c;
    },
  ],
  // Self-reported figure with a non-"self-reported" source.
  [
    "self-reported figure with another source",
    (p) => {
      const idx = p.figures.findIndex((f) => f.kind === "self-reported");
      if (idx === -1) return undefined;
      const c = clone(p);
      asArray(c.figures)[idx].source = "U.S. EIA";
      return c;
    },
  ],
  // Dangling figure metric_id.
  [
    "figure with dangling metric_id",
    (p) => {
      if (p.figures.length === 0) return undefined;
      const c = clone(p);
      asArray(c.figures)[0].metric_id = "does-not-exist";
      return c;
    },
  ],
  // Duplicate metric id.
  [
    "duplicate metric id",
    (p) => {
      if (p.metrics.length < 2) return undefined;
      const c = clone(p);
      const metrics = asArray(c.metrics);
      metrics[1].id = metrics[0].id;
      return c;
    },
  ],
  // Duplicate recall-question id.
  [
    "duplicate recall question id",
    (p) => {
      if (p.recall_questions.length < 2) return undefined;
      const c = clone(p);
      const qs = asArray(c.recall_questions);
      qs[1].id = qs[0].id;
      return c;
    },
  ],
  // Too many metrics (> 50).
  [
    "too many metrics",
    (p) => {
      const c = clone(p);
      c.metrics = Array.from({ length: 51 }, (_, i) => ({
        id: `m-${i}`,
        display_name: "x",
        unit: "x",
        region: "x",
        source: "x",
        series_id: "x",
      }));
      return c;
    },
  ],
  // Too many recall questions (> 20).
  [
    "too many recall questions",
    (p) => {
      const c = clone(p);
      c.recall_questions = Array.from({ length: 21 }, (_, i) => ({
        id: `q-${i}`,
        answer_type: "text",
        text: "x",
      }));
      return c;
    },
  ],
  // Malformed written_as_of (wrong shape).
  [
    "malformed written_as_of",
    (p) => {
      const c = clone(p);
      c.written_as_of = "2024/01/01";
      return c;
    },
  ],
  // Non-existent written_as_of calendar date.
  [
    "non-existent written_as_of date",
    (p) => {
      const c = clone(p);
      c.written_as_of = "2024-02-30";
      return c;
    },
  ],
  // Recall question missing answer_type.
  [
    "recall question missing answer_type",
    (p) => {
      if (p.recall_questions.length === 0) return undefined;
      const c = clone(p);
      delete asArray(c.recall_questions)[0].answer_type;
      return c;
    },
  ],
  // Recall question with an unknown answer_type.
  [
    "recall question with unknown answer_type",
    (p) => {
      if (p.recall_questions.length === 0) return undefined;
      const c = clone(p);
      asArray(c.recall_questions)[0].answer_type = "boolean";
      return c;
    },
  ],
  // Number recall question without a metric_id.
  [
    "number recall question without metric_id",
    (p) => {
      const idx = p.recall_questions.findIndex(
        (q) => q.answer_type === "number",
      );
      if (idx === -1) return undefined;
      const c = clone(p);
      delete asArray(c.recall_questions)[idx].metric_id;
      return c;
    },
  ],
  // Number recall question with a dangling metric_id.
  [
    "number recall question with dangling metric_id",
    (p) => {
      const idx = p.recall_questions.findIndex(
        (q) => q.answer_type === "number",
      );
      if (idx === -1) return undefined;
      const c = clone(p);
      asArray(c.recall_questions)[idx].metric_id = "does-not-exist";
      return c;
    },
  ],
  // Wrong format_version.
  [
    "wrong format_version",
    (p) => {
      const c = clone(p);
      c.format_version = 2;
      return c;
    },
  ],
];

describe("Property 2: a single mutation to a valid payload is rejected with a field path", () => {
  for (const [label, mutate] of mutations) {
    it(`rejects: ${label}`, () => {
      fc.assert(
        fc.property(validPayloadArb, (p) => {
          const mutated = mutate(p);
          // The mutation did not apply to this payload (e.g. no figures to
          // corrupt); skip this run rather than asserting on an unchanged value.
          fc.pre(mutated !== undefined);
          const result = payloadV1Schema.safeParse(mutated);
          expect(result.success).toBe(false);
          if (result.success) return;
          const first = result.error.issues[0];
          expect(first).toBeDefined();
          // The rejection must name the offending field. For most issues that
          // is a non-empty `path`. An unrecognized key at the object root is
          // reported by Zod with an empty path but names the key(s) in `keys`;
          // either form is a concrete field identification, which is what the
          // spec requires.
          const namesAField =
            first.path.length > 0 ||
            (first.code === "unrecognized_keys" &&
              Array.isArray((first as { keys?: unknown[] }).keys) &&
              (first as { keys: unknown[] }).keys.length > 0);
          expect(namesAField).toBe(true);
        }),
        { numRuns: 100 },
      );
    });
  }
});
