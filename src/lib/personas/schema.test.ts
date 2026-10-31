// Unit tests for the Persona_List schema and cross-checks (design.md
// "Persona_List", R1.3, R1.5, R2.4, R5.2).
//
// The real personas.json (through index's PERSONAS) parses cleanly, and each
// field rule and cross-check rejects bad input. A ZodError's issues are
// formatted here as `persona "<key>": <field>: <problem>`, falling back to the
// list index when the persona's own key is invalid (design.md line: "The test
// formats each failure as ...").
//
// No network, no I/O: the schema is pure and letter text is read elsewhere.

import { describe, expect, it } from "vitest";
import { z } from "zod";

import { parsePersonaList, type PersonaList } from "./schema";
import { PERSONAS } from "./index";

// --- Formatting a ZodError the way design.md asks for ------------------------

/**
 * Format a single Zod issue as `persona "<key>": <field>: <problem>`.
 *
 * The persona is found from the issue path's first `personas` index against the
 * supplied raw list, so the message names the offending persona by its own key.
 * When that key is missing or not a string (the bad-key case), the list index
 * is used instead, matching design.md. Issues on `retired_letter_ids` name that
 * list and the index.
 */
// The same key rule the schema enforces. A key that fails it cannot safely
// name the persona, so the formatter falls back to the list index then.
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
    // Fall back to the index when the key is missing or itself invalid
    // (design.md: "falling back to the list index when the key itself is
    // invalid").
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

/**
 * Parse `raw`, expecting it to fail, and return the formatted problem strings.
 * Fails the test if parsing unexpectedly succeeds.
 */
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

// --- A known-good list to mutate --------------------------------------------

// Two distinct, valid 22-char base64url letter IDs (16 bytes each).
const ID_A = "wom_GdH6gqP6AGgnyhIMgA";
const ID_B = "AAAAAAAAAAAAAAAAAAAAAA";

/** A fresh, deep-cloned valid persona list for each test to mutate freely. */
function validList(): PersonaList {
  return structuredClone({
    personas: [
      {
        key: "us-maya",
        display_name: "Maya",
        region: "United States",
        letter_id: ID_A,
        written_as_of: "2024-05-12",
        opens_at: "2024-11-05T00:00:00.000Z",
        metrics: [
          {
            metric_id: "fixture-us-gasoline-regular",
            recall_subject: "a gallon of regular gasoline",
          },
          {
            metric_id: "fixture-us-diesel",
            recall_subject: "a gallon of diesel",
          },
        ],
        letter_path: "letters/us-maya.txt",
      },
    ],
    retired_letter_ids: [],
  }) as PersonaList;
}

// --- Happy path --------------------------------------------------------------

describe("parsePersonaList — valid input", () => {
  it("accepts the hand-built valid list", () => {
    expect(() => parsePersonaList(validList())).not.toThrow();
  });

  it("accepts the real committed personas.json (via PERSONAS)", () => {
    // PERSONAS is produced by parsing personas.json at import, so if the real
    // list were invalid this import would already have thrown. Re-validate the
    // shape here so the test states the guarantee explicitly.
    expect(Array.isArray(PERSONAS)).toBe(true);
    expect(PERSONAS.length).toBeGreaterThanOrEqual(1);
    const maya = PERSONAS.find((p) => p.key === "us-maya");
    expect(maya).toBeDefined();
    expect(() =>
      parsePersonaList({
        personas: structuredClone(PERSONAS) as unknown[],
        retired_letter_ids: [],
      }),
    ).not.toThrow();
  });
});

// --- Field-shape rules -------------------------------------------------------

describe("parsePersonaList — field rules reject bad input", () => {
  it("rejects a bad key pattern, falling back to the list index", () => {
    const list = validList();
    list.personas[0].key = "US_Maya"; // underscore + uppercase: invalid
    const problems = problemsFor(list);
    // The key is invalid, so the message falls back to the index, not the key.
    expect(problems).toContainEqual(expect.stringContaining('persona "#0": key:'));
  });

  it("rejects a leading/trailing/doubled hyphen in the key", () => {
    for (const bad of ["-maya", "maya-", "us--maya"]) {
      const list = validList();
      list.personas[0].key = bad;
      expect(problemsFor(list).some((p) => p.includes(": key:"))).toBe(true);
    }
  });

  it("rejects an over-length display_name", () => {
    const list = validList();
    list.personas[0].display_name = "x".repeat(61);
    expect(
      problemsFor(list).some((p) => p.startsWith('persona "us-maya": display_name:')),
    ).toBe(true);
  });

  it("rejects an empty display_name", () => {
    const list = validList();
    list.personas[0].display_name = "";
    expect(
      problemsFor(list).some((p) => p.includes("display_name:")),
    ).toBe(true);
  });

  it("rejects an over-length region", () => {
    const list = validList();
    list.personas[0].region = "y".repeat(61);
    expect(
      problemsFor(list).some((p) => p.startsWith('persona "us-maya": region:')),
    ).toBe(true);
  });

  it("rejects a bad letter_id", () => {
    const list = validList();
    list.personas[0].letter_id = "too-short"; // not 22 base64url chars / 16 bytes
    expect(
      problemsFor(list).some((p) => p.startsWith('persona "us-maya": letter_id:')),
    ).toBe(true);
  });

  it("rejects a non-calendar written_as_of", () => {
    const list = validList();
    list.personas[0].written_as_of = "2024-02-30"; // not a real date
    expect(
      problemsFor(list).some((p) => p.startsWith('persona "us-maya": written_as_of:')),
    ).toBe(true);
  });

  it("rejects opens_at that is not millisecond-Z form", () => {
    const list = validList();
    list.personas[0].opens_at = "2024-11-05T00:00:00Z"; // no .sss
    expect(
      problemsFor(list).some((p) => p.startsWith('persona "us-maya": opens_at:')),
    ).toBe(true);
  });

  it("rejects an opens_at instant that does not round-trip", () => {
    const list = validList();
    list.personas[0].opens_at = "2024-11-05T24:00:00.000Z"; // hour 24 is invalid
    expect(
      problemsFor(list).some((p) => p.startsWith('persona "us-maya": opens_at:')),
    ).toBe(true);
  });

  it("rejects a bad letter_path", () => {
    for (const bad of ["us-maya.txt", "letters/us-maya.md", "letters/../x.txt"]) {
      const list = validList();
      list.personas[0].letter_path = bad;
      expect(
        problemsFor(list).some((p) => p.startsWith('persona "us-maya": letter_path:')),
      ).toBe(true);
    }
  });
});

// --- opens_at vs written_as_of cross-check -----------------------------------

describe("parsePersonaList — opens_at must be after written_as_of midnight", () => {
  it("rejects opens_at at exactly written_as_of midnight", () => {
    const list = validList();
    list.personas[0].written_as_of = "2024-11-05";
    list.personas[0].opens_at = "2024-11-05T00:00:00.000Z";
    expect(
      problemsFor(list).some((p) => p.startsWith('persona "us-maya": opens_at:')),
    ).toBe(true);
  });

  it("rejects opens_at earlier than written_as_of", () => {
    const list = validList();
    list.personas[0].written_as_of = "2024-11-05";
    list.personas[0].opens_at = "2024-05-12T00:00:00.000Z";
    expect(
      problemsFor(list).some((p) => p.startsWith('persona "us-maya": opens_at:')),
    ).toBe(true);
  });
});

// --- Metrics rules -----------------------------------------------------------

describe("parsePersonaList — metrics rules", () => {
  it("rejects zero metrics", () => {
    const list = validList();
    list.personas[0].metrics = [];
    expect(
      problemsFor(list).some((p) => p.startsWith('persona "us-maya": metrics:')),
    ).toBe(true);
  });

  it("rejects more than 20 metrics", () => {
    const list = validList();
    list.personas[0].metrics = Array.from({ length: 21 }, () => ({
      metric_id: "fixture-us-gasoline-regular",
      recall_subject: "a gallon of regular gasoline",
    }));
    expect(
      problemsFor(list).some((p) => p.startsWith('persona "us-maya": metrics:')),
    ).toBe(true);
  });

  it("rejects duplicate metric_id within a persona", () => {
    const list = validList();
    list.personas[0].metrics = [
      { metric_id: "fixture-us-diesel", recall_subject: "a gallon of diesel" },
      { metric_id: "fixture-us-diesel", recall_subject: "a gallon of diesel" },
    ];
    expect(
      problemsFor(list).some((p) =>
        p.startsWith('persona "us-maya": metrics.1.metric_id:'),
      ),
    ).toBe(true);
  });

  it("rejects a metric_id absent from DEMO_FIGURES.series", () => {
    const list = validList();
    list.personas[0].metrics = [
      { metric_id: "fixture-nonexistent", recall_subject: "a thing" },
    ];
    expect(
      problemsFor(list).some((p) =>
        p.startsWith('persona "us-maya": metrics.0.metric_id:'),
      ),
    ).toBe(true);
  });

  it("rejects a recall_subject that fails checkRecallSubject", () => {
    const list = validList();
    // A direction word ("higher") is banned by R2.4 / checkRecallSubject.
    list.personas[0].metrics = [
      {
        metric_id: "fixture-us-gasoline-regular",
        recall_subject: "a higher gallon of gasoline",
      },
    ];
    expect(
      problemsFor(list).some((p) =>
        p.startsWith('persona "us-maya": metrics.0.recall_subject:'),
      ),
    ).toBe(true);
  });
});

// --- Cross-persona and retired-list rules ------------------------------------

describe("parsePersonaList — cross-persona and retired-list rules", () => {
  it("rejects duplicate persona keys", () => {
    const list = validList();
    list.personas.push(structuredClone(list.personas[0]));
    // Give the second entry a distinct letter_id so only the key collides.
    list.personas[1].letter_id = ID_B;
    expect(
      problemsFor(list).some((p) =>
        p.startsWith('persona "us-maya": key:'),
      ),
    ).toBe(true);
  });

  it("rejects duplicate letter_ids across personas", () => {
    const list = validList();
    const second = structuredClone(list.personas[0]);
    second.key = "us-other";
    // second keeps ID_A, so the letter_id collides.
    list.personas.push(second);
    expect(
      problemsFor(list).some((p) =>
        p.startsWith('persona "us-other": letter_id:'),
      ),
    ).toBe(true);
  });

  it("rejects a current letter_id present in retired_letter_ids", () => {
    const list = validList();
    list.retired_letter_ids = [ID_A];
    expect(
      problemsFor(list).some((p) => p.startsWith("retired_letter_ids[0]:")),
    ).toBe(true);
  });

  it("rejects an id that appears twice in retired_letter_ids", () => {
    const list = validList();
    list.retired_letter_ids = [ID_B, ID_B];
    expect(
      problemsFor(list).some((p) => p.startsWith("retired_letter_ids[1]:")),
    ).toBe(true);
  });

  it("rejects an id appearing in both the current and retired lists", () => {
    // The persona's current id is also listed as retired: a single id in both
    // places is rejected as "contains a current letter_id".
    const list = validList();
    list.retired_letter_ids = [ID_A];
    const problems = problemsFor(list);
    expect(
      problems.some((p) =>
        p.includes("retired_letter_ids contains a current letter_id"),
      ),
    ).toBe(true);
  });
});

// --- Deep freeze -------------------------------------------------------------

describe("PERSONAS is deep-frozen", () => {
  it("freezes the list, each entry and each metric", () => {
    expect(Object.isFrozen(PERSONAS)).toBe(true);
    for (const persona of PERSONAS) {
      expect(Object.isFrozen(persona)).toBe(true);
      expect(Object.isFrozen(persona.metrics)).toBe(true);
      for (const metric of persona.metrics) {
        expect(Object.isFrozen(metric)).toBe(true);
      }
    }
  });

  it("throws in strict mode when a frozen field is mutated", () => {
    const maya = PERSONAS[0];
    expect(() => {
      // Modules are strict mode, so writing a frozen property throws. The cast
      // drops the readonly view purely so this line compiles; the point is the
      // runtime freeze, not the type.
      (maya as { display_name: string }).display_name = "Changed";
    }).toThrow(TypeError);
  });
});
