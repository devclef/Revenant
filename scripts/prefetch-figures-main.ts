// Prefetch_Script entry (spec 04-real-figures, task 5; design.md "Script
// entry"). This is the bundle entry for `node scripts/prefetch-figures.mjs`: it
// wires the real I/O dependencies and hands them to the pure `runPrefetch` in
// src/lib/sources/prefetch.ts, which touches no file.
//
// It reads no environment variable and no argument. Its file read, write and
// rename, its `runPrefetch`, its clock, and its output streams are all injected
// through `main(deps)` (defaulting to node:fs + process), so a test can drive
// the whole run from recorded bytes and in-memory files with no disk and no
// network (R2.6, Testing Strategy).
//
// Behaviour (design.md "Script entry", R6.3, R6.6):
//
//  - Read the Real_File if it exists (else pass `null`) and call `runPrefetch`.
//  - On success, write the text to a temporary file next to the target and
//    rename it over the target, so the committed file is replaced atomically
//    and only after a full successful run. Then print the Report — the per
//    series `added` lines, then revisions, then gaps, then missing-from-source,
//    each through `formatReportLine` — and exit 0, including when revisions,
//    gaps or missing periods were reported.
//  - On any thrown error, print exactly one `prefetch failed: <detail>` line,
//    exit 1, and do not touch the target (the file is replaced only by the
//    rename after a successful run, R6.3). For a `PrefetchError` of kind
//    `backfill` or `coverage` it first prints every report line the error
//    carries (so every `backfill` line is visible), then the failure line.
//
// Neutrality and data integrity (data-integrity.md, neutrality.md): it prints
// only what the Report and a `bad_cell` error already carry; it invents no
// number and never says a value rose, fell, improved, worsened or was revised.
// No secret is read or logged; the Real_File content is not logged.

import { constants as fsConstants } from "node:fs";
import { readFile, writeFile, rename, access } from "node:fs/promises";
import path from "node:path";

import { runPrefetch, PrefetchError, parseFetchStatus, updateFetchStatus } from "@/lib/sources/prefetch";
import { formatReportLine, type Report } from "@/lib/sources/refresh";
import type { Fetcher } from "@/lib/sources/types";

/**
 * The fetch status file (spec 08, R21.2): one run start time per series that
 * succeeded in the last run that reached it. Lives beside the figure file.
 */
export const STATUS_PATH = "src/lib/figures/real/fetch-status.json";

/**
 * The committed figure file this script refreshes (design.md "Prefetch"). A
 * module constant, not an argument: the entry reads no argument. The path is
 * relative to the current working directory, which is the repo root when the
 * launcher runs `node scripts/prefetch-figures.mjs`.
 */
export const TARGET_PATH = "src/lib/figures/real/fuel-figures.json";

/**
 * Injectable dependencies for {@link main}. Every one defaults to the real
 * implementation (node:fs promises, `process` streams and exit, the system
 * clock), so production needs no arguments; a test passes in-memory stand-ins
 * to run the whole entry without a disk, a network or a real process exit.
 */
export interface MainDeps {
  /** Read the target file's text, or reject if it does not exist. */
  readFile: (file: string) => Promise<string>;
  /** Write text to a file (used for the temp file next to the target). */
  writeFile: (file: string, text: string) => Promise<void>;
  /** Rename one path over another (the atomic replace of the target). */
  rename: (from: string, to: string) => Promise<void>;
  /** True when the target file exists (so a first run passes `null`). */
  exists: (file: string) => Promise<boolean>;
  /** End the process with a status code. */
  exit: (code: number) => void;
  /** Print one line to stdout (the Report). */
  log: (line: string) => void;
  /** Print one line to stderr (the single `prefetch failed:` line). */
  errorLog: (line: string) => void;
  /** The clock threaded into the Adapters through `runPrefetch`. */
  now: () => Date;
  /**
   * The HTTP fetcher threaded into the Adapters through `runPrefetch`. Omitted
   * in production, where each Adapter uses its own real `fetch` default; a test
   * passes a stub that returns the recorded excerpts so the whole entry runs
   * with no network (R2.6, R8.1).
   */
  fetcher?: Fetcher;
}

/** The real dependencies: node:fs promises, `process` and the system clock. */
function defaultDeps(): MainDeps {
  return {
    readFile: (file) => readFile(file, "utf8"),
    writeFile: (file, text) => writeFile(file, text, "utf8"),
    rename: (from, to) => rename(from, to),
    exists: async (file) => {
      try {
        await access(file, fsConstants.F_OK);
        return true;
      } catch {
        return false;
      }
    },
    exit: (code) => process.exit(code),
    log: (line) => process.stdout.write(`${line}\n`),
    errorLog: (line) => process.stderr.write(`${line}\n`),
    now: () => new Date(),
  };
}

/**
 * Emit a merge {@link Report} as lines in a fixed order: each series' `added`
 * line (in the order the merge listed them, which is catalogue order), then
 * revisions, then backfills, then gaps, then missing-from-source. Every line is
 * produced by {@link formatReportLine}, the single place the wording lives, so
 * the printed text and the tested wording never drift apart. Used for both a
 * successful run and the report a `backfill`/`coverage` {@link PrefetchError}
 * carries, so every `backfill` line the refusal recorded is visible.
 */
function printReport(report: Report, log: (line: string) => void): void {
  for (const s of report.perSeries) {
    log(
      formatReportLine({
        kind: "added",
        metricId: s.metricId,
        added: s.added,
        first: s.first,
        last: s.last,
      }),
    );
  }
  for (const r of report.revisions) {
    log(
      formatReportLine({
        kind: "revision",
        metricId: r.metricId,
        period: r.period,
        committed: r.committed,
        source: r.source,
      }),
    );
  }
  for (const b of report.backfills) {
    log(
      formatReportLine({
        kind: "backfill",
        metricId: b.metricId,
        period: b.period,
        latest: b.latest,
      }),
    );
  }
  for (const g of report.gaps) {
    log(
      formatReportLine({
        kind: "gap",
        metricId: g.metricId,
        period: g.period,
        reason: g.reason,
      }),
    );
  }
  for (const m of report.missingFromSource) {
    log(
      formatReportLine({
        kind: "missing-from-source",
        metricId: m.metricId,
        period: m.period,
      }),
    );
  }
}

/** Write `text` to a temp file next to `target`, then rename it over `target`. */
async function replaceFile(
  deps: MainDeps,
  target: string,
  text: string,
): Promise<void> {
  const dir = path.dirname(target);
  const base = path.basename(target);
  const tempPath = path.join(dir, `.${base}.tmp`);
  await deps.writeFile(tempPath, text);
  await deps.rename(tempPath, target);
}

/**
 * Run the prefetch entry with the given dependencies (design.md "Script
 * entry"). It reads the Real_File and the fetch status if they exist, calls
 * `runPrefetch`, writes both files, prints the Report and exits 1 when any
 * series failed, else 0. On a thrown error it prints one
 * `prefetch failed: <detail>` line (after any report lines a `backfill` or
 * `coverage` {@link PrefetchError} carries) and exits 1 without touching either
 * target. It never throws out of itself: every path ends in `exit`.
 */
export async function main(deps: MainDeps = defaultDeps()): Promise<void> {
  try {
    // Read the committed file only when it exists; a first run passes null.
    const existingJson: unknown | null = (await deps.exists(TARGET_PATH))
      ? (JSON.parse(await deps.readFile(TARGET_PATH)) as unknown)
      : null;
    const statusJson: unknown | null = (await deps.exists(STATUS_PATH))
      ? (JSON.parse(await deps.readFile(STATUS_PATH)) as unknown)
      : null;
    const existingStatus = statusJson === null ? {} : parseFetchStatus(statusJson);

    const outcome = await runPrefetch(existingJson, {
      now: deps.now,
      fetcher: deps.fetcher,
    });
    const { text, report } = outcome;
    const statusText = updateFetchStatus(
      existingStatus,
      outcome.succeeded,
      outcome.runStartedAt,
    );

    // Atomic replace: write a temp file next to each target, then rename it over
    // the target. The targets change only here, only after a full run.
    await replaceFile(deps, TARGET_PATH, text);
    await replaceFile(deps, STATUS_PATH, statusText);

    printReport(report, deps.log);

    // Any failed series makes the run fail (R21.2), even though the other series
    // were stored. One line per failed series names it and why.
    for (const failure of outcome.failed) {
      deps.errorLog(
        `prefetch failed: series ${failure.metricId} reason=${failure.reason}`,
      );
    }
    deps.exit(outcome.failed.length > 0 ? 1 : 0);
  } catch (err) {
    // For a backfill or coverage failure, print the report it carries first
    // (every backfill line visible), then the single failure line.
    if (
      err instanceof PrefetchError &&
      err.report !== null &&
      (err.kind === "backfill" || err.kind === "coverage")
    ) {
      printReport(err.report, deps.log);
    }

    const detail = err instanceof Error ? err.message : String(err);
    deps.errorLog(`prefetch failed: ${detail}`);
    deps.exit(1);
  }
}
