import { beforeAll, describe, expect, it } from "vitest";
import { encryptOpeningRecord, decryptOpeningRecord } from "@/lib/crypto";
import {
  canonicalize,
  decodeBase64url,
  encodeBase64url,
} from "@/lib/seal-format";
import { recallRecordV2Schema, type RecallRecordV2 } from "./record-v2";
import { freshOpeningKey } from "./fixtures.test-data";

// Feature: 10-own-questions, requirement C3.6 (design.md "The Max_Record size").
//
// The Max_Record has 3 Text_Answers of 1,000 code points and 17 number answers of
// 40 digits, every number answer carrying the Sample_Flag. Every question ID is
// 200 UTF-16 units and every code point is one that JSON.stringify escapes to
// six bytes (U+0001 in text, lone surrogates in IDs). That is the longest
// canonical encoding each character can get.

const CIPHERTEXT_LIMIT_BYTES = 65_536;
const BODY_LIMIT_CHARACTERS = 100_000;

/** A question ID of 200 UTF-16 units that is a lone surrogate, unique per index. */
function lonelyId(index: number): string {
  return String.fromCharCode(0xd800 + index).repeat(200);
}

/** The Max_Record: 3 Text_Answers, then 17 number answers with the Sample_Flag. */
function maxRecord(): RecallRecordV2 {
  const texts = Array.from({ length: 3 }, (_, i) => ({
    question_id: lonelyId(i),
    kind: "text" as const,
    value: "\u0001".repeat(1000),
  }));
  const numbers = Array.from({ length: 17 }, (_, i) => ({
    question_id: lonelyId(3 + i),
    kind: "number" as const,
    value: "1".repeat(40),
    sample: true as const,
  }));
  return { version: 2, answers: [...texts, ...numbers] };
}

describe("Max_Record size (C3.6)", () => {
  let openingKey: CryptoKey;
  let letterId: Uint8Array;

  beforeAll(async () => {
    ({ openingKey, letterId } = await freshOpeningKey());
  });

  it("the Max_Record is a valid Recall_Record_V2", () => {
    expect(recallRecordV2Schema.safeParse(maxRecord()).success).toBe(true);
  });

  it("encrypts within 65,536 ciphertext bytes and a 100,000-character request body, and prints the sizes", async () => {
    const record = maxRecord();
    const plaintextBytes = new TextEncoder().encode(
      canonicalize(record),
    ).length;

    const box = await encryptOpeningRecord(openingKey, letterId, record);
    const ciphertextBytes = decodeBase64url(box.ciphertext).length;

    // The request body the POST /api/openings route receives: letter ID,
    // ciphertext and nonce, as JSON.
    const body = JSON.stringify({
      letterId: encodeBase64url(letterId),
      ciphertext: box.ciphertext,
      nonce: box.nonce,
    });
    const bodyCharacters = body.length;

    console.log(
      [
        "Max_Record sizes (C3.6):",
        `  plaintext (canonical JSON): ${plaintextBytes} bytes`,
        `  ciphertext (AES-GCM, with tag): ${ciphertextBytes} bytes (limit ${CIPHERTEXT_LIMIT_BYTES})`,
        `  request body: ${bodyCharacters} characters (limit ${BODY_LIMIT_CHARACTERS})`,
      ].join("\n"),
    );

    expect(ciphertextBytes).toBeLessThanOrEqual(CIPHERTEXT_LIMIT_BYTES);
    expect(bodyCharacters).toBeLessThanOrEqual(BODY_LIMIT_CHARACTERS);

    // The record must still decrypt to itself at the size limit.
    const decrypted = await decryptOpeningRecord(openingKey, letterId, box);
    expect(decrypted).toEqual(record);
  });
});
