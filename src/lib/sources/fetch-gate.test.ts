// Tests for the Fetch_Job start-up gate (spec 08-judge-polish; GitHub issue #248).
// Every case uses a stubbed session, a fake clock whose `sleep` advances it, and a
// stub job. No database and no network. The stub values are fake: they only
// count calls, and no figure is involved.

import { describe, expect, it } from "vitest";

import type { FetchSession, GateDeps } from "./fetch-gate";
import {
  DATABASE_FAILED_LINE,
  FETCH_LOCK_NAME,
  SCHEMA_FAILED_LINE,
  SCHEMA_POLL_MS,
  SKIPPED_LINE,
  parseWaitForSchema,
  runGatedFetch,
} from "./fetch-gate";

interface Harness {
  deps: GateDeps;
  logs: string[];
  sleeps: number[];
  calls: { open: number; tryLock: number; schemaReady: number; runJob: number; unlock: number; close: number };
  clock: { ms: number };
}

interface Script {
  waitSeconds: number | null;
  /** Opens that throw before one succeeds. */
  openFailures?: number;
  /** Whether the advisory lock is free. */
  lockFree?: boolean;
  /** One answer per schemaReady call; the last answer repeats. */
  schemaAnswers?: boolean[];
  /** The code the job returns. */
  jobCode?: 0 | 1;
}

function harness(script: Script): Harness {
  const clock = { ms: 1_700_000_000_000 };
  const logs: string[] = [];
  const sleeps: number[] = [];
  const calls = { open: 0, tryLock: 0, schemaReady: 0, runJob: 0, unlock: 0, close: 0 };
  let openFailuresLeft = script.openFailures ?? 0;
  const answers = script.schemaAnswers ?? [true];
  let schemaCalls = 0;

  const session: FetchSession = {
    async tryLock() {
      calls.tryLock += 1;
      return script.lockFree ?? true;
    },
    async schemaReady() {
      calls.schemaReady += 1;
      const answer = answers[Math.min(schemaCalls, answers.length - 1)];
      schemaCalls += 1;
      return answer;
    },
    async unlock() {
      calls.unlock += 1;
    },
    async close() {
      calls.close += 1;
    },
  };

  const deps: GateDeps = {
    waitSeconds: script.waitSeconds,
    async openSession() {
      calls.open += 1;
      if (openFailuresLeft > 0) {
        openFailuresLeft -= 1;
        throw new Error("postgres://user:secret@host/db refused");
      }
      return session;
    },
    async runJob() {
      calls.runJob += 1;
      return script.jobCode ?? 0;
    },
    log: (line) => logs.push(line),
    now: () => clock.ms,
    sleep: async (ms) => {
      sleeps.push(ms);
      clock.ms += ms;
    },
  };

  return { deps, logs, sleeps, calls, clock };
}

describe("parseWaitForSchema", () => {
  it("returns null when the flag is absent", () => {
    expect(parseWaitForSchema(["--other"])).toEqual({ ok: true, waitSeconds: null });
    expect(parseWaitForSchema([])).toEqual({ ok: true, waitSeconds: null });
  });

  it("reads whole seconds, including 0", () => {
    expect(parseWaitForSchema(["--wait-for-schema=60"])).toEqual({ ok: true, waitSeconds: 60 });
    expect(parseWaitForSchema(["--wait-for-schema=0"])).toEqual({ ok: true, waitSeconds: 0 });
  });

  it("rejects a value that is not a whole number, and a repeated flag", () => {
    expect(parseWaitForSchema(["--wait-for-schema="])).toEqual({ ok: false });
    expect(parseWaitForSchema(["--wait-for-schema=-5"])).toEqual({ ok: false });
    expect(parseWaitForSchema(["--wait-for-schema=1.5"])).toEqual({ ok: false });
    expect(parseWaitForSchema(["--wait-for-schema=10", "--wait-for-schema=20"])).toEqual({ ok: false });
  });
});

describe("runGatedFetch: wait for the schema", () => {
  it("polls every 5 seconds until the tables exist, then runs the job", async () => {
    const h = harness({ waitSeconds: 60, schemaAnswers: [false, false, true] });

    const code = await runGatedFetch(h.deps);

    expect(code).toBe(0);
    expect(h.sleeps).toEqual([SCHEMA_POLL_MS, SCHEMA_POLL_MS]);
    expect(h.calls.runJob).toBe(1);
    // Each retry gives back the lock and the connection before the next try.
    expect(h.calls.unlock).toBe(3);
    expect(h.calls.close).toBe(3);
    expect(h.logs).toEqual([]);
  });

  it("logs the schema token and exits 1 when the tables never appear before the deadline", async () => {
    const h = harness({ waitSeconds: 10, schemaAnswers: [false] });

    const code = await runGatedFetch(h.deps);

    expect(code).toBe(1);
    // Attempts at 0 s, 5 s and 10 s: the deadline is reached on the third.
    expect(h.sleeps).toEqual([5_000, 5_000]);
    expect(h.calls.schemaReady).toBe(3);
    expect(h.calls.runJob).toBe(0);
    expect(h.calls.unlock).toBe(3);
    expect(h.logs).toEqual([SCHEMA_FAILED_LINE]);
  });

  it("keeps trying the connection while it is down, then runs once it answers", async () => {
    const h = harness({ waitSeconds: 60, openFailures: 2, schemaAnswers: [true] });

    const code = await runGatedFetch(h.deps);

    expect(code).toBe(0);
    expect(h.calls.open).toBe(3);
    expect(h.calls.runJob).toBe(1);
    expect(h.logs).toEqual([]);
  });

  it("never logs connection text while retrying", async () => {
    const h = harness({ waitSeconds: 5, openFailures: 99 });

    const code = await runGatedFetch(h.deps);

    expect(code).toBe(1);
    expect(h.logs).toEqual([SCHEMA_FAILED_LINE]);
    expect(h.logs.join("\n")).not.toContain("postgres://");
  });
});

describe("runGatedFetch: no flag", () => {
  it("runs one attempt, never checks the schema, and behaves as before", async () => {
    const h = harness({ waitSeconds: null, jobCode: 1 });

    const code = await runGatedFetch(h.deps);

    expect(code).toBe(1);
    expect(h.calls.open).toBe(1);
    expect(h.calls.schemaReady).toBe(0);
    expect(h.calls.runJob).toBe(1);
    expect(h.sleeps).toEqual([]);
    expect(h.logs).toEqual([]);
  });

  it("logs the database token and exits 1 when the connection fails, without retrying", async () => {
    const h = harness({ waitSeconds: null, openFailures: 1 });

    const code = await runGatedFetch(h.deps);

    expect(code).toBe(1);
    expect(h.calls.open).toBe(1);
    expect(h.calls.runJob).toBe(0);
    expect(h.sleeps).toEqual([]);
    expect(h.logs).toEqual([DATABASE_FAILED_LINE]);
  });
});

describe("runGatedFetch: the run lock", () => {
  it("exits 0, skips the job and writes nothing when another run holds the lock", async () => {
    const h = harness({ waitSeconds: null, lockFree: false });

    const code = await runGatedFetch(h.deps);

    expect(code).toBe(0);
    expect(h.calls.runJob).toBe(0);
    expect(h.calls.schemaReady).toBe(0);
    expect(h.calls.unlock).toBe(0);
    expect(h.calls.close).toBe(1);
    expect(h.logs).toEqual([SKIPPED_LINE]);
  });

  it("does the same in wait mode without polling the schema or sleeping", async () => {
    const h = harness({ waitSeconds: 60, lockFree: false, schemaAnswers: [false] });

    const code = await runGatedFetch(h.deps);

    expect(code).toBe(0);
    expect(h.sleeps).toEqual([]);
    expect(h.calls.runJob).toBe(0);
    expect(h.logs).toEqual([SKIPPED_LINE]);
  });

  it("releases the lock after the job runs", async () => {
    const h = harness({ waitSeconds: null, jobCode: 0 });

    await runGatedFetch(h.deps);

    expect(h.calls.tryLock).toBe(1);
    expect(h.calls.runJob).toBe(1);
    expect(h.calls.unlock).toBe(1);
    expect(h.calls.close).toBe(1);
  });

  it("names the advisory lock as the spec gives it", () => {
    expect(FETCH_LOCK_NAME).toBe("revenant-fetch-figures");
  });
});
