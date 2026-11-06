// The start-up gate of the Fetch_Job (spec 08-judge-polish; GitHub issue #248).
// It decides whether `runFetchJob` may run at all:
//
//   1. With `--wait-for-schema=<seconds>`, it retries the connection and polls
//      for the `figures` and `figure_fetch_runs` tables every 5 seconds, for up
//      to that many seconds. On timeout it logs `fetch-figures failed: schema`
//      and fails.
//   2. Before any read, it takes the session advisory lock
//      `hashtext('revenant-fetch-figures')`. If another run holds it, it logs
//      `fetch-figures skipped: another run in progress`, writes nothing and exits 0.
//   3. It runs the job while holding the lock, then releases the lock.
//
// Pure module: no environment variable, no clock, no database client. The caller
// injects the session, the job, the clock and the sleep, so tests drive every
// path with stubs. The Postgres session lives in scripts/fetch-figures-store.ts.
//
// Log lines never include a connection string or error text (a fixed token only).

/** How often the schema is polled while waiting, in milliseconds. */
export const SCHEMA_POLL_MS = 5_000;

/** The lock name passed to `hashtext()` in Postgres. */
export const FETCH_LOCK_NAME = "revenant-fetch-figures";

export const SKIPPED_LINE = "fetch-figures skipped: another run in progress";
export const SCHEMA_FAILED_LINE = "fetch-figures failed: schema";
export const DATABASE_FAILED_LINE = "fetch-figures failed: database";

/**
 * One connection to the database that holds the run lock. The Postgres
 * implementation reserves a dedicated connection, because a session advisory
 * lock belongs to the connection that took it. Every method may throw.
 */
export interface FetchSession {
  /** Takes `pg_try_advisory_lock`. True when this session now holds the lock. */
  tryLock(): Promise<boolean>;
  /** True when both `figures` and `figure_fetch_runs` exist. */
  schemaReady(): Promise<boolean>;
  /** Releases the lock. */
  unlock(): Promise<void>;
  /** Returns the connection to the pool. */
  close(): Promise<void>;
}

export interface GateDeps {
  /** `null` when the flag is absent: one attempt, no schema check, no waiting. */
  waitSeconds: number | null;
  /** Opens a session. Throws when the database cannot be reached. */
  openSession: () => Promise<FetchSession>;
  /** Runs the job. Called only while the lock is held and, in wait mode, the schema exists. */
  runJob: () => Promise<0 | 1>;
  /** Receives one fixed log line. */
  log: (line: string) => void;
  /** Milliseconds since the epoch. */
  now: () => number;
  /** Resolves after `ms` milliseconds. */
  sleep: (ms: number) => Promise<void>;
}

type Step = { done: true; code: 0 | 1 } | { done: false };

/** The `--wait-for-schema` flag, or a parse failure. Unknown arguments are ignored. */
export type WaitFlag = { ok: true; waitSeconds: number | null } | { ok: false };

const WAIT_FLAG = /^--wait-for-schema=(.*)$/;
const WHOLE_SECONDS = /^(0|[1-9]\d{0,4})$/;

/**
 * Reads `--wait-for-schema=<seconds>` from the arguments. The value is a whole
 * number of seconds, 0 to 99999. The flag may appear once.
 */
export function parseWaitForSchema(args: readonly string[]): WaitFlag {
  let found: string | undefined;
  for (const arg of args) {
    const match = WAIT_FLAG.exec(arg);
    if (!match) continue;
    if (found !== undefined) return { ok: false };
    found = match[1];
  }
  if (found === undefined) return { ok: true, waitSeconds: null };
  if (!WHOLE_SECONDS.test(found)) return { ok: false };
  return { ok: true, waitSeconds: Number(found) };
}

/** Failure of opening or locking: a database error with no flag, a retry with the flag. */
function failedOrRetry(deps: GateDeps, waitMode: boolean): Step {
  if (waitMode) return { done: false };
  deps.log(DATABASE_FAILED_LINE);
  return { done: true, code: 1 };
}

/** One attempt: open, lock, check the schema in wait mode, run the job, unlock, close. */
async function attemptOnce(deps: GateDeps, waitMode: boolean): Promise<Step> {
  let session: FetchSession;
  try {
    session = await deps.openSession();
  } catch {
    return failedOrRetry(deps, waitMode);
  }

  try {
    let locked: boolean;
    try {
      locked = await session.tryLock();
    } catch {
      return failedOrRetry(deps, waitMode);
    }

    if (!locked) {
      deps.log(SKIPPED_LINE);
      return { done: true, code: 0 };
    }

    try {
      if (waitMode) {
        let ready: boolean;
        try {
          ready = await session.schemaReady();
        } catch {
          ready = false;
        }
        if (!ready) return { done: false };
      }
      return { done: true, code: await deps.runJob() };
    } finally {
      // A failed unlock is not reported: the lock ends with the connection anyway.
      await session.unlock().catch(() => undefined);
    }
  } finally {
    await session.close().catch(() => undefined);
  }
}

/**
 * Runs the gate and, when it passes, the job. Without the flag the gate makes one
 * attempt and never checks the schema, so the job behaves as it did before. With
 * the flag it retries every 5 seconds until the deadline.
 *
 * Returns the exit code: the job's code, 0 for a skipped run, 1 for a failure.
 */
export async function runGatedFetch(deps: GateDeps): Promise<0 | 1> {
  const waitMode = deps.waitSeconds !== null;
  const deadline = deps.now() + (deps.waitSeconds ?? 0) * 1000;

  for (;;) {
    const step = await attemptOnce(deps, waitMode);
    if (step.done) return step.code;

    if (deps.now() >= deadline) {
      deps.log(SCHEMA_FAILED_LINE);
      return 1;
    }
    // Sleep the poll interval, or the time left until the deadline if that is shorter.
    await deps.sleep(Math.min(SCHEMA_POLL_MS, deadline - deps.now()));
  }
}
