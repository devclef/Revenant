// Entry point for the Fetch_Job (spec 08-judge-polish, task 16; design.md "The daily
// figure fetch"). The CronJob runs it as `node dist/fetch-figures.mjs`, the bundle
// that scripts/fetch-figures.build.mjs writes from this file (into the gitignored dist/).
//
// It wires the real pieces into the pure `runFetchJob`: the Postgres store, the
// publisher adapters, the bundled seed file and the clock. It sets
// `process.exitCode` and nothing else. No HTTP route imports it, and it starts no
// run on a request (R20.7).
//
// Output: one line per series from runFetchJob, plus one failure line when the
// job cannot start. Connection strings and raw error text are never printed.

import type { Sql } from "postgres";

import { getSql } from "@/lib/db/client";
import { CATALOGUE, loadFigureFile } from "@/lib/figures";
import type { FigureFile } from "@/lib/figures/types";
import realFigures from "@/lib/figures/real/fuel-figures.json";
import { createFetchAdapters } from "@/lib/sources/fetch-adapters";
import { runFetchJob, seedRowsFromFigureFile } from "@/lib/sources/fetch-job";

import { createPostgresFigureStore } from "./fetch-figures-store";

function log(line: string): void {
  process.stdout.write(`${line}\n`);
}

/** The run start, cut to whole seconds. It becomes each successful series' Last_Success_Time. */
function runStartedAt(): Date {
  return new Date(Math.floor(Date.now() / 1000) * 1000);
}

async function main(): Promise<0 | 1> {
  // Validate the bundled seed the way the app loads it, so a bad file ends the job
  // before any write.
  let seed: ReturnType<typeof seedRowsFromFigureFile>;
  try {
    loadFigureFile(realFigures, CATALOGUE);
    seed = seedRowsFromFigureFile(realFigures as unknown as FigureFile);
  } catch {
    log("fetch-figures failed: seed");
    return 1;
  }

  let sql: Sql;
  try {
    sql = getSql();
  } catch {
    // DATABASE_URL is unset or empty. The message stays out of the log.
    log("fetch-figures failed: database");
    return 1;
  }

  try {
    const result = await runFetchJob({
      store: createPostgresFigureStore(sql),
      adapters: createFetchAdapters(),
      runStartedAt: runStartedAt(),
      seed,
      log,
    });
    return result.exitCode;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  () => {
    // An unexpected throw. Only a fixed token is printed, never the error text.
    log("fetch-figures failed: unexpected");
    process.exitCode = 1;
  },
);
