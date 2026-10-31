import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { canonicalize } from "./canonical-json";
import { envelopeHash } from "./hash";

const here = dirname(fileURLToPath(import.meta.url));
const rfcDir = join(here, "__fixtures__", "rfc8785");

// The five owner-committed RFC 8785 vectors (see __fixtures__/rfc8785/README.md).
const VECTORS = ["arrays", "structures", "unicode", "values", "weird"] as const;

// Read a fixture file with no network access. A missing file fails the test
// naming the file, rather than skipping: an absent vector must be visible, not
// silently passed over.
function readFixture(kind: "input" | "output", name: string): string {
  const path = join(rfcDir, kind, `${name}.json`);
  try {
    return readFileSync(path, "utf8");
  } catch (err) {
    throw new Error(
      `missing RFC 8785 fixture ${kind}/${name}.json at ${path}: ${String(err)}`,
    );
  }
}

describe("canonicalize: RFC 8785 test vectors", () => {
  for (const name of VECTORS) {
    it(`canonicalises the '${name}' vector to its expected output`, () => {
      const input = JSON.parse(readFixture("input", name));
      const expected = readFixture("output", name);
      expect(canonicalize(input)).toBe(expected);
    });
  }
});

// A deep JSON value generator (objects, arrays, strings, finite numbers,
// booleans, null) for the structural properties below.
const jsonValue = fc.letrec<{ value: unknown }>((tie) => ({
  value: fc.oneof(
    { depthSize: "small", withCrossShrink: true },
    fc.constant(null),
    fc.boolean(),
    fc.double({ noNaN: true, noDefaultInfinity: true }),
    fc.integer(),
    fc.string(),
    fc.array(tie("value"), { maxLength: 6 }),
    fc.dictionary(fc.string(), tie("value"), { maxKeys: 6 }),
  ),
})).value;

// Return a structural clone of `value` with every object's keys reinserted in a
// shuffled order. Canonicalisation must not depend on insertion order.
function reorderKeys(value: unknown, rng: () => number): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => reorderKeys(v, rng));
  }
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    for (let i = entries.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [entries[i], entries[j]] = [entries[j], entries[i]];
    }
    const out: Record<string, unknown> = {};
    // Assign with defineProperty so a key like "__proto__" becomes a genuine
    // own data property (matching how canonicalize reads it via Object.keys),
    // instead of triggering the Object.prototype __proto__ setter and being
    // silently dropped. A plain `out[k] = v` would lose such a key and make the
    // reordered clone diverge from the original.
    for (const [k, v] of entries) {
      Object.defineProperty(out, k, {
        value: reorderKeys(v, rng),
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }
    return out;
  }
  return value;
}

// Feature: 02-sealed-letters, Property 5: canonicalisation is idempotent and
// independent of key insertion order and source whitespace, giving a stable
// envelope hash.
describe("Property 5: canonicalisation is stable", () => {
  it("is idempotent: canonicalize(parse(canonicalize(v))) === canonicalize(v)", () => {
    fc.assert(
      fc.property(jsonValue, (v) => {
        const once = canonicalize(v);
        const twice = canonicalize(JSON.parse(once));
        expect(twice).toBe(once);
      }),
      { numRuns: 100 },
    );
  });

  it("is independent of object key insertion order", () => {
    fc.assert(
      fc.property(jsonValue, fc.integer(), (v, seed) => {
        // A small deterministic PRNG seeded per run, so the shuffle is
        // reproducible when fast-check reports a counterexample.
        let state = seed | 0;
        const rng = () => {
          state = (state * 1103515245 + 12345) & 0x7fffffff;
          return state / 0x7fffffff;
        };
        const reordered = reorderKeys(v, rng);
        expect(canonicalize(reordered)).toBe(canonicalize(v));
      }),
      { numRuns: 100 },
    );
  });

  it("is independent of source whitespace", () => {
    fc.assert(
      fc.property(jsonValue, (v) => {
        const compact = JSON.stringify(v);
        const spaced = JSON.stringify(v, null, 2);
        expect(canonicalize(JSON.parse(spaced))).toBe(
          canonicalize(JSON.parse(compact)),
        );
      }),
      { numRuns: 100 },
    );
  });

  it("gives a stable envelopeHash regardless of key order", async () => {
    await fc.assert(
      fc.asyncProperty(jsonValue, fc.integer(), async (v, seed) => {
        let state = seed | 0;
        const rng = () => {
          state = (state * 1103515245 + 12345) & 0x7fffffff;
          return state / 0x7fffffff;
        };
        const reordered = reorderKeys(v, rng);
        expect(await envelopeHash(reordered)).toBe(await envelopeHash(v));
      }),
      { numRuns: 100 },
    );
  });
});

// Non-representable values, each inserted at an arbitrary depth below.
const BAD_VALUES: ReadonlyArray<readonly [string, unknown]> = [
  ["NaN", NaN],
  ["+Infinity", Infinity],
  ["-Infinity", -Infinity],
  ["undefined", undefined],
  ["function", () => 0],
  ["symbol", Symbol("x")],
  ["bigint", 10n],
];

// Wrap `bad` inside `wrappers` layers of alternating array/object nesting, each
// layer also carrying an innocuous sibling so the structure is non-trivial. The
// bad value ends up `wrappers` levels deep; `wrappers === 0` returns it bare.
// `wrappers` is bounded (0..6), so nesting is explicit and never recursive at
// generation time — no deep-generator stack blow-up.
function nestBad(bad: unknown, wrappers: readonly boolean[]): unknown {
  let node: unknown = bad;
  for (const asArray of wrappers) {
    node = asArray ? ["ok", node, 1] : { a: "ok", bad: node, z: 2 };
  }
  return node;
}

// Feature: 02-sealed-letters, Property 6: canonicalisation throws on any value
// with no JSON form (NaN, Infinity, undefined, function, symbol, BigInt),
// inserted at any depth, rather than coercing or dropping it.
describe("Property 6: canonicalize rejects non-JSON values at any depth", () => {
  for (const [label, bad] of BAD_VALUES) {
    it(`throws when a ${label} appears at the top level`, () => {
      expect(() => canonicalize(bad)).toThrow();
    });

    it(`throws when a ${label} is inserted at depth`, () => {
      fc.assert(
        // Each boolean picks array (true) or object (false) wrapping for that
        // layer; 1..6 layers place the bad value strictly below the top.
        fc.property(
          fc.array(fc.boolean(), { minLength: 1, maxLength: 6 }),
          (wrappers) => {
            const withBad = nestBad(bad, wrappers);
            expect(() => canonicalize(withBad)).toThrow();
          },
        ),
        { numRuns: 100 },
      );
    });
  }
});
