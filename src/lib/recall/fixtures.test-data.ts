/**
 * Test-only payload fixtures for the Recall_Record_V2 tests (design.md "C3",
 * requirement G3.1).
 *
 * Imported by tests only; no production module imports this file. Each payload
 * passes `payloadV1Schema`. The recall questions are the text questions `a1`…
 * (in author order) and, where a letter has figures, the number questions `q1`…
 * that the Recall_Generator writes. Every series is clearly fake (`FIXTURE`), so
 * no fixture can be mistaken for a real figure (data-integrity.md).
 */

import {
  openLetter,
  parseBackupKey,
  PUBLIC_DEMO_BACKUP_KEY,
  sealLetter,
} from "@/lib/crypto";
import type { PayloadV1 } from "@/lib/seal-format";

const SEALED_AT = "2026-10-31T12:00:00.000Z";
const OPENS_AT = "2027-02-01T00:00:00.000Z";

/**
 * A per-letter opening key and the letter ID it is bound to. Test-only: the
 * letter is sealed with the PUBLIC demo backup key, then opened, the same way
 * the record-encryption test obtains its key. The key is non-extractable.
 */
export async function freshOpeningKey(): Promise<{
  openingKey: CryptoKey;
  letterId: Uint8Array;
}> {
  const letterId = new Uint8Array(16);
  globalThis.crypto.getRandomValues(letterId);
  const serverSecret = new Uint8Array(32);
  globalThis.crypto.getRandomValues(serverSecret);

  const backup = parseBackupKey(PUBLIC_DEMO_BACKUP_KEY);
  if (!backup.ok) throw new Error("the public demo backup key must parse");

  const { envelope, envelopeHash } = await sealLetter({
    payload: PAYLOAD_NO_FIGURES_TEXT_2,
    letterId,
    serverSecret,
    backupKey: backup.key,
    sealedAt: SEALED_AT,
    opensAt: OPENS_AT,
  });

  const opened = await openLetter({
    envelope,
    envelopeHash,
    serverSecret,
    backupKey: backup.key,
  });
  if (!opened.ok) throw new Error(`openLetter failed: ${opened.error.kind}`);
  return { openingKey: opened.openingKey, letterId };
}

const METRIC = {
  id: "m1",
  display_name: "FIXTURE test metric",
  unit: "FIXTURE units",
  region: "FIXTURE region",
  source: "FIXTURE source",
  series_id: "FIXTURE-TEST-SERIES",
} as const;

const FIGURE = {
  kind: "official",
  metric_id: "m1",
  value: "1.5",
  unit: "FIXTURE units",
  region: "FIXTURE region",
  period: "2024-01",
  source: "FIXTURE source",
  series_id: "FIXTURE-TEST-SERIES",
  retrieved_at: "2026-01-01T00:00:00Z",
  source_url: "https://example.com/fixture",
} as const;

/** A text question `a<n>`, written as the author would seal it. */
function textQuestion(n: number) {
  return {
    id: `a${n}`,
    answer_type: "text" as const,
    text: `Author question ${n}`,
  };
}

/** A number question `q<n>` on the fixture metric. */
function numberQuestion(n: number) {
  return {
    id: `q${n}`,
    answer_type: "number" as const,
    text: `Number question ${n}`,
    metric_id: METRIC.id,
  };
}

/**
 * A v1 payload with `textCount` text questions `a1`… and one number question
 * `q1` on the fixture metric, with its figure.
 */
function payloadWithText(textCount: number): PayloadV1 {
  const texts = Array.from({ length: textCount }, (_, i) =>
    textQuestion(i + 1),
  );
  return {
    format_version: 1,
    letter_text: "A fixture letter.",
    metrics: [{ ...METRIC }],
    figures: [{ ...FIGURE }],
    recall_questions: [...texts, numberQuestion(1)],
  };
}

/** A v1 payload with 0 text questions: a figure question `q1` only. */
export const PAYLOAD_TEXT_0: PayloadV1 = payloadWithText(0);

/** A v1 payload with 1 text question `a1`, then `q1`. */
export const PAYLOAD_TEXT_1: PayloadV1 = payloadWithText(1);

/** A v1 payload with 2 text questions `a1`, `a2`, then `q1`. */
export const PAYLOAD_TEXT_2: PayloadV1 = payloadWithText(2);

/** A v1 payload with 3 text questions `a1` to `a3`, then `q1`. */
export const PAYLOAD_TEXT_3: PayloadV1 = payloadWithText(3);

/**
 * A v1 payload with 4 text questions `a1` to `a4`, then `q1`. One more than
 * the cap, so `enterRecall` must reject it (C3.9).
 */
export const PAYLOAD_TEXT_4: PayloadV1 = payloadWithText(4);

/**
 * A v1 payload with no figures, no metrics and no number questions, and 2 text
 * questions `a1` and `a2`. A letter like this has no figures stage (C8.9).
 */
export const PAYLOAD_NO_FIGURES_TEXT_2: PayloadV1 = {
  format_version: 1,
  letter_text: "A fixture letter with no figures.",
  metrics: [],
  figures: [],
  recall_questions: [textQuestion(1), textQuestion(2)],
};
