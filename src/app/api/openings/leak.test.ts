// R8.6 secret-leak tests for POST /api/openings.
//
// R8.6 (tech.md / crypto.md, data-integrity): the server stores only
// ciphertext and the per-letter time-lock `serverSecret`; it never decrypts,
// never logs request- or row-derived data, and an unexpected failure becomes a
// fixed, value-free 500 with the thrown error DROPPED (not logged, not chained
// into the response). This file proves nothing secret ever escapes — through a
// response body or through any `console.*` channel — on either a validation
// failure or a database failure whose own error message carries the secret.
//
// Method: pick a KNOWN `serverSecret`, a KNOWN envelope ciphertext and a KNOWN
// answer ciphertext. Exercise:
//   (a) one validation failure (400): the answer ciphertext is submitted as the
//       request's `ciphertext` field so, if the route ever echoed a submitted
//       value, the known answer ciphertext would appear in the 400 body.
//   (b) one database failure (500): `findLetter` throws an Error whose message
//       literally contains the serverSecret, the envelope ciphertext and the
//       answer ciphertext — the worst case for a route that chained or logged
//       the error. The route must surface the fixed 500 with the error dropped.
// In BOTH cases we spy on every `console.*` method and assert that neither the
// captured console output nor the response body contains any known secret in
// base64url, hex or utf-8 form.
//
// `findLetter`/`insertOpening` are mocked; no database is touched.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  LetterRow,
  InsertOpeningArgs,
  InsertOpeningResult,
} from "@/lib/letter-store/queries";
import { encodeBase64url } from "@/lib/seal-format";

const findLetterSpy = vi.fn<(id: string) => Promise<LetterRow | null>>();
const insertOpeningSpy =
  vi.fn<(args: InsertOpeningArgs) => Promise<InsertOpeningResult>>();

vi.mock("@/lib/letter-store/queries", () => ({
  findLetter: (id: string) => findLetterSpy(id),
  insertOpening: (args: InsertOpeningArgs) => insertOpeningSpy(args),
}));

import { POST } from "./route";

// ── Known secrets ────────────────────────────────────────────────────────────
// Raw bytes, then their base64url and hex renderings. The route must never emit
// any of these representations, nor the utf-8 text of the base64url/hex strings.
const SERVER_SECRET_BYTES = new Uint8Array(32).fill(0xa5);
const ENVELOPE_CIPHERTEXT_BYTES = Uint8Array.from(
  { length: 48 },
  (_, i) => (i * 7 + 3) & 0xff,
);
const ANSWER_CIPHERTEXT_BYTES = Uint8Array.from(
  { length: 40 },
  (_, i) => (i * 11 + 1) & 0xff,
);

const SERVER_SECRET_B64 = encodeBase64url(SERVER_SECRET_BYTES);
const ENVELOPE_CIPHERTEXT_B64 = encodeBase64url(ENVELOPE_CIPHERTEXT_BYTES);
const ANSWER_CIPHERTEXT_B64 = encodeBase64url(ANSWER_CIPHERTEXT_BYTES);

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

// Every forbidden needle: each secret as base64url, as lowercase hex, and the
// base64url strings themselves treated as utf-8. A match of any means a leak.
const SECRET_NEEDLES: ReadonlyArray<{ label: string; value: string }> = [
  { label: "serverSecret base64url", value: SERVER_SECRET_B64 },
  { label: "serverSecret hex", value: toHex(SERVER_SECRET_BYTES) },
  { label: "envelope ciphertext base64url", value: ENVELOPE_CIPHERTEXT_B64 },
  { label: "envelope ciphertext hex", value: toHex(ENVELOPE_CIPHERTEXT_BYTES) },
  { label: "answer ciphertext base64url", value: ANSWER_CIPHERTEXT_B64 },
  { label: "answer ciphertext hex", value: toHex(ANSWER_CIPHERTEXT_BYTES) },
];

// A canonical 22-char letter ID (isLetterId === true) and a valid 12-byte
// nonce, so only the pieces we are testing drive the outcome.
const VALID_ID = "AAECAwQFBgcICQoLDA0ODw";
const NONCE = encodeBase64url(new Uint8Array(12).fill(9));

function postJson(body: unknown): Request {
  return new Request("http://x/api/openings", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function openableRow(): LetterRow {
  return {
    id: VALID_ID,
    envelope: JSON.stringify({ formatVersion: 1, ciphertext: ENVELOPE_CIPHERTEXT_B64 }),
    envelopeHash: "a".repeat(64),
    opensAt: new Date("2024-11-05T00:00:00.000Z"),
    serverSecret: Buffer.from(SERVER_SECRET_BYTES),
    demo: false,
    dbNow: new Date("2026-11-15T09:30:00.000Z"),
  };
}

// ── console capture ──────────────────────────────────────────────────────────
// Spy on every console method so a leak through ANY channel is caught, not just
// console.log. Each call's arguments are stringified and concatenated.
type ConsoleMethod =
  | "log"
  | "info"
  | "warn"
  | "error"
  | "debug"
  | "trace"
  | "dir";

const CONSOLE_METHODS: ConsoleMethod[] = [
  "log",
  "info",
  "warn",
  "error",
  "debug",
  "trace",
  "dir",
];

let captured: string[];
const spies: ReturnType<typeof vi.spyOn>[] = [];

function stringifyArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack ?? ""}`;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

beforeEach(() => {
  findLetterSpy.mockReset();
  insertOpeningSpy.mockReset();
  captured = [];
  for (const method of CONSOLE_METHODS) {
    const spy = vi
      .spyOn(console, method)
      .mockImplementation((...args: unknown[]) => {
        captured.push(args.map(stringifyArg).join(" "));
      });
    spies.push(spy);
  }
});

afterEach(() => {
  for (const spy of spies) spy.mockRestore();
  spies.length = 0;
});

/** Assert no forbidden secret appears in the given text. */
function expectNoSecret(text: string, where: string): void {
  for (const needle of SECRET_NEEDLES) {
    expect(
      text.includes(needle.value),
      `${where} leaked the ${needle.label}`,
    ).toBe(false);
  }
}

describe("R8.6 — POST /api/openings never leaks secrets (body or console)", () => {
  it("validation failure (400): no secret in the body or in any console channel", async () => {
    // The answer ciphertext is submitted as a value, but the nonce is invalid,
    // so the body fails validation with a 400. If the route ever echoed a
    // submitted value, the known answer ciphertext would appear in the body.
    const res = await POST(
      postJson({
        letterId: VALID_ID,
        ciphertext: ANSWER_CIPHERTEXT_B64,
        nonce: "!!!!", // invalid base64url -> 400 field=nonce
      }),
    );

    expect(res.status).toBe(400);
    const body = await res.text();
    expect(JSON.parse(body)).toEqual({ error: "invalid_body", field: "nonce" });

    expectNoSecret(body, "the 400 response body");
    expectNoSecret(captured.join("\n"), "console output during the 400");
    // Nothing should have been logged at all on a validation failure.
    expect(captured).toEqual([]);

    // The letter was never looked up for a malformed body.
    expect(findLetterSpy).not.toHaveBeenCalled();
  });

  it("database failure (500): the thrown error carries every secret, yet none leaks", async () => {
    // Worst case: the driver error message literally contains the serverSecret,
    // the envelope ciphertext and the answer ciphertext. A route that chained
    // or logged the error would leak all three. It must drop the error and
    // surface the fixed 500 instead.
    const leakyMessage =
      `DB failure: secret=${SERVER_SECRET_B64} ` +
      `envelope=${ENVELOPE_CIPHERTEXT_B64} answer=${ANSWER_CIPHERTEXT_B64}`;
    findLetterSpy.mockRejectedValueOnce(new Error(leakyMessage));

    const res = await POST(
      postJson({
        letterId: VALID_ID,
        ciphertext: ANSWER_CIPHERTEXT_B64,
        nonce: NONCE,
      }),
    );

    // The DB failure surfaces as the fixed 500 with the error DROPPED — not
    // chained into the response body.
    expect(res.status).toBe(500);
    const body = await res.text();
    expect(JSON.parse(body)).toEqual({ error: "internal" });
    expect(res.headers.get("Cache-Control")).toBe("no-store");

    expectNoSecret(body, "the 500 response body");
    expectNoSecret(captured.join("\n"), "console output during the 500");
    // The error must not be logged at all (R8.6): no console channel fired.
    expect(captured).toEqual([]);
  });

  it("insertOpening failure (500): a leaky insert error is dropped, not surfaced", async () => {
    // Same guarantee on the write path: the insert throws an error whose
    // message carries the secrets, and the route still returns a clean 500.
    findLetterSpy.mockResolvedValueOnce(openableRow());
    const leakyMessage =
      `insert failed: ${SERVER_SECRET_B64} / ${ENVELOPE_CIPHERTEXT_B64} / ` +
      ANSWER_CIPHERTEXT_B64;
    insertOpeningSpy.mockRejectedValueOnce(new Error(leakyMessage));

    const res = await POST(
      postJson({
        letterId: VALID_ID,
        ciphertext: ANSWER_CIPHERTEXT_B64,
        nonce: NONCE,
      }),
    );

    expect(res.status).toBe(500);
    const body = await res.text();
    expect(JSON.parse(body)).toEqual({ error: "internal" });

    expectNoSecret(body, "the insert-failure 500 body");
    expectNoSecret(captured.join("\n"), "console output during the insert 500");
    expect(captured).toEqual([]);
  });
});
