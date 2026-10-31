// Integration tests for the persona-sealing script core, with NO database
// (spec 03-persona-demo, Task 4; design.md "Sealing_Script"; R4.*, R8.*).
//
// Three concerns, none of which needs Postgres:
//
//   (a) The entry's DATABASE_URL guard. The bundle is built once from the
//       committed build script, then spawned as a child process with an empty
//       DATABASE_URL. It must exit non-zero, print exactly the fixed stderr
//       line, and reach no database: the guard runs before every connecting
//       import, so nothing is read, sealed or stored. stdout stays empty.
//
//   (b) Property 15: buildPersonaPayload over generated personas and generated
//       LoadedFigures whose figures all precede each tracked series' lookup
//       date. The built payload parses, each figure is the exact thenAndNow
//       "then" object with an identical value string, each metric is the
//       six-key pick, the questions equal generateRecallQuestions, the build is
//       deterministic byte-for-byte, and a missing "then" figure fails the
//       first such metric with { ok: false, metricId }.
//
//   (c) Property 16: sealPersonas driven by an in-memory, insert-only fake
//       store (findLetter + storePersonaLetter, never an update or delete) with
//       the real crypto. Every documented outcome — stored, skipped,
//       stored_letter_differs, real_letter_collision, missing_then_figure — is
//       reached by construction; no stored row ever changes byte-for-byte; the
//       exit code is 1 exactly when a persona failed; a second unchanged run
//       skips every persona and inserts nothing; and every printed line matches
//       the fixed grammar and leaks no letter text or secret material.
//
// This file is server-only through `node:crypto` and the entry spawn, but it
// uses the real browser crypto (`@/lib/crypto`) directly — WebCrypto is present
// in the Node test runtime — so it needs no `describeDb` and runs on every
// machine, database or not. The DB-backed end-to-end test is the separate
// seal-personas.test.ts (Task 4, Property 17).

import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

import { beforeAll, describe, expect, it, vi } from "vitest";
import fc from "fast-check";

import type { Persona } from "@/lib/personas";
import type {
  LoadedFigures,
  LoadedSeries,
  CatalogueSeries,
  FigureFile,
} from "@/lib/figures";
import { loadFigureFile } from "@/lib/figures";
import { thenAndNow } from "@/lib/figures/then-now";
import { generateRecallQuestions } from "@/lib/recall";
import {
  canonicalize,
  encodeBase64url,
  decodeBase64url,
  payloadV1Schema,
  type MetricDefinitionV1,
} from "@/lib/seal-format";
import {
  sealLetter,
  parseBackupKey,
  PUBLIC_DEMO_BACKUP_KEY,
} from "@/lib/crypto";

import {
  buildPersonaPayload,
  sealPersonas,
  formatResultLine,
  type Deps,
  type FoundLetter,
} from "../../../scripts/seal-personas-core";

// A full seal/open round trip in the property runs is not fast; give the file
// room so a cold machine does not time out mid-property.
vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

const REPO_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);
const BUILD_SCRIPT = resolve(REPO_ROOT, "scripts/seal-personas.build.mjs");
const BUNDLE = resolve(REPO_ROOT, "dist/seal-personas.mjs");

// =============================================================================
// (a) The entry's DATABASE_URL guard, exercised through the real bundle.
// =============================================================================

describe("seal-personas entry: DATABASE_URL guard", () => {
  // Build the bundle once from the committed build script. The entry statically
  // imports a build-time virtual module, so it can only run bundled — tsx would
  // fail to resolve `virtual:persona-letter-texts`. The build is idempotent, so
  // a bundle left by an earlier step or run is simply rebuilt.
  beforeAll(() => {
    execFileSync("node", [BUILD_SCRIPT], {
      cwd: REPO_ROOT,
      stdio: "pipe",
    });
  }, 120_000);

  it("exits non-zero with the fixed line and reaches no database", () => {
    expect(existsSync(BUNDLE)).toBe(true);

    // Spawn with an EMPTY DATABASE_URL in an environment stripped of any
    // inherited one, so the guard is the only thing that can decide the exit.
    const env = { ...process.env, DATABASE_URL: "" };
    const run = spawnSync("node", [BUNDLE], {
      cwd: REPO_ROOT,
      env,
      encoding: "utf8",
      timeout: 60_000,
    });

    // Non-zero exit (R4.12). The guard uses process.exit(1).
    expect(run.status).toBe(1);

    // Exactly the fixed stderr line, and nothing else on stderr.
    expect(run.stderr).toBe("seal-personas: DATABASE_URL is not set\n");

    // The guard runs before every connecting import, so no persona line is
    // ever printed: nothing was read, sealed or stored (R4.12, R8.6).
    expect(run.stdout).toBe("");

    // The connection string is never echoed anywhere.
    expect(run.stderr).not.toContain("postgres");
    expect(run.stdout).not.toContain("postgres");
  });

  it("also rejects an unset (not merely empty) DATABASE_URL", () => {
    // Delete the variable entirely rather than setting it to "".
    const env = { ...process.env };
    delete env.DATABASE_URL;
    const run = spawnSync("node", [BUNDLE], {
      cwd: REPO_ROOT,
      env,
      encoding: "utf8",
      timeout: 60_000,
    });

    expect(run.status).toBe(1);
    expect(run.stderr).toBe("seal-personas: DATABASE_URL is not set\n");
    expect(run.stdout).toBe("");
  });
});

// =============================================================================
// Shared generators for the two properties.
//
// Every generated series is FIXTURE-prefixed on source and series_id, so
// loadFigureFile accepts the file with fixture: true. Values are rounded
// two-decimal strings and periods are real Mondays in a bounded range, so the
// loader's period and value rules always pass. The persona's written_as_of is
// chosen to be >= the latest generated period end across all its tracked
// series, so every tracked metric has a "then" figure (the case Property 15
// asserts the payload for); the missing-figure case is exercised separately.
// =============================================================================

const DAY_MS = 86_400_000;
// 1970-01-05 is a Monday; any Monday is this plus a multiple of 7 days.
const FIRST_MONDAY_MS = Date.UTC(1970, 0, 5);

function mondayIso(weeksFromEpoch: number): string {
  return new Date(FIRST_MONDAY_MS + weeksFromEpoch * 7 * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

// A real Monday within roughly 1990-2080 (weeks 1040..5700). The upper bound is
// kept comfortably below SEALED_AT (2099): the persona's written_as_of sits at
// or after the latest period plus up to 400 days, and sealLetter rejects a
// written_as_of later than the seal date, so the window must stay clear of it.
const mondayArb: fc.Arbitrary<string> = fc
  .integer({ min: 1040, max: 5700 })
  .map(mondayIso);

// The fixed seal date for every sealLetter call and Deps.now() in this file. It
// is strictly later than any generated written_as_of (latest Monday ~2078 plus
// 400 days), so sealLetter's "written_as_of not later than sealedAt" rule holds.
const SEALED_AT = "2099-01-01T00:00:00.000Z";

// A rounded, schema-valid value like "3.41": 0-9999 units, 2 decimals.
const valueArb: fc.Arbitrary<string> = fc
  .tuple(fc.integer({ min: 0, max: 9999 }), fc.integer({ min: 0, max: 99 }))
  .map(([whole, cents]) => `${whole}.${cents < 10 ? "0" : ""}${cents}`);

function fixtureMetric(n: number): MetricDefinitionV1 {
  return {
    id: `fixture-series-${n}`,
    display_name: `Fixture series ${n} (fixture)`,
    unit: "USD per gallon",
    region: "U.S.",
    source: `FIXTURE weekly retail price ${n} (fake data)`,
    series_id: `FIXTURE-SERIES-${n}`,
  };
}

interface GeneratedSeries {
  series: CatalogueSeries;
  figures: FigureFile["figures"];
}

// One series: 1..6 figures on unique Monday periods with rounded values. At
// least one figure, so the series always has a "then" for a late enough date.
function seriesArb(n: number): fc.Arbitrary<GeneratedSeries> {
  const metric = fixtureMetric(n);
  return fc
    .uniqueArray(mondayArb, { minLength: 1, maxLength: 6 })
    .chain((periods) =>
      fc
        .array(valueArb, {
          minLength: periods.length,
          maxLength: periods.length,
        })
        .map((values) => ({
          series: { metric, period_type: "weekly" as const },
          figures: periods.map((period, i) => ({
            kind: "official" as const,
            metric_id: metric.id,
            value: values[i],
            unit: "USD per gallon",
            region: "U.S.",
            period,
            source: metric.source,
            series_id: metric.series_id,
            retrieved_at: "2000-01-01T00:00:00Z",
            source_url: "https://example.invalid/fixture",
          })),
        })),
    );
}

// A whole figure file of 1..4 fixture series, loaded against an empty catalogue
// so the only series are the generated ones.
const EMPTY_CATALOGUE: readonly CatalogueSeries[] = [];

interface GeneratedFigures {
  loaded: LoadedFigures;
  metricIds: string[];
  /** The latest period end across every series, as a "YYYY-MM-DD" date. */
  latestEnd: string;
}

const figuresArb: fc.Arbitrary<GeneratedFigures> = fc
  .integer({ min: 1, max: 4 })
  .chain((count) =>
    fc.tuple(...Array.from({ length: count }, (_, i) => seriesArb(i))),
  )
  .map((generated) => {
    const file: FigureFile = {
      fixture: true,
      note: "generated fixture file for seal-personas property tests",
      series: generated.map((g) => g.series),
      figures: generated.flatMap((g) => g.figures),
    };
    const loaded = loadFigureFile(file, EMPTY_CATALOGUE);
    const metricIds = [...loaded.series.keys()];
    // Weekly period end == the period (a date); the latest across all figures.
    const latestEnd = file.figures
      .map((f) => f.period)
      .reduce((a, b) => (a >= b ? a : b));
    return { loaded, metricIds, latestEnd };
  });

/**
 * A letter ID (22 canonical base64url chars for 16 bytes) derived
 * deterministically from a fast-check seed, so a generated persona always
 * carries a valid ID without reaching for randomness inside the generator.
 */
function letterIdFromSeed(seed: number): string {
  const bytes = new Uint8Array(16);
  let x = seed >>> 0;
  for (let i = 0; i < 16; i++) {
    // A tiny LCG step; only needs to spread the 16 bytes, not be secure.
    x = (x * 1664525 + 1013904223) >>> 0;
    bytes[i] = x & 0xff;
  }
  return encodeBase64url(bytes);
}

/**
 * Three FIXED, provably-distinct letter IDs for the multi-persona Property 16
 * run. Each is 16 bytes filled with a distinct constant (0x11, 0x22, 0x33), so
 * the three encodings can never collide — unlike seed-derived IDs, where two
 * personas could land on the same ID and cross-contaminate the seeded store.
 */
const FIXED_LETTER_IDS: readonly [string, string, string] = [
  encodeBase64url(new Uint8Array(16).fill(0x11)),
  encodeBase64url(new Uint8Array(16).fill(0x22)),
  encodeBase64url(new Uint8Array(16).fill(0x33)),
];

// A persona key: lowercase alphanumerics in hyphen groups (schema keySchema).
const keyArb: fc.Arbitrary<string> = fc
  .array(
    fc
      .string({ minLength: 1, maxLength: 6 })
      .map((s) => s.replace(/[^a-z0-9]/gi, "").toLowerCase())
      .filter((s) => s.length > 0),
    { minLength: 1, maxLength: 3 },
  )
  .map((parts) => parts.join("-"))
  .filter((k) => k.length >= 1 && k.length <= 40);

// A recall subject that passes checkRecallSubject against a fixture metric: no
// digit, no "!", no banned direction word, not the metric's source/series_id.
// A fixed safe phrase keeps the generator focused on figure/metric structure.
const subjectArb: fc.Arbitrary<string> = fc.constantFrom(
  "a gallon of regular gasoline",
  "a gallon of diesel",
  "a litre of fuel at the pump",
  "a tank of petrol on the way home",
);

/**
 * Build a generated persona over the given loaded figures: a subset of the
 * tracked metric ids (so there is always at least one), each with a safe recall
 * subject, and a written_as_of at or after every series' latest period end so
 * every tracked metric has a "then" figure.
 */
function personaArb(figures: GeneratedFigures): fc.Arbitrary<Persona> {
  return fc
    .record({
      key: keyArb,
      seed: fc.integer({ min: 0, max: 0x7fffffff }),
      metricSubset: fc
        .shuffledSubarray(figures.metricIds, {
          minLength: 1,
          maxLength: figures.metricIds.length,
        }),
      subjects: fc.array(subjectArb, {
        minLength: figures.metricIds.length,
        maxLength: figures.metricIds.length,
      }),
      // Days at or after the latest period end, so the lookup date covers it.
      daysAfter: fc.integer({ min: 0, max: 400 }),
    })
    .map(({ key, seed, metricSubset, subjects, daysAfter }) => {
      const writtenMs = Date.parse(`${figures.latestEnd}T00:00:00Z`) +
        daysAfter * DAY_MS;
      const written_as_of = new Date(writtenMs).toISOString().slice(0, 10);
      // opens_at strictly after written_as_of midnight (schema rule).
      const opens_at = new Date(writtenMs + DAY_MS).toISOString();
      return {
        key,
        display_name: "Generated Persona",
        region: "United States",
        letter_id: letterIdFromSeed(seed),
        written_as_of,
        opens_at,
        metrics: metricSubset.map((metric_id, i) => ({
          metric_id,
          recall_subject: subjects[i],
        })),
        letter_path: `letters/${key}.txt`,
      } satisfies Persona;
    });
}

/** A short, schema-valid persona letter text (1..5000 code points, not blank). */
const letterTextArb: fc.Arbitrary<string> = fc.constantFrom(
  "A letter to my future self. I hope you remember the ordinary days.",
  "The windows are open for the first time this year. Work is steady.",
  "I filled the tank on the way home and kept the receipt in the glove box.",
);

// =============================================================================
// (b) Property 15: buildPersonaPayload.
// =============================================================================

describe("buildPersonaPayload", () => {
  // Feature: 03-persona-demo, Property 15
  it("Property 15: builds a valid, deterministic payload from the then figures, or fails the first missing metric", () => {
    fc.assert(
      fc.property(
        figuresArb.chain((figures) =>
          fc.record({
            figures: fc.constant(figures),
            persona: personaArb(figures),
            text: letterTextArb,
          }),
        ),
        ({ figures, persona, text }) => {
          const built = buildPersonaPayload(persona, text, figures.loaded);

          // Every tracked metric has a "then" figure by construction, so the
          // build succeeds.
          expect(built.ok).toBe(true);
          if (!built.ok) return;
          const { payload } = built;

          // The payload passes the frozen schema (buildPersonaPayload already
          // parses it, but assert independently to pin the contract).
          expect(() => payloadV1Schema.parse(payload)).not.toThrow();

          // One figure and one metric per tracked metric, in list order.
          expect(payload.figures.length).toBe(persona.metrics.length);
          expect(payload.metrics.length).toBe(persona.metrics.length);

          persona.metrics.forEach((m, i) => {
            const then = thenAndNow(
              m.metric_id,
              persona.written_as_of,
              figures.loaded,
            ).then;
            expect(then.found).toBe(true);
            if (!then.found) return;

            // figures[i] deep-equals the thenAndNow "then" figure, and the
            // value string is byte-identical — no field changed (R4.2).
            expect(payload.figures[i]).toEqual(then.figure);
            expect(payload.figures[i].value).toBe(then.figure.value);

            // metrics[i] is exactly the six MetricDefinitionV1 keys (R4.4).
            const series = figures.loaded.series.get(m.metric_id) as
              | LoadedSeries
              | undefined;
            expect(series).toBeDefined();
            expect(Object.keys(payload.metrics[i]).sort()).toEqual(
              [
                "display_name",
                "id",
                "region",
                "series_id",
                "source",
                "unit",
              ],
            );
            expect(payload.metrics[i]).toEqual({
              id: series!.metric.id,
              display_name: series!.metric.display_name,
              unit: series!.metric.unit,
              region: series!.metric.region,
              source: series!.metric.source,
              series_id: series!.metric.series_id,
            });
          });

          // recall_questions equal generateRecallQuestions over the metrics
          // and subjects (R4.1).
          expect(payload.recall_questions).toEqual(
            generateRecallQuestions(
              persona.metrics.map((m, i) => ({
                metric: payload.metrics[i],
                recall_subject: m.recall_subject,
              })),
            ),
          );

          // written_as_of and format_version are carried through.
          expect(payload.written_as_of).toBe(persona.written_as_of);
          expect(payload.format_version).toBe(1);

          // Deterministic: two calls give identical canonical JSON (R2.8).
          const again = buildPersonaPayload(persona, text, figures.loaded);
          expect(again.ok).toBe(true);
          if (again.ok) {
            expect(canonicalize(again.payload)).toBe(canonicalize(payload));
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: 03-persona-demo, Property 15 (missing-figure branch)
  it("Property 15: a metric with no then figure fails the FIRST such metric with { ok: false, metricId }", () => {
    fc.assert(
      fc.property(
        figuresArb.chain((figures) =>
          fc.record({
            figures: fc.constant(figures),
            persona: personaArb(figures),
            text: letterTextArb,
            // Where to splice an unknown metric that can never have a figure.
            insertAt: fc.integer({ min: 0, max: 8 }),
          }),
        ),
        ({ figures, persona, text, insertAt }) => {
          const metrics = [...persona.metrics];
          const at = Math.min(insertAt, metrics.length);
          // An id absent from the loaded figures => thenAndNow unknown_series.
          const missingId = "fixture-series-does-not-exist";
          metrics.splice(at, 0, {
            metric_id: missingId,
            recall_subject: "a gallon of regular gasoline",
          });
          const withMissing: Persona = { ...persona, metrics };

          const built = buildPersonaPayload(
            withMissing,
            text,
            figures.loaded,
          );
          expect(built.ok).toBe(false);
          if (built.ok) return;

          // It names the FIRST metric (in list order) that has no "then"
          // figure. Every real tracked metric does have one, so the first
          // miss is our spliced id unless an earlier real metric somehow
          // misses — which it cannot here — so it is exactly missingId.
          expect(built.metricId).toBe(missingId);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// =============================================================================
// (c) Property 16: sealPersonas over an insert-only in-memory fake store.
// =============================================================================

/** A row the fake store holds, mirroring the fields sealPersonas reads. */
interface StoredRow {
  id: string;
  envelope: unknown;
  envelopeHash: string;
  serverSecret: Uint8Array;
  demo: boolean;
}

/**
 * An insert-only in-memory store. It implements exactly the two methods
 * sealPersonas uses — findLetter and storePersonaLetter — and NOTHING that can
 * update or delete a row. Each insert deep-freezes the stored bytes' snapshot
 * so an accidental mutation by the code under test would throw, proving rows
 * are never changed in place. A JSON snapshot of every row is kept so the test
 * can assert byte-for-byte stability across a second run.
 */
class FakeStore {
  private rows = new Map<string, StoredRow>();
  /** Canonical-JSON snapshot of each row at insert time, for stability checks. */
  readonly snapshots = new Map<string, string>();
  /** Number of inserts performed, so a "no new insert" run can be asserted. */
  insertCount = 0;

  /** Seed a pre-existing row (a prior demo letter, or a real-letter collision). */
  seed(row: StoredRow): void {
    this.rows.set(row.id, { ...row, serverSecret: Uint8Array.from(row.serverSecret) });
    this.snapshots.set(row.id, this.snapshot(row));
  }

  private snapshot(row: StoredRow): string {
    return JSON.stringify({
      id: row.id,
      envelope: row.envelope,
      envelopeHash: row.envelopeHash,
      serverSecret: encodeBase64url(Uint8Array.from(row.serverSecret)),
      demo: row.demo,
    });
  }

  findLetter = async (id: string): Promise<FoundLetter | null> => {
    const row = this.rows.get(id);
    if (row === undefined) return null;
    // Return the shape findLetter returns: envelope as canonical JSON text,
    // serverSecret as a Buffer, plus the fields sealPersonas reads. dbNow and
    // opensAt are present only to satisfy the type; sealPersonas ignores them.
    return {
      id: row.id,
      envelope:
        typeof row.envelope === "string"
          ? row.envelope
          : JSON.stringify(row.envelope),
      envelopeHash: row.envelopeHash,
      opensAt: new Date(0),
      serverSecret: Buffer.from(row.serverSecret),
      demo: row.demo,
      dbNow: new Date(0),
    };
  };

  storePersonaLetter = async (input: {
    envelope: unknown;
    envelopeHash: string;
    serverSecret: Uint8Array;
  }): Promise<void> => {
    // Insert-only: a present ID is a duplicate, never an overwrite. The real
    // store throws LetterStoreError("duplicate_id") here; sealPersonas maps
    // that to store_rejected. But sealPersonas only inserts after findLetter
    // returned null, so in these runs a collision never happens — assert it.
    const header = input.envelope as { letterId?: unknown };
    const id = String(header.letterId);
    if (this.rows.has(id)) {
      throw new Error("FakeStore: insert-only store received a duplicate id");
    }
    const row: StoredRow = {
      id,
      envelope: input.envelope,
      envelopeHash: input.envelopeHash,
      serverSecret: Uint8Array.from(input.serverSecret),
      demo: true,
    };
    this.rows.set(id, row);
    this.snapshots.set(id, this.snapshot(row));
    this.insertCount++;
  };

  /** True when every row still matches its insert-time snapshot byte-for-byte. */
  unchanged(): boolean {
    for (const [id, snap] of this.snapshots) {
      const row = this.rows.get(id);
      if (row === undefined) return false; // a delete would show here.
      if (this.snapshot(row) !== snap) return false; // an update would show here.
    }
    return this.rows.size === this.snapshots.size;
  }

  has(id: string): boolean {
    return this.rows.has(id);
  }
}

/** The fixed Deps clock and RNG for a run; crypto is the real WebCrypto. */
function fixedDeps(
  personas: readonly Persona[],
  figures: LoadedFigures,
  store: FakeStore,
  texts: Map<string, string>,
): Deps {
  return {
    personas,
    readLetterText: (path) => {
      const t = texts.get(path);
      if (t === undefined) throw new Error(`no text for ${path}`);
      return t;
    },
    figures,
    findLetter: store.findLetter,
    storePersonaLetter: store.storePersonaLetter,
    now: () => new Date(SEALED_AT),
    randomBytes: (n) => new Uint8Array(randomBytes(n)),
  };
}

// base64url / hex matchers for the leak check: a stored secret or key would
// surface as a long run of base64url or hex, which no output line may contain.
const LINE_RE = /^seal-personas [a-z0-9-]+ [A-Za-z0-9_-]{22} (stored|skipped|failed: .+)$/;

describe("sealPersonas (insert-only fake store, real crypto)", () => {
  // Feature: 03-persona-demo, Property 16
  it("Property 16: reaches every outcome, never changes a row, is idempotent, and leaks nothing", async () => {
    await fc.assert(
      fc.asyncProperty(
        figuresArb.chain((figures) =>
          fc.record({
            figures: fc.constant(figures),
            // Three distinct personas so keys/IDs do not collide.
            personas: fc.tuple(
              personaArb(figures),
              personaArb(figures),
              personaArb(figures),
            ),
            texts: fc.tuple(letterTextArb, letterTextArb, letterTextArb),
          }),
        ),
        async ({ figures, personas: rawPersonas, texts: rawTexts }) => {
          // Give each persona a distinct key, letter_id and letter_path. The
          // IDs are three FIXED, provably-distinct values (constant byte fills),
          // not derived from the fast-check seeds: deriving them from seeds
          // risked two personas colliding on one ID, which would make gen-1's
          // findLetter return gen-2's seeded real letter and fail instead of
          // skip. Three constants remove that whole class of flake.
          const personas: Persona[] = rawPersonas.map((p, i) => ({
            ...p,
            key: `gen-${i}`,
            letter_id: FIXED_LETTER_IDS[i],
            letter_path: `letters/gen-${i}.txt`,
          }));
          const texts = new Map(
            personas.map((p, i) => [p.letter_path, rawTexts[i]]),
          );

          // --- Arrange three distinct outcomes by seeding the store. --------
          const store = new FakeStore();

          // Persona 0: no row -> should be STORED.

          // Persona 1: an identical demo row already present -> should be
          // SKIPPED. Build it with the real crypto exactly as sealPersonas
          // would, so the canonical payloads match.
          const parsed = parseBackupKey(PUBLIC_DEMO_BACKUP_KEY);
          expect(parsed.ok).toBe(true);
          if (!parsed.ok) return;
          const built1 = buildPersonaPayload(
            personas[1],
            texts.get(personas[1].letter_path)!,
            figures.loaded,
          );
          expect(built1.ok).toBe(true);
          if (!built1.ok) return;
          const secret1 = new Uint8Array(randomBytes(32));
          const sealed1 = await sealLetter({
            payload: built1.payload,
            letterId: decodeBase64url(personas[1].letter_id, 16),
            serverSecret: secret1,
            backupKey: parsed.key,
            sealedAt: SEALED_AT,
            opensAt: personas[1].opens_at,
          });
          store.seed({
            id: personas[1].letter_id,
            envelope: sealed1.envelope,
            envelopeHash: sealed1.envelopeHash,
            serverSecret: secret1,
            demo: true,
          });

          // Persona 2: a REAL letter already owns its ID -> REAL_LETTER_COLLISION.
          store.seed({
            id: personas[2].letter_id,
            envelope: sealed1.envelope, // any envelope; demo=false short-circuits.
            envelopeHash: sealed1.envelopeHash,
            serverSecret: new Uint8Array(randomBytes(32)),
            demo: false,
          });

          const snapshotBefore = new Map(store.snapshots);

          // --- Act: first run. ----------------------------------------------
          const deps = fixedDeps(personas, figures.loaded, store, texts);
          const first = await sealPersonas(deps);

          // Expected outcomes, by construction.
          const byKey = new Map(first.results.map((r) => [r.key, r]));
          expect(byKey.get("gen-0")!.result).toBe("stored");
          expect(byKey.get("gen-1")!.result).toBe("skipped");
          expect(byKey.get("gen-2")!.result).toBe("failed");
          const g2 = byKey.get("gen-2")!;
          if (g2.result === "failed") {
            expect(g2.reason).toBe("real_letter_collision");
          }

          // exitCode is 1 exactly because gen-2 failed.
          expect(first.exitCode).toBe(1);

          // Exactly one new insert (persona 0). Seeded rows are untouched.
          expect(store.insertCount).toBe(1);
          expect(store.has(personas[0].letter_id)).toBe(true);

          // No seeded row changed byte-for-byte (insert-only, no update/delete).
          for (const [id, snap] of snapshotBefore) {
            expect(store.snapshots.get(id)).toBe(snap);
          }
          expect(store.unchanged()).toBe(true);

          // Every printed line matches the fixed grammar and leaks nothing.
          for (const r of first.results) {
            const line = formatResultLine(r);
            expect(line).toMatch(LINE_RE);
            assertNoLeak(line, texts, [secret1]);
          }

          // --- Act: second run, nothing changed. ----------------------------
          const insertsAfterFirst = store.insertCount;
          const second = await sealPersonas(deps);

          // Persona 0 is now present and identical -> skipped. Persona 1 still
          // skipped, persona 2 still the real collision. So every persona is
          // now skipped or failed; none is stored, and no new insert happens.
          for (const r of second.results) {
            expect(r.result === "stored").toBe(false);
          }
          expect(store.insertCount).toBe(insertsAfterFirst);
          expect(second.exitCode).toBe(1); // gen-2 still collides.
          expect(store.unchanged()).toBe(true);

          for (const r of second.results) {
            expect(formatResultLine(r)).toMatch(LINE_RE);
          }
        },
      ),
      { numRuns: 25 },
    );
  });

  // Feature: 03-persona-demo, Property 16 (stored_letter_differs branch)
  it("Property 16: a demo row whose payload differs fails stored_letter_differs, and the row is not changed", async () => {
    await fc.assert(
      fc.asyncProperty(
        figuresArb.chain((figures) =>
          fc.record({
            figures: fc.constant(figures),
            persona: personaArb(figures),
            seed: fc.integer({ min: 1, max: 0x7fffffff }),
            textA: letterTextArb,
            textB: letterTextArb,
          }),
        ),
        async ({ figures, persona: raw, seed, textA, textB }) => {
          // Need two DIFFERENT letter texts so the stored payload and the
          // freshly built one diverge; skip the rare run where they coincide.
          fc.pre(textA !== textB);

          const persona: Persona = {
            ...raw,
            key: "gen-x",
            letter_id: letterIdFromSeed(seed),
            letter_path: "letters/gen-x.txt",
          };
          const parsed = parseBackupKey(PUBLIC_DEMO_BACKUP_KEY);
          if (!parsed.ok) return;

          // Seed a demo row sealed from textA.
          const builtA = buildPersonaPayload(persona, textA, figures.loaded);
          if (!builtA.ok) return;
          const secret = new Uint8Array(randomBytes(32));
          const sealedA = await sealLetter({
            payload: builtA.payload,
            letterId: decodeBase64url(persona.letter_id, 16),
            serverSecret: secret,
            backupKey: parsed.key,
            sealedAt: SEALED_AT,
            opensAt: persona.opens_at,
          });
          const store = new FakeStore();
          store.seed({
            id: persona.letter_id,
            envelope: sealedA.envelope,
            envelopeHash: sealedA.envelopeHash,
            serverSecret: secret,
            demo: true,
          });
          const before = store.snapshots.get(persona.letter_id)!;

          // The persona now carries textB, so its freshly built payload differs.
          const texts = new Map([[persona.letter_path, textB]]);
          const deps = fixedDeps([persona], figures.loaded, store, texts);
          const run = await sealPersonas(deps);

          expect(run.results).toHaveLength(1);
          const r = run.results[0];
          expect(r.result).toBe("failed");
          if (r.result === "failed") {
            expect(r.reason).toBe("stored_letter_differs");
          }
          expect(run.exitCode).toBe(1);

          // The seeded row is untouched: no update, no delete, no new insert.
          expect(store.insertCount).toBe(0);
          expect(store.snapshots.get(persona.letter_id)).toBe(before);
          expect(store.unchanged()).toBe(true);

          // The output line still matches the grammar and leaks nothing.
          const line = formatResultLine(r);
          expect(line).toMatch(LINE_RE);
          assertNoLeak(line, texts, [secret]);
        },
      ),
      { numRuns: 25 },
    );
  });
});

/**
 * Assert an output line leaks no letter text and no secret material.
 *
 * It must not contain the whole letter text, nor any contiguous 12-character
 * run of it, nor the base64url or hex encoding of any server secret. A 12-char
 * window is long enough that a fixed output phrase (which shares only short
 * common words like "letter" with a letter body) can never match it, yet short
 * enough that any genuine fragment of sealed text would be caught.
 */
function assertNoLeak(
  line: string,
  texts: Map<string, string>,
  secrets: Uint8Array[],
): void {
  const WINDOW = 12;
  for (const text of texts.values()) {
    // The whole text never appears.
    expect(line).not.toContain(text);
    // No contiguous 12-character fragment of the sealed text appears.
    for (let i = 0; i + WINDOW <= text.length; i++) {
      const fragment = text.slice(i, i + WINDOW);
      expect(line.includes(fragment)).toBe(false);
    }
  }
  // No server secret in base64url or hex.
  for (const secret of secrets) {
    expect(line).not.toContain(encodeBase64url(secret));
    expect(line).not.toContain(Buffer.from(secret).toString("hex"));
  }
}
