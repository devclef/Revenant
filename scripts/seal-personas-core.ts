// Sealing_Script core (design.md "Sealing_Script", R4.1-R4.14, R2.8).
//
// All the logic of the persona-sealing script lives here, with every I/O
// dependency injected through `Deps`, so it can be driven from tests without a
// database, a clock or randomness. The bundle entry (scripts/seal-personas.ts)
// wires the real dependencies; this module imports no database client, reads no
// `process.env`, and never touches `scripts/*` beyond its own types.
//
// `buildPersonaPayload` is pure and deterministic: given the same persona,
// letter text and loaded figures it always builds a byte-identical canonical
// payload. That determinism is what lets `sealPersonas` (added in the next
// task) compare a freshly built payload against a stored one for idempotency.
//
// Import boundary: this module imports `@/lib/crypto` together with
// `@/lib/letter-store` types, which the crypto.md R14.6 exemption allows for
// the sealing script. Nothing under `src/` imports `scripts/`, so the web app
// never pulls crypto in through here; the frontend boundary test checks that.

import type { Persona } from "@/lib/personas";
import type { LetterRow } from "@/lib/letter-store/queries";
import { generateRecallQuestions } from "@/lib/recall";
import {
  canonicalize,
  decodeBase64url,
  payloadV1Schema,
  type PayloadV1,
  type MetricDefinitionV1,
} from "@/lib/seal-format";
import { thenAndNow } from "@/lib/figures/then-now";
import type { LoadedFigures } from "@/lib/figures";
import {
  openLetter,
  parseBackupKey,
  sealLetter,
  PUBLIC_DEMO_BACKUP_KEY,
} from "@/lib/crypto";
import type { BackupKeyBytes } from "@/lib/crypto";
import { LetterStoreError } from "@/lib/letter-store/store";

/**
 * The outcome of sealing one persona (R4.11). A `stored` result means a new
 * `demo_letters` row was inserted; `skipped` means an identical row already
 * existed; `failed` carries the fixed {@link FailureReason} and never any
 * library error text or secret.
 */
export type PersonaResult =
  | { key: string; letterId: string; result: "stored" | "skipped" }
  | {
      key: string;
      letterId: string;
      result: "failed";
      reason: FailureReason;
      /**
       * The metric ID without a "then" figure. Set only when `reason` is
       * `missing_then_figure`, so {@link formatResultLine} can name it. It is a
       * catalogue identifier, never a figure value or secret.
       */
      metricId?: string;
      /**
       * The persona's `written_as_of` date. Set only when `reason` is
       * `missing_then_figure`, so the line can report the date the "then"
       * figure was looked up for. It is a public calendar date from the
       * committed list, never a secret.
       */
      writtenAsOf?: string;
    };

/**
 * Why sealing one persona failed. Each value is a fixed reason that maps to a
 * fixed output line; no error object or stored value is ever surfaced (R4.11).
 *
 * - `missing_then_figure`  — no figure at or before `written_as_of` for a
 *   tracked metric (R4.3). The output line names the metric ID.
 * - `stored_letter_differs` — a row exists for this ID but its sealed payload
 *   does not canonically equal the freshly built one, or the stored letter
 *   would not open (R4.8).
 * - `real_letter_collision` — the letter ID is already used by a real letter
 *   in `letters` (R4.9).
 * - `store_rejected`        — `storePersonaLetter` threw, e.g. a racing insert.
 * - `unexpected_error`      — anything else; the original error is dropped and
 *   never printed.
 */
export type FailureReason =
  | "missing_then_figure"
  | "stored_letter_differs"
  | "real_letter_collision"
  | "store_rejected"
  | "unexpected_error";

/**
 * A sealed-letter row as the sealing script reads it. This is the exact return
 * shape of `findLetter` in `@/lib/letter-store`, aliased here so `Deps` can be
 * stated without a second declaration.
 */
export type FoundLetter = LetterRow;

/**
 * Every I/O the sealing logic needs, injected so the core stays pure and
 * testable. The entry supplies the real implementations; tests supply fakes.
 */
export type Deps = {
  /** The personas to seal, in list order. */
  personas: readonly Persona[];
  /** Read one persona's letter text by its `letter_path`. */
  readLetterText(path: string): string;
  /** The loaded demo figures the "then" figure is taken from. */
  figures: LoadedFigures;
  /** Read an existing letter row by ID, or `null` when none exists. */
  findLetter(id: string): Promise<FoundLetter | null>;
  /** Insert one sealed persona letter. Throws on a rejected write. */
  storePersonaLetter(input: {
    envelope: unknown;
    envelopeHash: string;
    serverSecret: Uint8Array;
  }): Promise<void>;
  /** The current time, used only as `sealedAt`. */
  now(): Date;
  /** Fill `n` cryptographically random bytes (crypto.getRandomValues). */
  randomBytes(n: number): Uint8Array;
};

/**
 * Pick exactly the six {@link MetricDefinitionV1} keys from a series' metric,
 * so catalogue-only fields (for example `period_type`) never enter the payload
 * (R4.4). Returns a fresh object; the input is not mutated (R12.6-style purity).
 */
function pickMetricDefinition(metric: MetricDefinitionV1): MetricDefinitionV1 {
  return {
    id: metric.id,
    display_name: metric.display_name,
    unit: metric.unit,
    region: metric.region,
    source: metric.source,
    series_id: metric.series_id,
  };
}

/**
 * Build the sealed payload for one persona (R4.1, R4.2, R4.4, R2.8).
 *
 * For each tracked metric, in list order, it takes the "then" figure from
 * `thenAndNow(metricId, written_as_of, figures).then`. If that figure is
 * missing it returns `{ ok: false, metricId }` for the FIRST such metric. Each
 * found figure is copied with a plain spread, changing no field and keeping the
 * value string verbatim. The metric definition is the six-key pick from the
 * series' metric, and the recall questions come from `generateRecallQuestions`
 * over the metrics and their subjects. The assembled payload is validated with
 * `payloadV1Schema.parse`, which throws on any shape error.
 *
 * The function reads no clock and no randomness, so the same inputs always
 * build a byte-identical canonical payload. That determinism is what makes the
 * idempotency compare in `sealPersonas` meaningful.
 */
export function buildPersonaPayload(
  p: Persona,
  text: string,
  figures: LoadedFigures,
): { ok: true; payload: PayloadV1 } | { ok: false; metricId: string } {
  const metrics: MetricDefinitionV1[] = [];
  const payloadFigures: PayloadV1["figures"] = [];

  for (const { metric_id } of p.metrics) {
    const then = thenAndNow(metric_id, p.written_as_of, figures).then;
    if (!then.found) {
      // The first metric without a "then" figure fails the whole build (R4.3).
      return { ok: false, metricId: metric_id };
    }

    // Copy the figure with a plain spread: no field changed or added, and the
    // value string stays exactly as published (data-integrity.md).
    payloadFigures.push({ ...then.figure });

    const series = figures.series.get(metric_id);
    if (series === undefined) {
      // thenAndNow found a figure, so the series exists; this is unreachable in
      // practice. Fail the same metric rather than build an invalid payload.
      return { ok: false, metricId: metric_id };
    }
    metrics.push(pickMetricDefinition(series.metric));
  }

  const recall_questions = generateRecallQuestions(
    p.metrics.map((m, i) => ({
      metric: metrics[i],
      recall_subject: m.recall_subject,
    })),
  );

  const payload = payloadV1Schema.parse({
    format_version: 1,
    letter_text: text,
    written_as_of: p.written_as_of,
    metrics,
    figures: payloadFigures,
    recall_questions,
  });

  return { ok: true, payload };
}

/** The number of random bytes in a per-letter time-lock server secret. */
const SERVER_SECRET_BYTES = 32;

/**
 * Coerce a stored `serverSecret` (a Node `Buffer` from `findLetter`, or any
 * other `Uint8Array`-like) to a plain `Uint8Array` the crypto library accepts.
 * A `Buffer` already IS a `Uint8Array`, so this copies its exact bytes into a
 * fresh view without reinterpreting them.
 */
function toUint8Array(value: Uint8Array): Uint8Array {
  return Uint8Array.from(value);
}

/**
 * Seal every persona in `deps.personas`, in list order, each isolated in its
 * own try/catch so one failure never stops the rest (R4.14).
 *
 * The published demo backup key is parsed once up front. If it does not parse,
 * every persona fails with `unexpected_error` and nothing is stored; spec 02's
 * test guarantees it parses, so this is a defensive path only.
 *
 * For each persona (R4.5–R4.10):
 *
 *   1. `buildPersonaPayload`. `ok: false` → `failed: missing_then_figure`; the
 *      result names the metric ID so the entry line can report it.
 *   2. `findLetter(letter_id)`:
 *      - a row with `demo === false` is a real letter sharing the ID →
 *        `failed: real_letter_collision` (R4.9).
 *      - a row with `demo === true` is opened with the demo key and its stored
 *        server secret. If it will not open, or its canonical payload is not
 *        byte-identical to the freshly built one, → `failed: stored_letter_differs`
 *        (R4.8). An exact match → `skipped` (R4.7): the row is left untouched.
 *      - no row → a fresh 32-byte server secret, `sealLetter`, then
 *        `storePersonaLetter` → `stored` (R4.5, R4.6). A `LetterStoreError`
 *        (for example a racing insert) → `failed: store_rejected`.
 *   3. Any other throw → `failed: unexpected_error`; the error object is
 *      dropped and never stored or printed (R4.11), because a driver error can
 *      echo a stored value.
 *
 * Only `findLetter` reads and only `storePersonaLetter` inserts; the logic
 * issues no UPDATE, DELETE or TRUNCATE, and the table triggers would reject
 * them anyway (R5.1). `exitCode` is 1 when any persona failed, else 0 (R4.14).
 */
export async function sealPersonas(
  deps: Deps,
): Promise<{ results: PersonaResult[]; exitCode: 0 | 1 }> {
  const results: PersonaResult[] = [];

  // Parse the published demo key once. A failure here poisons every persona,
  // but it cannot happen while spec 02's PUBLIC_DEMO_BACKUP_KEY test holds.
  let backupKey: BackupKeyBytes | null = null;
  const parsed = parseBackupKey(PUBLIC_DEMO_BACKUP_KEY);
  if (parsed.ok) {
    backupKey = parsed.key;
  }

  for (const persona of deps.personas) {
    results.push(await sealOne(persona, backupKey, deps));
  }

  const exitCode: 0 | 1 = results.some((r) => r.result === "failed") ? 1 : 0;
  return { results, exitCode };
}

/**
 * Seal one persona, returning its {@link PersonaResult}. Every throw is caught
 * here and mapped to a fixed {@link FailureReason}; no error object, secret or
 * payload value ever escapes (R4.11, R4.14).
 */
async function sealOne(
  persona: Persona,
  backupKey: BackupKeyBytes | null,
  deps: Deps,
): Promise<PersonaResult> {
  const { key, letter_id: letterId } = persona;

  try {
    // The demo key did not parse (defensive): the persona cannot be sealed.
    if (backupKey === null) {
      return { key, letterId, result: "failed", reason: "unexpected_error" };
    }

    // Step 1: build the payload. A missing "then" figure fails this persona.
    const text = deps.readLetterText(persona.letter_path);
    const built = buildPersonaPayload(persona, text, deps.figures);
    if (!built.ok) {
      return {
        key,
        letterId,
        result: "failed",
        reason: "missing_then_figure",
        // The metric ID and lookup date are carried through for the entry line
        // (R4.3). Both are public catalogue/list values, never secrets.
        metricId: built.metricId,
        writtenAsOf: persona.written_as_of,
      };
    }

    // Step 2: does a row already exist for this ID?
    const existing = await deps.findLetter(letterId);

    if (existing !== null) {
      // A real letter sharing this ID is a hard collision (R4.9).
      if (!existing.demo) {
        return { key, letterId, result: "failed", reason: "real_letter_collision" };
      }

      // A demo row: it must open AND canonically equal the freshly built
      // payload, or this persona needs a new ID (R4.7, R4.8).
      const envelope =
        typeof existing.envelope === "string"
          ? JSON.parse(existing.envelope)
          : existing.envelope;
      const opened = await openLetter({
        envelope,
        envelopeHash: existing.envelopeHash,
        serverSecret: toUint8Array(existing.serverSecret),
        backupKey,
      });
      if (!opened.ok) {
        return { key, letterId, result: "failed", reason: "stored_letter_differs" };
      }
      if (canonicalize(opened.payload) === canonicalize(built.payload)) {
        return { key, letterId, result: "skipped" };
      }
      return { key, letterId, result: "failed", reason: "stored_letter_differs" };
    }

    // Step 3: no row — seal and store. A fresh 32-byte time-lock secret.
    const serverSecret = deps.randomBytes(SERVER_SECRET_BYTES);
    const sealed = await sealLetter({
      payload: built.payload,
      letterId: decodeBase64url(letterId, 16),
      serverSecret,
      backupKey,
      sealedAt: deps.now().toISOString(),
      opensAt: persona.opens_at,
    });
    try {
      await deps.storePersonaLetter({
        envelope: sealed.envelope,
        envelopeHash: sealed.envelopeHash,
        serverSecret,
      });
    } catch (error) {
      if (error instanceof LetterStoreError) {
        return { key, letterId, result: "failed", reason: "store_rejected" };
      }
      throw error;
    }
    return { key, letterId, result: "stored" };
  } catch {
    // Any other throw: drop the error entirely (R4.11) and report a fixed
    // reason. Never store it, never print it.
    return { key, letterId, result: "failed", reason: "unexpected_error" };
  }
}

/**
 * The exact output line for one {@link PersonaResult} (R4.11). The lines are
 * fixed strings; no library error message, secret, ciphertext or letter text is
 * ever included. The `missing_then_figure` line names the metric ID carried on
 * the result; every other failure uses a constant sentence.
 */
export function formatResultLine(r: PersonaResult): string {
  const prefix = `seal-personas ${r.key} ${r.letterId}`;
  if (r.result !== "failed") {
    return `${prefix} ${r.result}`;
  }
  switch (r.reason) {
    case "missing_then_figure":
      return `${prefix} failed: no then figure for ${r.metricId ?? ""} at ${
        r.writtenAsOf ?? ""
      }`;
    case "stored_letter_differs":
      return `${prefix} failed: the stored letter can't be reused; give this persona a new letter ID`;
    case "real_letter_collision":
      return `${prefix} failed: letter ID collides with a real letter`;
    case "store_rejected":
      return `${prefix} failed: the letter could not be stored`;
    case "unexpected_error":
      return `${prefix} failed: unexpected error`;
    default: {
      // Exhaustiveness guard: a new FailureReason must add a line above.
      const _never: never = r.reason;
      return _never;
    }
  }
}
