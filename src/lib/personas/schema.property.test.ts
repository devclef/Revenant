// Property 13: Persona_List validation names the persona and the field
// (design.md "Property 13", R1.3, R1.5, R5.2).
//
// For any valid generated Persona_List and any single mutation from the R1.5
// set, validation fails with a message containing the persona key (or the list
// index, when the key itself is the fault) and the field name. The unmutated
// list always passes.
//
// Style follows src/lib/figures/*.property.test.ts: fast-check generators,
// `fc.assert(fc.property(...))` with { numRuns: 100 }, no network and no I/O.
// The schema is pure; DEMO_FIGURES is built at import time from the fixture
// JSON.

import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { z } from "zod";

import { parsePersonaList } from "./schema";

// --- Formatting a ZodError the way design.md asks for ------------------------
//
// Same formatter as schema.test.ts: `persona "<key>": <field>: <problem>`,
// falling back to `#<index>` when the persona's own key is missing or invalid,
// and `retired_letter_ids[<i>]` for the retired list.

const KEY_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function formatIssue(raw: unknown, issue: z.core.$ZodIssue): string {
  const path = issue.path;
  if (path[0] === "personas" && typeof path[1] === "number") {
    const index = path[1];
    const personas = (raw as { personas?: unknown[] }).personas;
    const persona = Array.isArray(personas) ? personas[index] : undefined;
    const rawKey =
      persona !== null &&
      typeof persona === "object" &&
      typeof (persona as { key?: unknown }).key === "string"
        ? (persona as { key: string }).key
        : undefined;
    const key =
      rawKey !== undefined && KEY_RE.test(rawKey) ? rawKey : `#${index}`;
    const field = path.slice(2).join(".") || "(persona)";
    return `persona "${key}": ${field}: ${issue.message}`;
  }
  if (path[0] === "retired_letter_ids") {
    return `retired_letter_ids[${String(path[1])}]: ${issue.message}`;
  }
  return `${path.join(".")}: ${issue.message}`;
}

/** Parse `raw`, expecting failure, and return the formatted problem strings. */
function problemsFor(raw: unknown): string[] {
  try {
    parsePersonaList(raw);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return error.issues.map((issue) => formatIssue(raw, issue));
    }
    throw error;
  }
  throw new Error("expected parsePersonaList to throw, but it succeeded");
}

// --- Arbitraries for valid persona fields ------------------------------------
//
// Keys are URL segments matching ^[a-z0-9]+(-[a-z0-9]+)*$; letter IDs are real
// 22-char base64url encodings of 16 bytes (so isLetterId passes); metrics are
// drawn from the two series that DEMO_FIGURES actually holds, each with
// a recall subject that checkRecallSubject accepts.

const B64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

// A 22-char base64url string whose 16 decoded bytes are canonical. 16 bytes is
// 128 bits = 21 full 6-bit groups + 2 leftover bits, so the final character is
// one of the four whose low 4 bits are zero: A, Q, g, w. Picking the last char
// from that set guarantees a canonical (round-tripping) encoding.
const FINAL_CHARS = ["A", "Q", "g", "w"] as const;

const letterIdArb: fc.Arbitrary<string> = fc
  .tuple(
    fc.array(fc.constantFrom(...B64URL.split("")), {
      minLength: 21,
      maxLength: 21,
    }),
    fc.constantFrom(...FINAL_CHARS),
  )
  .map(([head, tail]) => head.join("") + tail);

// A valid key: 1-40 chars, lowercase-alnum groups joined by single hyphens.
const keyArb: fc.Arbitrary<string> = fc
  .array(
    fc.stringMatching(/^[a-z0-9]{1,6}$/).filter((s) => s.length > 0),
    { minLength: 1, maxLength: 4 },
  )
  .map((groups) => groups.join("-"))
  .filter((k) => k.length >= 1 && k.length <= 40 && KEY_RE.test(k));

// display_name and region: 1-60 printable chars with no newlines.
const nameArb: fc.Arbitrary<string> = fc
  .string({ minLength: 1, maxLength: 60 })
  .filter((s) => s.trim().length > 0 && !/[\n\r]/.test(s));

// A real YYYY-MM-DD date and an opens_at strictly later than its midnight UTC.
const dayArb: fc.Arbitrary<string> = fc
  .date({
    min: new Date("2000-01-01T00:00:00.000Z"),
    max: new Date("2030-12-31T00:00:00.000Z"),
    noInvalidDate: true,
  })
  .map((d) => d.toISOString().slice(0, 10));

// The two metrics DEMO_FIGURES holds, with accepted recall subjects.
const METRICS = [
  { metric_id: "us-gasoline-regular", recall_subject: "a gallon of regular gasoline" },
  { metric_id: "us-diesel", recall_subject: "a gallon of diesel" },
] as const;

interface RawPersona {
  key: string;
  display_name: string;
  region: string;
  letter_id: string;
  written_as_of: string;
  opens_at: string;
  metrics: { metric_id: string; recall_subject: string }[];
  letter_path: string;
}

// A single valid persona. opens_at is the day after written_as_of midnight, so
// the ordering cross-check passes.
const personaArb: fc.Arbitrary<RawPersona> = fc
  .record({
    key: keyArb,
    display_name: nameArb,
    region: nameArb,
    letter_id: letterIdArb,
    written_as_of: dayArb,
    metricCount: fc.integer({ min: 1, max: METRICS.length }),
  })
  .map((r) => {
    const openMs = Date.parse(`${r.written_as_of}T00:00:00.000Z`) + 86_400_000;
    const metrics = METRICS.slice(0, r.metricCount).map((m) => ({ ...m }));
    return {
      key: r.key,
      display_name: r.display_name,
      region: r.region,
      letter_id: r.letter_id,
      written_as_of: r.written_as_of,
      opens_at: new Date(openMs).toISOString(),
      metrics,
      letter_path: `letters/${r.key}.txt`,
    };
  });

// A valid Persona_List: 1-3 personas with unique keys and unique letter IDs.
const listArb: fc.Arbitrary<{ personas: RawPersona[]; retired_letter_ids: string[] }> = fc
  .array(personaArb, { minLength: 1, maxLength: 3 })
  .filter((personas) => {
    const keys = new Set(personas.map((p) => p.key));
    const ids = new Set(personas.map((p) => p.letter_id));
    return keys.size === personas.length && ids.size === personas.length;
  })
  .map((personas) => ({ personas, retired_letter_ids: [] as string[] }));

// --- The R1.5 mutation set ---------------------------------------------------
//
// Each mutation takes a fresh clone of a valid list and corrupts exactly one
// thing. It returns the mutated list plus the field name (relative to the
// persona, or the retired list) the formatted error must name.

type MutationResult = {
  list: { personas: RawPersona[]; retired_letter_ids: string[] };
  // index of the persona expected to be named (undefined => retired list).
  personaIndex: number | undefined;
  // field suffix the formatted message must contain, e.g. `: letter_id:`.
  fieldFragment: string;
};

// A second valid, distinct letter_id generator value for collisions below.
const ANOTHER_ID = "AAAAAAAAAAAAAAAAAAAAAA"; // 16 zero bytes, canonical.

const mutations: ReadonlyArray<
  (list: { personas: RawPersona[]; retired_letter_ids: string[] }) => MutationResult
> = [
  // Duplicate key: append a clone of persona 0 with a distinct letter_id.
  (list) => {
    const clone = structuredClone(list.personas[0]);
    clone.letter_id = clone.letter_id === ANOTHER_ID ? "BBBBBBBBBBBBBBBBBBBBBw" : ANOTHER_ID;
    list.personas.push(clone);
    return { list, personaIndex: list.personas.length - 1, fieldFragment: ": key:" };
  },
  // Duplicate letter_id: append a clone with a distinct key but same id.
  (list) => {
    const clone = structuredClone(list.personas[0]);
    clone.key = `${clone.key}-dup`.slice(0, 40);
    if (!KEY_RE.test(clone.key)) clone.key = "dup-persona";
    list.personas.push(clone);
    return { list, personaIndex: list.personas.length - 1, fieldFragment: ": letter_id:" };
  },
  // letter_id not 22 base64url / 16 bytes.
  (list) => {
    list.personas[0].letter_id = "not-a-valid-letter-id!";
    return { list, personaIndex: 0, fieldFragment: ": letter_id:" };
  },
  // written_as_of not a real calendar date.
  (list) => {
    list.personas[0].written_as_of = "2024-02-30";
    return { list, personaIndex: 0, fieldFragment: ": written_as_of:" };
  },
  // opens_at not in millisecond-Z form.
  (list) => {
    list.personas[0].opens_at = "2024-11-05T00:00:00Z";
    return { list, personaIndex: 0, fieldFragment: ": opens_at:" };
  },
  // opens_at not later than written_as_of midnight.
  (list) => {
    list.personas[0].written_as_of = "2024-11-05";
    list.personas[0].opens_at = "2024-11-05T00:00:00.000Z";
    return { list, personaIndex: 0, fieldFragment: ": opens_at:" };
  },
  // empty metrics.
  (list) => {
    list.personas[0].metrics = [];
    return { list, personaIndex: 0, fieldFragment: ": metrics:" };
  },
  // repeated metric_id within a persona.
  (list) => {
    list.personas[0].metrics = [
      { metric_id: "us-diesel", recall_subject: "a gallon of diesel" },
      { metric_id: "us-diesel", recall_subject: "a gallon of diesel" },
    ];
    return { list, personaIndex: 0, fieldFragment: ": metrics.1.metric_id:" };
  },
  // metric_id missing from DEMO_FIGURES.
  (list) => {
    list.personas[0].metrics = [
      { metric_id: "fixture-does-not-exist", recall_subject: "a thing" },
    ];
    return { list, personaIndex: 0, fieldFragment: ": metrics.0.metric_id:" };
  },
  // bad recall_subject (a banned direction word).
  (list) => {
    list.personas[0].metrics = [
      {
        metric_id: "us-gasoline-regular",
        recall_subject: "a higher gallon of gasoline",
      },
    ];
    return { list, personaIndex: 0, fieldFragment: ": metrics.0.recall_subject:" };
  },
  // bad letter_path.
  (list) => {
    list.personas[0].letter_path = "letters/../escape.txt";
    return { list, personaIndex: 0, fieldFragment: ": letter_path:" };
  },
  // a current letter_id also present in retired_letter_ids.
  (list) => {
    list.retired_letter_ids = [list.personas[0].letter_id];
    return { list, personaIndex: undefined, fieldFragment: "retired_letter_ids[0]:" };
  },
];

const mutationArb = fc.integer({ min: 0, max: mutations.length - 1 });

// --- Property 13 -------------------------------------------------------------

describe("Property 13: Persona_List validation names the persona and the field", () => {
  it("the unmutated generated list always passes", () => {
    fc.assert(
      fc.property(listArb, (list) => {
        expect(() => parsePersonaList(structuredClone(list))).not.toThrow();
      }),
      { numRuns: 100 },
    );
  });

  it("any single R1.5 mutation fails and names the persona and field", () => {
    fc.assert(
      fc.property(listArb, mutationArb, (list, mutationIndex) => {
        const { list: mutated, personaIndex, fieldFragment } = mutations[
          mutationIndex
        ](structuredClone(list));

        const problems = problemsFor(mutated);
        expect(problems.length).toBeGreaterThan(0);

        if (personaIndex === undefined) {
          // Retired-list fault: the message names that list and the index.
          expect(problems.some((p) => p.startsWith(fieldFragment))).toBe(true);
          return;
        }

        // A persona fault: the message must name the offending persona, by its
        // key when valid, else by `#<index>`, and the field.
        const persona = mutated.personas[personaIndex];
        const expectedName =
          KEY_RE.test(persona.key) ? persona.key : `#${personaIndex}`;
        const prefix = `persona "${expectedName}"`;
        expect(
          problems.some(
            (p) => p.startsWith(prefix) && p.includes(fieldFragment),
          ),
        ).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});
