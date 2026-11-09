/**
 * Record_Parser (design.md "C3. Recall_Record_V2", requirement C3.7).
 *
 * Reads the `version` of a stored Recall_Record and parses it with the matching
 * schema. A version 1 record gets exactly the result of
 * {@link recallRecordV1Schema}, so the existing v1 behaviour is unchanged. A
 * version 2 record gets the result of {@link recallRecordV2Schema}.
 *
 * No production code calls this on a stored record in spec 10 (the Known
 * limitations in requirements.md). It is exported for the round-trip and
 * version 1 tests, and for the record reader in a later spec.
 *
 * This module is pure and imports nothing from src/lib/crypto or src/lib/db.
 */

import { recallRecordV1Schema, type RecallRecordV1 } from "./record";
import { recallRecordV2Schema, type RecallRecordV2 } from "./record-v2";

/** The result of {@link parseRecallRecord}. */
export type ParseRecallRecordResult =
  { ok: true; record: RecallRecordV1 | RecallRecordV2 } | { ok: false };

/**
 * Parse a stored Recall_Record of version 1 or 2.
 *
 * Returns `{ ok: false }` for any other `version`, for a value that is not an
 * object, and for a record that fails its version's schema. Nothing is returned
 * as a partial record.
 */
export function parseRecallRecord(value: unknown): ParseRecallRecordResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false };
  }

  const version = (value as { version?: unknown }).version;

  if (version === 1) {
    const parsed = recallRecordV1Schema.safeParse(value);
    return parsed.success ? { ok: true, record: parsed.data } : { ok: false };
  }

  if (version === 2) {
    const parsed = recallRecordV2Schema.safeParse(value);
    return parsed.success ? { ok: true, record: parsed.data } : { ok: false };
  }

  return { ok: false };
}
