import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { openLetter } from "./open";
import { generateBackupKey, parseBackupKey } from "./backup-key";
import { PUBLIC_DEMO_BACKUP_KEY } from "./demo-key";
import {
  envelopeHash as computeEnvelopeHash,
  parseEnvelope,
  sealedAnswerOf,
  type EnvelopeV2,
  type PayloadV2,
} from "../seal-format";

// Known-answer test for the version 2 golden fixture
// (src/lib/seal-format/__fixtures__/golden-v2-envelope.json). The fixture is a
// real sealed envelope, produced once with the public demo backup key and a
// fixed server secret. Opening it must reproduce the payload below exactly.
// The version 1 golden fixture is not touched by this file.

const here = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(
  here,
  "..",
  "seal-format",
  "__fixtures__",
  "golden-v2-envelope.json",
);

interface GoldenV2 {
  envelope: EnvelopeV2;
  envelopeHash: string;
}

function readGoldenV2(): GoldenV2 {
  return JSON.parse(readFileSync(fixturePath, "utf8")) as GoldenV2;
}

// The fixed server secret the fixture was sealed with: 32 bytes, (7i + 3) mod 256.
function goldenServerSecret(): Uint8Array {
  return Uint8Array.from({ length: 32 }, (_, i) => (i * 7 + 3) & 0xff);
}

// The payload the fixture was sealed from, written out in full.
const GOLDEN_PAYLOAD: PayloadV2 = {
  format_version: 2,
  letter_text:
    "Dear future me, the autumn was quiet. I was still unsure about the new job.",
  written_as_of: "2026-10-31",
  metrics: [],
  figures: [],
  recall_questions: [
    {
      id: "q1",
      answer_type: "text",
      text: "What worries me most right now?",
      sealed_answer: "Whether the new job will suit me.",
    },
    {
      id: "q2",
      answer_type: "text",
      text: "What am I looking forward to?",
      sealed_answer: "The first snow and a long walk home.",
    },
  ],
};

describe("version 2 golden fixture", () => {
  it("is a schema-valid version 2 envelope whose stored hash matches its content", async () => {
    const golden = readGoldenV2();
    const parsed = parseEnvelope(golden.envelope);
    expect(parsed.ok).toBe(true);
    expect(golden.envelope.formatVersion).toBe(2);
    expect(await computeEnvelopeHash(golden.envelope)).toBe(golden.envelopeHash);
  });

  it("opens from the fixed demo key and server secret to the sealed payload", async () => {
    const golden = readGoldenV2();
    const parsedKey = parseBackupKey(PUBLIC_DEMO_BACKUP_KEY);
    if (!parsedKey.ok) throw new Error("demo key does not parse");

    const result = await openLetter({
      envelope: golden.envelope,
      envelopeHash: golden.envelopeHash,
      serverSecret: goldenServerSecret(),
      backupKey: parsedKey.key,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload).toEqual(GOLDEN_PAYLOAD);
    expect(result.payload.format_version).toBe(2);
  });

  it("returns each sealed answer through sealedAnswerOf", async () => {
    const golden = readGoldenV2();
    const parsedKey = parseBackupKey(PUBLIC_DEMO_BACKUP_KEY);
    if (!parsedKey.ok) throw new Error("demo key does not parse");

    const result = await openLetter({
      envelope: golden.envelope,
      envelopeHash: golden.envelopeHash,
      serverSecret: goldenServerSecret(),
      backupKey: parsedKey.key,
    });
    expect(result.ok).toBe(true);
    if (!result.ok || result.payload.format_version !== 2) return;
    const answers = result.payload.recall_questions.map(sealedAnswerOf);
    expect(answers).toEqual([
      "Whether the new job will suit me.",
      "The first snow and a long walk home.",
    ]);
  });

  it("a different backup key cannot open the fixture -> wrong_key with no payload", async () => {
    const golden = readGoldenV2();
    const result = await openLetter({
      envelope: golden.envelope,
      envelopeHash: golden.envelopeHash,
      serverSecret: goldenServerSecret(),
      backupKey: generateBackupKey(),
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("wrong_key");
    expect(result).not.toHaveProperty("payload");
  });

  it("a wrong server secret cannot open the fixture -> wrong_key with no payload", async () => {
    const golden = readGoldenV2();
    const parsedKey = parseBackupKey(PUBLIC_DEMO_BACKUP_KEY);
    if (!parsedKey.ok) throw new Error("demo key does not parse");
    const wrongSecret = goldenServerSecret();
    wrongSecret[0] ^= 0x01;

    const result = await openLetter({
      envelope: golden.envelope,
      envelopeHash: golden.envelopeHash,
      serverSecret: wrongSecret,
      backupKey: parsedKey.key,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.kind).toBe("wrong_key");
    expect(result).not.toHaveProperty("payload");
  });
});
