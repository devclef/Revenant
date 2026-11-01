// Postgres integration tests for Live_Letters: the 0001 migration, the live
// lock and immutability rules, the Prepare_Route and Seal_Route against a real
// database, and the Draft and Live_Letter caps.
//
// Every test here runs against a scratch database created from the test
// database named by DATABASE_URL. Live rows are immutable, and the Live_Letter
// cap counts every live row in the rolling window, so a shared database would
// make the cap tests depend on earlier runs. The scratch database is dropped
// at the end. The suite runs only through `describeDb`, so it skips locally
// without a test database and fails in CI without one.
//
// The migration tests build their own scratch databases. The Live_Letter block
// points `DATABASE_URL` at its scratch database in `beforeAll`, so the real
// `getSql()` client, and the routes built on it, use that database. The cap
// tests fill each table relative to its current count, so they do not depend on
// rows left by earlier tests.

import { randomBytes } from "node:crypto";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import type { Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getSql } from "@/lib/db/client";
import {
  DRAFT_LIFETIME_MS,
  LOCK_DURATION_MS,
  decodeBase64url,
  encodeBase64url,
  envelopeHash,
} from "@/lib/seal-format";
import {
  DRAFT_CAP,
  LIVE_SEAL_CAP,
} from "@/lib/letter-store/live-constants";
import { POST as prepareRoute } from "@/app/api/letters/demo/prepare/route";
import { POST as sealRoute } from "@/app/api/letters/demo/seal/route";

import { describeDb } from "./setup";

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

/** The shared test database URL, captured before any test changes it. */
const SHARED_URL = process.env.DATABASE_URL as string;

/** A 64-char lowercase hex hash. Only the format matters to the CHECK. */
const HASH = "a".repeat(64);

/** A 32-byte time-lock secret for direct inserts. */
const SECRET = Buffer.alloc(32, 5);

/** A backup-wrapped envelope body, with the fixed fields a header needs. */
const PAYLOAD_CIPHERTEXT = "REREREREREREREREREREREREREREREREREREREREREQ";
const PAYLOAD_NONCE = "MzMzMzMzMzMzMzMz";
const WRAPPED_KEY = "IiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIiIi";

// --- Scratch databases ------------------------------------------------------

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

/** The database name in a Postgres URL, with no value logged. */
function databaseNameOf(url: string): string {
  return decodeURIComponent(
    new URL(url).pathname.replace(/^\//, "").split("/")[0],
  );
}

/**
 * Create an empty database next to the test database. Its name is the test
 * database name plus a random suffix, so it still contains `test`. The name is
 * checked before it is quoted into DDL.
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

/** Run `fn` on a single-connection client for `url`, then close it. */
async function withClient<T>(url: string, fn: (c: Sql) => Promise<T>): Promise<T> {
  const client = postgres(url, { max: 1 });
  try {
    return await fn(client);
  } finally {
    await client.end({ timeout: 5 });
  }
}

/** Run the Drizzle migrator on `url` with the migrations in `folder`. */
async function migrateDatabase(url: string, folder: string): Promise<void> {
  await withClient(url, async (client) => {
    await migrate(drizzle(client), { migrationsFolder: folder });
  });
}

/** How many migrations the journal records as applied. */
async function migrationCount(url: string): Promise<number> {
  return withClient(url, async (client) => {
    const rows = await client<{ n: number }[]>`
      SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations
    `;
    return rows[0].n;
  });
}

// --- Fixtures ----------------------------------------------------------------

/** A fresh random 22-character letter ID. */
function newId(): string {
  return encodeBase64url(new Uint8Array(randomBytes(16)));
}

/** A valid envelope for `letterId`, sealed at `sealedAt` and opening at `opensAt`. */
async function envelopeFor(letterId: string, sealedAt: Date, opensAt: Date) {
  const envelope = {
    formatVersion: 1,
    letterId,
    sealedAt: sealedAt.toISOString(),
    opensAt: opensAt.toISOString(),
    payloadCiphertext: PAYLOAD_CIPHERTEXT,
    payloadNonce: PAYLOAD_NONCE,
    wrappedDeks: [{ factor: "backup", nonce: "ERERERERERERERER", wrappedKey: WRAPPED_KEY }],
  };
  return { letterId, envelope, envelopeHash: await envelopeHash(envelope) };
}

/** One Seal_Route lock case: the gap, and where the envelope's sealedAt sits. */
interface SealCase {
  gapMs: number;
  sealedAt?: "past" | "future";
}

interface PreparedDraft {
  letterId: string;
  serverSecret: string;
  serverNow: string;
}

// --- Route callers -----------------------------------------------------------

async function callPrepare(): Promise<Response> {
  return prepareRoute(
    new Request("http://x/api/letters/demo/prepare", { method: "POST" }),
  );
}

async function prepareDraft(): Promise<PreparedDraft> {
  const res = await callPrepare();
  expect(res.status).toBe(201);
  return (await res.json()) as PreparedDraft;
}

async function callSeal(body: unknown): Promise<Response> {
  return sealRoute(
    new Request("http://x/api/letters/demo/seal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

/** Seal a draft with an envelope sealed at `sealedAt` and opening `gapMs` later. */
async function sealDraft(
  draft: PreparedDraft,
  { gapMs = LOCK_DURATION_MS, sealedAt = new Date(draft.serverNow) } = {},
): Promise<Response> {
  const opensAt = new Date(sealedAt.getTime() + gapMs);
  return callSeal(await envelopeFor(draft.letterId, sealedAt, opensAt));
}

// --- Row helpers -------------------------------------------------------------

/** The server clock, read the way the store reads it. */
async function dbNow(sql: Sql): Promise<Date> {
  const rows = await sql<{ t: Date }[]>`SELECT clock_timestamp() AS t`;
  return new Date(rows[0].t);
}

/** Insert one demo row directly. The `envelope` text is a placeholder: the CHECKs don't read it. */
async function insertDemoRow(
  sql: Sql,
  row: { id: string; kind: string; sealedAt: Date; opensAt: Date },
): Promise<void> {
  await sql`
    INSERT INTO demo_letters (id, kind, envelope, envelope_hash, sealed_at, opens_at, server_secret)
    VALUES (${row.id}, ${row.kind}, ${"{}"}, ${HASH}, ${row.sealedAt.toISOString()}, ${row.opensAt.toISOString()}, ${SECRET})
  `;
}

/** Insert `count` live rows, all sealed at `sealedAt` and opening 30 seconds later. */
async function insertLiveRows(sql: Sql, count: number, sealedAt: Date): Promise<void> {
  if (count <= 0) {
    return;
  }
  const rows = Array.from({ length: count }, () => ({
    id: newId(),
    kind: "live",
    envelope: "{}",
    envelope_hash: HASH,
    sealed_at: sealedAt.toISOString(),
    opens_at: new Date(sealedAt.getTime() + LOCK_DURATION_MS).toISOString(),
    server_secret: SECRET,
  }));
  await sql`
    INSERT INTO demo_letters ${sql(
      rows,
      "id",
      "kind",
      "envelope",
      "envelope_hash",
      "sealed_at",
      "opens_at",
      "server_secret",
    )}
  `;
}

/** Insert `count` Drafts that all carry `createdAt`. */
async function insertDrafts(sql: Sql, count: number, createdAt: Date): Promise<void> {
  if (count <= 0) {
    return;
  }
  const rows = Array.from({ length: count }, () => ({
    id: newId(),
    server_secret: SECRET,
    created_at: createdAt.toISOString(),
  }));
  await sql`
    INSERT INTO demo_letter_drafts ${sql(rows, "id", "server_secret", "created_at")}
  `;
}

async function draftExists(sql: Sql, letterId: string): Promise<boolean> {
  const rows = await sql`SELECT 1 FROM demo_letter_drafts WHERE id = ${letterId}`;
  return rows.length === 1;
}

async function demoRowCount(sql: Sql, letterId: string): Promise<number> {
  const rows = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM demo_letters WHERE id = ${letterId}
  `;
  return rows[0].n;
}

async function letterRowCount(sql: Sql, letterId: string): Promise<number> {
  const rows = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM letters WHERE id = ${letterId}
  `;
  return rows[0].n;
}

// --- Suite -------------------------------------------------------------------

describeDb("live letters (integration)", () => {
  let scratch: ScratchDatabase;

  beforeAll(async () => {
    scratch = await createScratchDatabase(SHARED_URL);
    process.env.DATABASE_URL = scratch.url;
    await migrateDatabase(scratch.url, "./drizzle");
    process.env.RP_ID = "localhost";
  }, 60_000);

  afterAll(async () => {
    await getSql().end({ timeout: 5 });
    process.env.DATABASE_URL = SHARED_URL;
    delete process.env.RP_ID;
    await scratch.drop();
  }, 60_000);

  describe("migration 0001_live_letters", () => {
    it("applies every migration twice without error, and the second run changes nothing", async () => {
      const db = await createScratchDatabase(SHARED_URL);
      try {
        await migrateDatabase(db.url, "./drizzle");
        const first = await migrationCount(db.url);
        expect(first).toBe(2);

        await migrateDatabase(db.url, "./drizzle");
        expect(await migrationCount(db.url)).toBe(first);

        await withClient(db.url, async (client) => {
          const rows = await client<{ def: string }[]>`
            SELECT pg_get_constraintdef(oid) AS def
            FROM pg_constraint WHERE conname = 'demo_letters_kind'
          `;
          expect(rows[0].def).toContain("'live'");
        });
      } finally {
        await db.drop();
      }
    });

    it("rolls the whole file back when 0001 fails: kind stays persona-only and no 0001 row is recorded", async () => {
      const db = await createScratchDatabase(SHARED_URL);
      const folder = mkdtempSync(join(tmpdir(), "revenant-0000-"));
      try {
        // A migrations folder that holds only 0000.
        const journal = JSON.parse(
          readFileSync("drizzle/meta/_journal.json", "utf8"),
        ) as { entries: unknown[] };
        mkdirSync(join(folder, "meta"));
        writeFileSync(
          join(folder, "meta", "_journal.json"),
          JSON.stringify({ ...journal, entries: journal.entries.slice(0, 1) }),
        );
        copyFileSync(
          "drizzle/0000_sealed_letters.sql",
          join(folder, "0000_sealed_letters.sql"),
        );
        await migrateDatabase(db.url, folder);
        expect(await migrationCount(db.url)).toBe(1);

        // 0001 starts with two ALTERs and then creates `demo_letter_drafts`.
        // This table makes that CREATE fail, after the ALTERs have run.
        await withClient(db.url, (client) =>
          client`CREATE TABLE demo_letter_drafts (blocker integer)`,
        );
        await expect(migrateDatabase(db.url, "./drizzle")).rejects.toThrow();

        expect(await migrationCount(db.url)).toBe(1);
        await withClient(db.url, async (client) => {
          const def = await client<{ def: string }[]>`
            SELECT pg_get_constraintdef(oid) AS def
            FROM pg_constraint WHERE conname = 'demo_letters_kind'
          `;
          expect(def[0].def).not.toContain("'live'");

          const lock = await client`
            SELECT 1 FROM pg_constraint WHERE conname = 'demo_letters_live_lock'
          `;
          expect(lock).toHaveLength(0);

          const sealedAt = new Date("2026-11-01T12:00:00.000Z");
          await expect(
            client`
              INSERT INTO demo_letters (id, kind, envelope, envelope_hash, sealed_at, opens_at, server_secret)
              VALUES (${newId()}, 'live', '{}', ${HASH}, ${sealedAt.toISOString()}, ${new Date(sealedAt.getTime() + LOCK_DURATION_MS).toISOString()}, ${SECRET})
            `,
          ).rejects.toThrow(/demo_letters_kind/);
        });
      } finally {
        rmSync(folder, { recursive: true, force: true });
        await db.drop();
      }
    });
  });

  describe("live lock and immutability", () => {
    const sealedAt = new Date("2026-11-01T12:00:00.000Z");

    it.each<[number, boolean]>([
      [29_999, false],
      [30_000, true],
      [30_001, false],
    ])("a live row opening %i ms after sealing: accepted=%s", async (gapMs, accepted) => {
      const attempt = insertDemoRow(getSql(), {
        id: newId(),
        kind: "live",
        sealedAt,
        opensAt: new Date(sealedAt.getTime() + gapMs),
      });
      if (accepted) {
        await expect(attempt).resolves.toBeUndefined();
      } else {
        await expect(attempt).rejects.toThrow(/demo_letters_live_lock/);
      }
    });

    it("rejects a live row whose lock is 31 seconds", async () => {
      await expect(
        insertDemoRow(getSql(), {
          id: newId(),
          kind: "live",
          sealedAt,
          opensAt: new Date(sealedAt.getTime() + 31_000),
        }),
      ).rejects.toThrow(/demo_letters_live_lock/);
    });

    it("accepts a persona row whose opens_at is long before its sealed_at", async () => {
      await expect(
        insertDemoRow(getSql(), {
          id: newId(),
          kind: "persona",
          sealedAt: new Date("2024-10-31T12:00:00.000Z"),
          opensAt: new Date("2020-01-01T00:00:00.000Z"),
        }),
      ).resolves.toBeUndefined();
    });

    it("rejects a real letter that opens 30 seconds after sealing", async () => {
      await expect(
        getSql()`
          INSERT INTO letters (id, envelope, envelope_hash, sealed_at, opens_at, server_secret)
          VALUES (${newId()}, ${"{}"}, ${HASH}, ${sealedAt.toISOString()}, ${new Date(sealedAt.getTime() + LOCK_DURATION_MS).toISOString()}, ${SECRET})
        `,
      ).rejects.toThrow(/letters_opens_at_min_lock/);
    });

    it("raises on UPDATE, DELETE and TRUNCATE of a live row, and leaves the row unchanged", async () => {
      const id = newId();
      await insertDemoRow(getSql(), {
        id,
        kind: "live",
        sealedAt,
        opensAt: new Date(sealedAt.getTime() + LOCK_DURATION_MS),
      });

      await expect(
        getSql()`UPDATE demo_letters SET envelope = ${"changed"} WHERE id = ${id}`,
      ).rejects.toThrow(/is not allowed/);
      await expect(
        getSql()`DELETE FROM demo_letters WHERE id = ${id}`,
      ).rejects.toThrow(/is not allowed/);
      // TRUNCATE may also fail on the `openings` foreign key. Either way it
      // must reject and the row must survive.
      await expect(getSql()`TRUNCATE demo_letters`).rejects.toThrow();

      const rows = await getSql()<{ envelope: string }[]>`
        SELECT envelope FROM demo_letters WHERE id = ${id}
      `;
      expect(rows).toHaveLength(1);
      expect(rows[0].envelope).toBe("{}");
    });
  });

  describe("Prepare_Route against Postgres", () => {
    it("stores the draft with created_at equal to the serverNow it returned", async () => {
      const draft = await prepareDraft();
      const rows = await getSql()<{ created_at: Date }[]>`
        SELECT created_at FROM demo_letter_drafts WHERE id = ${draft.letterId}
      `;
      expect(rows).toHaveLength(1);
      expect(new Date(rows[0].created_at).toISOString()).toBe(draft.serverNow);
    });

    it("deletes an expired draft on the next prepare", async () => {
      const oldId = newId();
      const now = await dbNow(getSql());
      await getSql()`
        INSERT INTO demo_letter_drafts (id, server_secret, created_at)
        VALUES (${oldId}, ${SECRET}, ${new Date(now.getTime() - 60 * 60 * 1000).toISOString()})
      `;

      await prepareDraft();
      expect(await draftExists(getSql(), oldId)).toBe(false);
    });
  });

  describe("Seal_Route against Postgres", () => {
    it("stores a live row with the draft's server secret, removes the draft and writes no letters row", async () => {
      const draft = await prepareDraft();
      const res = await sealDraft(draft);
      expect(res.status).toBe(201);

      const body = (await res.json()) as {
        letterId: string;
        sealedAt: string;
        opensAt: string;
      };
      expect(body.letterId).toBe(draft.letterId);
      expect(body.sealedAt).toBe(draft.serverNow);
      expect(new Date(body.opensAt).getTime() - new Date(body.sealedAt).getTime()).toBe(
        LOCK_DURATION_MS,
      );

      const rows = await getSql()<{ kind: string; server_secret: Buffer }[]>`
        SELECT kind, server_secret FROM demo_letters WHERE id = ${draft.letterId}
      `;
      expect(rows).toHaveLength(1);
      expect(rows[0].kind).toBe("live");
      expect(
        Buffer.from(rows[0].server_secret).equals(
          Buffer.from(decodeBase64url(draft.serverSecret)),
        ),
      ).toBe(true);

      expect(await draftExists(getSql(), draft.letterId)).toBe(false);
      expect(await letterRowCount(getSql(), draft.letterId)).toBe(0);
    });

    it.each<[string, SealCase]>([
      ["a 29,999 ms lock", { gapMs: 29_999 }],
      ["a 30,001 ms lock", { gapMs: 30_001 }],
      ["an opensAt at or before the server clock", { gapMs: LOCK_DURATION_MS, sealedAt: "past" }],
      ["an opensAt more than 60 seconds ahead", { gapMs: LOCK_DURATION_MS, sealedAt: "future" }],
    ])("rejects %s with 422 and keeps the draft", async (_label, option) => {
      const draft = await prepareDraft();
      const serverNow = new Date(draft.serverNow);
      const sealedAt =
        option.sealedAt === "past"
          ? new Date(serverNow.getTime() - 60_000)
          : option.sealedAt === "future"
            ? new Date(serverNow.getTime() + 40_000)
            : serverNow;

      const res = await sealDraft(draft, { gapMs: option.gapMs, sealedAt });
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({ error: "lock_out_of_range" });

      expect(await demoRowCount(getSql(), draft.letterId)).toBe(0);
      expect(await draftExists(getSql(), draft.letterId)).toBe(true);
    });

    it("answers an unknown Draft and an expired Draft with the same 404 body and writes nothing", async () => {
      const unknown = await sealDraft({
        letterId: newId(),
        serverSecret: "",
        serverNow: new Date().toISOString(),
      });
      const unknownText = await unknown.text();

      const expiredId = newId();
      const now = await dbNow(getSql());
      await getSql()`
        INSERT INTO demo_letter_drafts (id, server_secret, created_at)
        VALUES (${expiredId}, ${SECRET}, ${new Date(now.getTime() - DRAFT_LIFETIME_MS - 60_000).toISOString()})
      `;
      const expired = await sealDraft({
        letterId: expiredId,
        serverSecret: "",
        serverNow: now.toISOString(),
      });
      const expiredText = await expired.text();

      expect(unknown.status).toBe(404);
      expect(expired.status).toBe(404);
      expect(expiredText).toBe(unknownText);
      expect(unknownText).toBe('{"error":"not_found"}');
      expect(await demoRowCount(getSql(), expiredId)).toBe(0);
    });
  });

  describe("24-hour window", () => {
    it("does not count live rows sealed more than 24 hours ago", async () => {
      const now = await dbNow(getSql());
      await insertLiveRows(
        getSql(),
        LIVE_SEAL_CAP + 100,
        new Date(now.getTime() - 25 * 60 * 60 * 1000),
      );

      const draft = await prepareDraft();
      const res = await sealDraft(draft);
      expect(res.status).toBe(201);
    });
  });

  describe("caps", () => {
    beforeEach(async () => {
      // Drafts have no immutability trigger, so the cap tests can clear them.
      await getSql()`DELETE FROM demo_letter_drafts`;
    });

    it("accepts a prepare at exactly DRAFT_CAP drafts and answers 429 busy at one more", async () => {
      const now = await dbNow(getSql());
      await insertDrafts(getSql(), DRAFT_CAP, now);

      const accepted = await callPrepare();
      expect(accepted.status).toBe(201);

      const busy = await callPrepare();
      expect(busy.status).toBe(429);
      expect(await busy.json()).toEqual({ error: "busy" });

      const rows = await getSql()<{ n: number }[]>`
        SELECT count(*)::int AS n FROM demo_letter_drafts
      `;
      expect(rows[0].n).toBe(DRAFT_CAP + 1);
    });

    it("does not count expired drafts toward the draft cap", async () => {
      const now = await dbNow(getSql());
      await insertDrafts(
        getSql(),
        DRAFT_CAP + 5,
        new Date(now.getTime() - DRAFT_LIFETIME_MS - 60_000),
      );

      const res = await callPrepare();
      expect(res.status).toBe(201);

      const rows = await getSql()<{ n: number }[]>`
        SELECT count(*)::int AS n FROM demo_letter_drafts
      `;
      expect(rows[0].n).toBe(1);
    });

    it("accepts a seal at exactly LIVE_SEAL_CAP live rows in 24 hours, answers 429 busy at one more, and keeps that draft", async () => {
      const now = await dbNow(getSql());
      const inWindow = await getSql()<{ n: number }[]>`
        SELECT count(*)::int AS n FROM demo_letters
        WHERE kind = 'live'
          AND sealed_at > ${new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()}
      `;
      const existing = inWindow[0].n;
      expect(existing).toBeLessThanOrEqual(LIVE_SEAL_CAP);
      await insertLiveRows(
        getSql(),
        LIVE_SEAL_CAP - existing,
        new Date(now.getTime() - 60 * 60 * 1000),
      );

      const first = await prepareDraft();
      const accepted = await sealDraft(first);
      expect(accepted.status).toBe(201);

      const second = await prepareDraft();
      const busy = await sealDraft(second);
      expect(busy.status).toBe(429);
      expect(await busy.json()).toEqual({ error: "busy" });
      expect(await draftExists(getSql(), second.letterId)).toBe(true);
      expect(await demoRowCount(getSql(), second.letterId)).toBe(0);
    });
  });
});
