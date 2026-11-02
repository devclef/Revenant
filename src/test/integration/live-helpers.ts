// Shared helpers for the live lock-and-unlock integration tests.
//
// The helpers call the route handlers directly with `Request` objects, so the
// tests exercise the same code the app serves without starting an HTTP server.
// `describeLiveDb` wraps `describeDb` with a scratch database per block, the
// same setup and teardown the live-letters suite uses: the block migrates a
// fresh database, points `DATABASE_URL` at it, stubs `RP_ID`, and drops the
// database when the block ends. Nothing here holds real figures or secrets: the
// time-lock secret and the envelope bytes come from the routes themselves, and
// the demo ciphertext is a fixed placeholder that the server never decrypts.
//
// This module is test-only and server-side. It must not be imported by browser
// code, and `@/lib/crypto` is never imported here.

import { randomBytes } from "node:crypto";

import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, vi } from "vitest";

import { getSql } from "@/lib/db/client";
import { LOCK_DURATION_MS, envelopeHash } from "@/lib/seal-format";
import { GET as letterRoute } from "@/app/api/letters/[id]/route";
import { GET as secretRoute } from "@/app/api/letters/[id]/secret/route";
import { POST as prepareRoute } from "@/app/api/letters/demo/prepare/route";
import { POST as sealRoute } from "@/app/api/letters/demo/seal/route";
import { POST as openingsRoute } from "@/app/api/openings/route";

import { describeDb } from "./setup";

/** The relying-party ID the live flow runs under. Fixed for the test database. */
export const LIVE_RP_ID = "localhost";

/** How often `pollLetter` re-reads the letter, in milliseconds. */
export const POLL_INTERVAL_MS = 500;

/** A fixed, obviously fake payload ciphertext. The server never decrypts it. */
export const PLACEHOLDER_PAYLOAD_CIPHERTEXT =
  "REREREREREREREREREREREREREREREREREREREREREQ";

/** A fixed, obviously fake payload nonce. */
export const PLACEHOLDER_PAYLOAD_NONCE = "MzMzMzMzMzMzMzMz";

/** A fixed, obviously fake wrapped key. */
export const PLACEHOLDER_WRAPPED_KEY =
  "IiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIi";

/** The draft issued by `prepareDraft`, as the prepare route returns it. */
export interface PreparedDraft {
  letterId: string;
  serverSecret: string;
  serverNow: string;
}

/** The success body of `sealLive`, as the seal route returns it. */
export interface SealedLive {
  letterId: string;
  sealedAt: string;
  opensAt: string;
}

/** A letter's public status, as the letter route returns it. */
export interface LetterStatusBody {
  status: "sealed" | "openable";
  opensAt: string;
  demo: boolean;
  envelope?: Record<string, unknown>;
  envelopeHash?: string;
}

/** One read of the letter route: the HTTP status and the parsed JSON body. */
export interface LetterReading {
  httpStatus: number;
  body: unknown;
}

/** Options for `pollLetter`. */
export interface PollOptions {
  /** Give up after this many milliseconds. */
  timeoutMs: number;
  /** Wait this long between reads. Defaults to `POLL_INTERVAL_MS`. */
  intervalMs?: number;
}

/** Stub `RP_ID` for the current test scope. Call it from a `beforeAll`. */
export function stubRpId(rpId: string = LIVE_RP_ID): void {
  vi.stubEnv("RP_ID", rpId);
}

/**
 * Build a sealed envelope for `letterId` that opens `gapMs` after `sealedAt`,
 * and its SHA-256 hash. Only the header fields matter to the server; the
 * payload fields are fixed placeholders.
 */
export async function buildEnvelope(
  letterId: string,
  sealedAt: Date,
  gapMs: number = LOCK_DURATION_MS,
): Promise<{ letterId: string; envelope: Record<string, unknown>; envelopeHash: string }> {
  const opensAt = new Date(sealedAt.getTime() + gapMs);
  const envelope = {
    formatVersion: 1,
    letterId,
    sealedAt: sealedAt.toISOString(),
    opensAt: opensAt.toISOString(),
    payloadCiphertext: PLACEHOLDER_PAYLOAD_CIPHERTEXT,
    payloadNonce: PLACEHOLDER_PAYLOAD_NONCE,
    wrappedDeks: [
      {
        factor: "backup",
        nonce: "ERERERERERERERER",
        wrappedKey: PLACEHOLDER_WRAPPED_KEY,
      },
    ],
  };
  return { letterId, envelope, envelopeHash: await envelopeHash(envelope) };
}

/** Call the prepare route and return the raw response. */
export async function callPrepare(): Promise<Response> {
  return prepareRoute(
    new Request("http://localhost/api/letters/demo/prepare", { method: "POST" }),
  );
}

/** Issue a Draft through the prepare route. Throws unless it answers 201. */
export async function prepareDraft(): Promise<PreparedDraft> {
  const res = await callPrepare();
  if (res.status !== 201) {
    throw new Error(`prepare answered ${res.status}, expected 201`);
  }
  return (await res.json()) as PreparedDraft;
}

/** Call the seal route with an arbitrary body and return the raw response. */
export async function callSeal(body: unknown): Promise<Response> {
  return sealRoute(
    new Request("http://localhost/api/letters/demo/seal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

/**
 * Seal a Draft with an envelope sealed at the draft's `serverNow` (or
 * `sealedAt`) and opening `gapMs` later. Returns the raw response.
 */
export async function sealDraft(
  draft: PreparedDraft,
  options: { gapMs?: number; sealedAt?: Date } = {},
): Promise<Response> {
  const sealedAt = options.sealedAt ?? new Date(draft.serverNow);
  return callSeal(await buildEnvelope(draft.letterId, sealedAt, options.gapMs));
}

/** Seal a Draft and return the parsed success body. Throws unless it answers 201. */
export async function sealLive(
  draft: PreparedDraft,
  options: { gapMs?: number; sealedAt?: Date } = {},
): Promise<SealedLive> {
  const res = await sealDraft(draft, options);
  if (res.status !== 201) {
    throw new Error(`seal answered ${res.status}, expected 201`);
  }
  return (await res.json()) as SealedLive;
}

/** Call the letter route (GET /api/letters/{id}) and return the raw response. */
export async function callLetter(letterId: string): Promise<Response> {
  return letterRoute(
    new Request(`http://localhost/api/letters/${letterId}`),
    { params: Promise.resolve({ id: letterId }) },
  );
}

/** Call the secret route (GET /api/letters/{id}/secret) and return the raw response. */
export async function callSecret(letterId: string): Promise<Response> {
  return secretRoute(
    new Request(`http://localhost/api/letters/${letterId}/secret`),
    { params: Promise.resolve({ id: letterId }) },
  );
}

/** Call the openings route (POST /api/openings) with an arbitrary body. */
export async function callOpenings(body: unknown): Promise<Response> {
  return openingsRoute(
    new Request("http://localhost/api/openings", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

/**
 * Read the letter route every `intervalMs` until `until` returns true for the
 * reading, or `timeoutMs` expires. Resolves with the reading that passed.
 * Throws on timeout, and the error names the last HTTP status seen.
 */
export async function pollLetter(
  letterId: string,
  until: (reading: LetterReading) => boolean,
  options: PollOptions,
): Promise<LetterReading> {
  const intervalMs = options.intervalMs ?? POLL_INTERVAL_MS;
  const deadline = Date.now() + options.timeoutMs;
  for (;;) {
    const res = await callLetter(letterId);
    const reading: LetterReading = {
      httpStatus: res.status,
      body: await res.json(),
    };
    if (until(reading)) {
      return reading;
    }
    if (Date.now() + intervalMs > deadline) {
      throw new Error(
        `pollLetter: predicate not met within ${options.timeoutMs} ms (last HTTP status ${reading.httpStatus})`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
}

// --- Scratch database --------------------------------------------------------

interface ScratchDatabase {
  url: string;
  drop: () => Promise<void>;
}

/** Replace the database name in a Postgres URL, keeping the rest of it. */
function withDatabaseName(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

/** The database name in a Postgres URL. The value itself is never logged. */
function databaseNameOf(url: string): string {
  return decodeURIComponent(
    new URL(url).pathname.replace(/^\//, "").split("/")[0],
  );
}

/**
 * Create an empty database next to the test database, named after it with a
 * random suffix so it still contains `test`. The base name is checked before it
 * is quoted into DDL.
 */
async function createScratchDatabase(baseUrl: string): Promise<ScratchDatabase> {
  const base = databaseNameOf(baseUrl);
  if (!/^[A-Za-z0-9_]+$/.test(base)) {
    throw new Error("the test database name has characters this suite does not allow");
  }
  const name = `${base}_live_${randomBytes(6).toString("hex")}`;
  const admin = postgres(withDatabaseName(baseUrl, "postgres"), { max: 1 });
  try {
    await admin.unsafe(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end({ timeout: 5 });
  }
  return {
    url: withDatabaseName(baseUrl, name),
    drop: async () => {
      const cleanup = postgres(withDatabaseName(baseUrl, "postgres"), { max: 1 });
      try {
        await cleanup.unsafe(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
      } finally {
        await cleanup.end({ timeout: 5 });
      }
    },
  };
}

/** Migrate `url` with the migrations in `./drizzle`, on a single-use client. */
async function migrateScratch(url: string): Promise<void> {
  const client = postgres(url, { max: 1 });
  try {
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
  } finally {
    await client.end({ timeout: 5 });
  }
}

/**
 * Declare a live-flow integration block with its own scratch database.
 *
 * Use it like `describeDb`. Before the block's tests run, a scratch database is
 * created next to the test database, migrated, and `DATABASE_URL` and `RP_ID`
 * are stubbed to point at it. After the block, the shared client is closed, the
 * stubs are restored and the scratch database is dropped. Without a test
 * database the block is skipped or fails in CI, as `describeDb` does.
 */
export function describeLiveDb(name: string, body: () => void): void {
  describeDb(name, () => {
    let scratch: ScratchDatabase | undefined;

    beforeAll(async () => {
      const shared = process.env.DATABASE_URL;
      if (!shared) {
        throw new Error("DATABASE_URL must be set before the live suite runs");
      }
      scratch = await createScratchDatabase(shared);
      await migrateScratch(scratch.url);
      vi.stubEnv("DATABASE_URL", scratch.url);
      stubRpId();
    }, 60_000);

    afterAll(async () => {
      await getSql().end({ timeout: 5 });
      vi.unstubAllEnvs();
      await scratch?.drop();
    }, 60_000);

    body();
  });
}
