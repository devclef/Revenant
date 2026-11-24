#!/usr/bin/env node
// Revenant layout baseline: the layout check's BLOCKER and polish rows on main, once per
// distinct main content. Owner-only (tools/**). See docs/agent-loop.md "Layout check".
//
//   npm run layout-baseline                 the baseline for the merge-base of HEAD and origin/main
//   npm run layout-baseline -- --status     says whether it is cached; builds nothing
//   npm run layout-baseline -- --base <rev> --refresh
//
// `npm run layout-check -- --baseline main` calls resolveBaseline() itself, so an agent
// never builds main by hand. The cache lives outside the worktree, in
// ~/kiro/revenant-crew/layout-baseline/ (REVENANT_LAYOUT_BASELINE_DIR overrides it):
//   <key>.json                 the rows, when this checkout's check script is main's
//   <key>-script-<hash>.json   the rows, when the check script differs (a platform-dev
//                              branch that edits tools/qa), so main is checked with it
//   <name>.log                 the build and check output of that baseline
//   .lock/                     owner, stage and state.json (app process group, container) of
//                              the build in progress
//   work/                      the last main build; node_modules is kept while
//                              package-lock.json is unchanged
// <key> is a hash of the commit's tree with the paths that cannot reach the built app left
// out (see isExcluded), not the commit id. spec-sync pushes a "Tick completed spec tasks"
// commit on every issue close; it changes one line under .kiro/ and so keeps the key.
// The JSON and the log name the commit the rows were built from.
//
// On a cache miss the caller starts the build as its own detached process (new session,
// stdio in the log file) and waits for the cache file, printing a progress line every 30 s.
// Killing the caller does not stop the build. A second caller sees the build in progress
// and only waits. The build extracts the commit with `git archive`, runs npm ci (when the
// lockfile changed) and npm run build, starts a throwaway Postgres (docker run), migrates,
// seals the personas, fetches figures, starts the app with RP_ID=localhost so /demo/live
// works, runs the full check (every default size and stage group) and keeps the result.
// The builder records the app's process group and the container name in the lock directory;
// whoever takes over a stale lock removes them, and any `*.json.tmp-<pid>` of a dead pid.

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, appendFileSync } from "node:fs";
import { createServer } from "node:net";
import { closeSync, openSync, readlinkSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { readBlockersFile } from "./layout-scope.mjs";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const CHECK_SCRIPT = join(HERE, "layout-check.mjs");
const SCOPE_SCRIPT = join(HERE, "layout-scope.mjs");
const LOCK_WAIT_MS = 45 * 60 * 1000;
const APP_WAIT_MS = 90 * 1000;
const FETCH_FIGURES_MS = 5 * 60 * 1000;
const KEEP_FILES = 20;
const PG_IMAGE = "postgres:16-alpine";
const SIGNALS = ["SIGTERM", "SIGINT", "SIGHUP"];
const PROGRESS_MS = 30 * 1000;
const POLL_MS = 2000;
const SELF = fileURLToPath(import.meta.url);

export function baselineDir(env = process.env) {
  return env.REVENANT_LAYOUT_BASELINE_DIR ? resolve(env.REVENANT_LAYOUT_BASELINE_DIR) : join(homedir(), "kiro", "revenant-crew", "layout-baseline");
}

// Paths that cannot reach the built app, left out of the cache key. Evidence:
//  - .dockerignore leaves out .git, .github, .kiro, docs, deploy, scripts and tools/* (bar
//    the tools/qa modules that src/ tests import). The Dockerfile copies only the build
//    output, public/, drizzle/ and the migrate script into the image.
//  - `npm run build` is `next build` plus two esbuild bundles from scripts/. `next build`
//    type-checks every file tsconfig.json includes (**/*.ts, **/*.tsx), so docs/**/*.ts(x)
//    stay in the key; docs images, html and markdown, which nothing imports, do not.
//  - Nothing under src/ imports from .kiro, .github, deploy, tools/agents, tools/dispatcher
//    or tools/hooks (mentions are comments, links and tests of the docs themselves).
//  - scripts/check.sh is the only file in scripts/ that no build step reads.
// Anything not listed here stays in the key: if in doubt, a path counts. README.md, tools/qa,
// the Dockerfile and .dockerignore are kept.
export function isExcluded(path) {
  if (/^(\.kiro|\.github|deploy)\//.test(path)) return true;
  if (/^tools\/(agents|dispatcher|hooks)\//.test(path)) return true;
  if (path.startsWith("docs/")) return !/\.(ts|tsx)$/.test(path);
  return path === "scripts/check.sh";
}

// The hash of what `commit` contains that can change the rendered app: its tree entries
// (mode, blob id, path) minus isExcluded paths. 40 hex characters, like a commit id.
export function treeKey(root, commit) {
  const r = spawnSync("git", ["-C", root, "ls-tree", "-r", "-z", "--full-tree", commit], { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`git ls-tree ${commit}: ${(r.stderr || "").trim().split("\n")[0]}`);
  const hash = createHash("sha256");
  for (const entry of r.stdout.split("\0")) {
    if (!entry) continue;
    const tab = entry.indexOf("\t");
    const path = entry.slice(tab + 1);
    if (isExcluded(path)) continue;
    const [mode, , sha] = entry.slice(0, tab).split(" ");
    hash.update(`${mode} ${sha} ${path}\n`);
  }
  return hash.digest("hex").slice(0, 40);
}

// The cache file name. When the check scripts of this checkout are main's own, the name is
// just the key; otherwise it carries a hash of the scripts, because main checked with a
// changed script is a different baseline.
export function baselineName({ key, scripts, mainScripts }) {
  if (!/^[0-9a-f]{40}$/.test(key)) throw new Error(`not a cache key: ${key}`);
  const same = scripts.length === mainScripts.length && scripts.every((b, i) => b && b === mainScripts[i]);
  if (same) return `${key}.json`;
  const hash = createHash("sha256").update(scripts.join("\n")).digest("hex").slice(0, 12);
  return `${key}-script-${hash}.json`;
}

function git(root, args) {
  const r = spawnSync("git", ["-C", root, ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${(r.stderr || r.stdout || "").trim().split("\n")[0]}`);
  return r.stdout.trim();
}

function gitOrNull(root, args) {
  try {
    return git(root, args);
  } catch {
    return null;
  }
}

// The commit, cache key, cache file and whether it exists, without building anything.
/** @param {{ base?: string | null, cwd?: string, env?: Record<string, string | undefined> }} [opts] */
export function locateBaseline({ base = null, cwd = process.cwd(), env = process.env } = {}) {
  const root = git(cwd, ["rev-parse", "--show-toplevel"]);
  const commit = base
    ? git(root, ["rev-parse", "--verify", `${base}^{commit}`])
    : git(root, ["merge-base", "HEAD", "origin/main"]);
  const key = treeKey(root, commit);
  const scripts = [CHECK_SCRIPT, SCOPE_SCRIPT].map((p) => git(root, ["hash-object", p]));
  const mainScripts = ["tools/qa/layout-check.mjs", "tools/qa/layout-scope.mjs"].map((p) => gitOrNull(root, ["rev-parse", `${commit}:${p}`]));
  const dir = baselineDir(env);
  const file = join(dir, baselineName({ key, scripts, mainScripts }));
  return { root, commit, key, dir, file, cached: existsSync(file) };
}

function readCached(file) {
  readBlockersFile(JSON.parse(readFileSync(file, "utf8")));
  return file;
}

// The builder's signal hook and the child it is waiting for, so a signal at any stage
// stops the child and releases the lock.
let signalHandler = () => process.exit(3);
let currentChild = null;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

const lockPath = (dir) => join(dir, ".lock");

function readOwner(lock) {
  try {
    const [pid, host, commit] = readFileSync(join(lock, "owner"), "utf8").trim().split(" ");
    return pid ? { pid: Number(pid), host, commit } : null;
  } catch {
    return null;
  }
}

// The build in progress, or null: a lock whose owner is a live process on this host.
export function liveBuild(dir) {
  const lock = lockPath(dir);
  const owner = readOwner(lock);
  if (!owner || owner.host !== hostname() || !alive(owner.pid)) return null;
  let stage = "starting";
  try {
    stage = readFileSync(join(lock, "stage"), "utf8").trim() || stage;
  } catch {
    // The builder has not named a stage yet.
  }
  return { ...owner, stage };
}

function setStage(dir, text) {
  try {
    writeFileSync(join(lockPath(dir), "stage"), `${text}\n`);
  } catch {
    // The lock is gone; nothing to tell.
  }
}

// Merges into .lock/state.json what a later owner needs to clean up after this builder.
function recordState(dir, patch) {
  const file = join(lockPath(dir), "state.json");
  let state = {};
  try {
    state = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    // First write.
  }
  writeFileSync(file, JSON.stringify({ ...state, ...patch }));
}

// pid is a process of the build in `work`, not a recycled pid: on Linux its cwd is inside work.
function belongsTo(pid, work) {
  try {
    const cwd = readlinkSync(`/proc/${pid}/cwd`);
    return cwd === work || cwd.startsWith(`${work}/`);
  } catch (error) {
    return error.code !== "ENOENT" && error.code !== "ESRCH" && !existsSync("/proc/self");
  }
}

function removeContainer(name) {
  spawnSync("docker", ["rm", "-f", name], { stdio: "ignore" });
}

// Cleans up after a builder that did not: its app process group and container (named in
// the dead lock's state.json) and any <file>.json.tmp-<pid> whose pid is dead. Safe to
// call on any cache directory.
/** @param {{ dir: string, lock?: string | null, remove?: (name: string) => void, log?: (text: string) => void }} opts */
export function reapStale({ dir, lock = null, remove = removeContainer, log = () => {} }) {
  if (lock) {
    let state = {};
    try {
      state = JSON.parse(readFileSync(join(lock, "state.json"), "utf8"));
    } catch {
      // The builder died before it started anything.
    }
    if (state.appPgid && belongsTo(state.appPgid, join(dir, "work"))) {
      log(`stopping the app left by a dead build (process group ${state.appPgid})`);
      for (const sig of ["SIGTERM", "SIGKILL"]) {
        try {
          process.kill(-state.appPgid, sig);
        } catch {
          break;
        }
        const until = Date.now() + 5000;
        while (Date.now() < until && groupAlive(state.appPgid)) sleepSync(100);
      }
    }
    if (state.container) {
      log(`removing container ${state.container}`);
      remove(state.container);
    }
  }
  for (const f of readdirSync(dir)) {
    const m = /\.json\.tmp-(\d+)$/.exec(f);
    if (m && !alive(Number(m[1]))) rmSync(join(dir, f), { force: true });
  }
}

function groupAlive(pgid) {
  try {
    process.kill(-pgid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

function sleepSync(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Takes the build lock without waiting. Returns a release function, or null while a live
// builder holds it. A stale lock (dead owner, or no owner file for a minute) is claimed
// by an atomic rename, so only one taker cleans it up; its leftovers are reaped first.
function tryLock(dir, commit, log) {
  const lock = lockPath(dir);
  for (;;) {
    try {
      mkdirSync(lock);
      writeFileSync(join(lock, "owner"), `${process.pid} ${hostname()} ${commit}\n`);
      reapStale({ dir, log });
      return () => rmSync(lock, { recursive: true, force: true });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    const owner = readOwner(lock);
    const age = Date.now() - (statSync(lock, { throwIfNoEntry: false })?.mtimeMs ?? Date.now());
    const stale = owner ? owner.host === hostname() && !alive(owner.pid) : age > 60_000;
    if (!stale) {
      if (owner) return null;
      sleepSync(200);
      continue;
    }
    const claimed = `${lock}.stale-${process.pid}`;
    try {
      renameSync(lock, claimed);
    } catch {
      continue;
    }
    reapStale({ dir, lock: claimed, log });
    rmSync(claimed, { recursive: true, force: true });
  }
}

function run(cmd, args, { cwd, env = process.env, logFile, timeoutMs = 0 }) {
  return new Promise((resolvePromise) => {
    appendFileSync(logFile, `\n$ ${cmd} ${args.join(" ")}\n`);
    const child = spawn(cmd, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    currentChild = child;
    const write = (chunk) => appendFileSync(logFile, chunk);
    child.stdout.on("data", write);
    child.stderr.on("data", write);
    let timer = null;
    if (timeoutMs) timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
    child.on("error", (error) => {
      write(`${error.message}\n`);
      if (timer) clearTimeout(timer);
      resolvePromise(127);
    });
    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      resolvePromise(code ?? 1);
    });
  });
}

async function must(step, promise) {
  const code = await promise;
  if (code !== 0) throw new Error(`${step} failed (exit ${code})`);
}

function freePort() {
  return new Promise((resolvePromise, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const { port } = srv.address();
      srv.close(() => resolvePromise(port));
    });
  });
}

function extract(root, commit, work, logFile) {
  return new Promise((resolvePromise, reject) => {
    appendFileSync(logFile, `\n$ git archive ${commit} | tar -x -C ${work}\n`);
    const archive = spawn("git", ["-C", root, "archive", "--format=tar", commit], { stdio: ["ignore", "pipe", "pipe"] });
    const tar = spawn("tar", ["-x", "-C", work], { stdio: ["pipe", "ignore", "pipe"] });
    archive.stdout.pipe(tar.stdin);
    archive.stderr.on("data", (c) => appendFileSync(logFile, c));
    tar.stderr.on("data", (c) => appendFileSync(logFile, c));
    // Wait for both exits: tar can close before git archive reports its code.
    const closed = (child) => new Promise((r) => child.on("close", (code) => r(code)));
    Promise.all([closed(archive), closed(tar)]).then(([a, t]) => (a === 0 && t === 0 ? resolvePromise() : reject(new Error(`git archive | tar failed (${a}/${t})`))));
  });
}

function prune(dir, keep) {
  const files = readdirSync(dir)
    .filter((f) => /^[0-9a-f]{40}.*\.(json|log)$/.test(f) && !f.startsWith(keep))
    .map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t);
  for (const { f } of files.slice(KEEP_FILES * 2)) rmSync(join(dir, f), { force: true });
  for (const f of readdirSync(dir)) {
    if (f.startsWith("shots-") && f !== `shots-${keep.slice(0, 12)}`) rmSync(join(dir, f), { recursive: true, force: true });
  }
}

async function buildBaseline({ root, commit, key, dir, file, log }) {
  const logFile = file.replace(/\.json$/, ".log");
  writeFileSync(logFile, `layout baseline for cache key ${key}, built from commit ${commit}, started ${new Date().toISOString()}\n`);
  log(`building the baseline of main ${commit.slice(0, 12)} (cache key ${key.slice(0, 12)})`);
  const work = join(dir, "work");
  mkdirSync(work, { recursive: true });
  for (const entry of readdirSync(work)) {
    if (entry !== "node_modules") rmSync(join(work, entry), { recursive: true, force: true });
  }
  setStage(dir, "extracting main");
  await extract(root, commit, work, logFile);

  const lockHash = createHash("sha256").update(readFileSync(join(work, "package-lock.json"))).digest("hex");
  const marker = join(work, "node_modules", ".revenant-lock-sha256");
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1" };
  if (!existsSync(marker) || readFileSync(marker, "utf8").trim() !== lockHash) {
    setStage(dir, "npm ci");
    log("npm ci");
    rmSync(join(work, "node_modules"), { recursive: true, force: true });
    await must("npm ci", run("npm", ["ci", "--no-audit", "--no-fund"], { cwd: work, env, logFile }));
    writeFileSync(marker, `${lockHash}\n`);
  }
  setStage(dir, "npm run build");
  log("npm run build");
  await must("npm run build", run("npm", ["run", "build"], { cwd: work, env, logFile }));

  const container = `revenant-layout-baseline-${key.slice(0, 12)}-${process.pid}`;
  const tmp = `${file}.tmp-${process.pid}`;
  let app = null;
  const cleanup = async () => {
    if (app && app.exitCode === null) {
      try {
        process.kill(-app.pid, "SIGTERM");
      } catch {
        // Already gone.
      }
      for (let i = 0; i < 20 && app.exitCode === null; i++) await sleep(250);
      try {
        process.kill(-app.pid, "SIGKILL");
      } catch {
        // Already gone.
      }
    }
    spawnSync("docker", ["rm", "-f", container], { stdio: "ignore" });
  };
  const onSignal = () => {
    cleanup().finally(() => {
      rmSync(tmp, { force: true });
      rmSync(lockPath(dir), { recursive: true, force: true });
      process.exit(3);
    });
  };
  const previousHandler = signalHandler;
  signalHandler = onSignal;
  try {
    setStage(dir, "throwaway Postgres, migrations, personas, figures");
    log("throwaway Postgres, migrations, personas, figures");
    recordState(dir, { container });
    await must("docker run", run("docker", ["run", "-d", "--rm", "--name", container, "-e", "POSTGRES_PASSWORD=baseline", "-e", "POSTGRES_DB=revenant", "-p", "127.0.0.1::5432", PG_IMAGE], { cwd: work, logFile }));
    const mapped = spawnSync("docker", ["port", container, "5432/tcp"], { encoding: "utf8" }).stdout.trim().split("\n")[0];
    const pgPort = mapped.split(":").pop();
    if (!/^\d+$/.test(pgPort)) throw new Error(`docker port gave "${mapped}"`);
    const dbEnv = { ...env, DATABASE_URL: `postgres://postgres:baseline@127.0.0.1:${pgPort}/revenant` };
    let migrated = false;
    for (let i = 0; i < 30 && !migrated; i++) {
      const ready = spawnSync("docker", ["exec", container, "pg_isready", "-U", "postgres", "-d", "revenant"], { stdio: "ignore" }).status === 0;
      if (ready) migrated = (await run("npm", ["run", "db:migrate"], { cwd: work, env: dbEnv, logFile })) === 0;
      if (!migrated) await sleep(1000);
    }
    if (!migrated) throw new Error("npm run db:migrate failed against the throwaway Postgres");
    await must("npm run seal-personas", run("npm", ["run", "seal-personas"], { cwd: work, env: dbEnv, logFile }));
    const figures = (await run("npm", ["run", "fetch-figures"], { cwd: work, env: dbEnv, logFile, timeoutMs: FETCH_FIGURES_MS })) === 0 ? "fetched" : "fetch-figures failed";

    const port = await freePort();
    const url = `http://localhost:${port}`;
    const appEnv = { ...dbEnv, PORT: String(port), RP_ID: "localhost", APP_ORIGIN: url };
    appendFileSync(logFile, `\n$ npm start (PORT=${port} RP_ID=localhost APP_ORIGIN=${url})\n`);
    setStage(dir, "starting the app");
    app = spawn("npm", ["start"], { cwd: work, env: appEnv, detached: true, stdio: ["ignore", "pipe", "pipe"] });
    recordState(dir, { appPgid: app.pid });
    app.stdout.on("data", (c) => appendFileSync(logFile, c));
    app.stderr.on("data", (c) => appendFileSync(logFile, c));
    const until = Date.now() + APP_WAIT_MS;
    let up = false;
    while (!up && Date.now() < until && app.exitCode === null) {
      try {
        const res = await fetch(`${url}/demo`);
        await res.body?.cancel();
        up = res.status === 200;
      } catch {
        // Not listening yet.
      }
      if (!up) await sleep(500);
    }
    if (!up) throw new Error(`the main build did not answer at ${url}/demo within ${APP_WAIT_MS / 1000} s`);

    setStage(dir, "layout check of main (every size and stage group)");
    log(`full layout check of main on ${url}`);
    const shots = join(dir, `shots-${key.slice(0, 12)}`);
    const code = await run(process.execPath, [CHECK_SCRIPT, "--url", url, "--shots", shots, "--save-blockers", tmp, "--quiet"], { cwd: root, logFile });
    if (code !== 0 && code !== 1) throw new Error(`the layout check of main did not finish (exit ${code})`);
    const data = readBlockersFile(JSON.parse(readFileSync(tmp, "utf8")));
    data.commit = commit;
    data.key = key;
    data.setup = { figures, rpId: "localhost", builtAt: new Date().toISOString() };
    writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
    renameSync(tmp, file);
    prune(dir, key);
    const blockers = data.blockers.filter((b) => (b.level ?? "blocker") === "blocker").length;
    log(`main ${commit.slice(0, 12)}: ${blockers} blockers saved to ${file}`);
  } finally {
    signalHandler = previousHandler;
    await cleanup();
    rmSync(tmp, { force: true });
  }
}

// The commit the rows in `file` were built from (older files have none).
function builtFrom(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, "utf8")).commit ?? fallback;
  } catch {
    return fallback;
  }
}

function startBuilder(where, { refresh }) {
  mkdirSync(where.dir, { recursive: true });
  const logFile = where.file.replace(/\.json$/, ".log");
  const fd = openSync(logFile, "a");
  const args = [SELF, "--build", "--base", where.commit, ...(refresh ? ["--refresh"] : [])];
  // A new session with its stdio in the log file: nothing ties the build to the caller's
  // terminal, process group or exit.
  const child = spawn(process.execPath, args, { cwd: where.root, detached: true, stdio: ["ignore", fd, fd], env: process.env });
  child.unref();
  closeSync(fd);
  return child;
}

// Returns { file, commit, cached } for the baseline of `base` (default: the merge-base of
// HEAD and origin/main), building it first on a cache miss. `commit` is the commit the
// rows were built from. The build runs as its own detached process; this call only waits
// for the cache file, so killing it and calling again resumes the wait.
/**
 * @param {{ base?: string | null, refresh?: boolean, cwd?: string, log?: (text: string) => void,
 *   spawnBuilder?: (where: object, opts: { refresh: boolean }) => unknown, progressMs?: number, pollMs?: number, waitMs?: number }} [opts]
 */
export async function resolveBaseline({
  base = null,
  refresh = false,
  cwd = process.cwd(),
  log = (t) => console.error(`layout-baseline: ${t}`),
  spawnBuilder = startBuilder,
  progressMs = PROGRESS_MS,
  pollMs = POLL_MS,
  waitMs = LOCK_WAIT_MS,
} = {}) {
  const where = locateBaseline({ base, cwd });
  const result = (cached) => ({ file: readCached(where.file), commit: builtFrom(where.file, where.commit), cached });
  if (where.cached && !refresh) return result(true);
  mkdirSync(where.dir, { recursive: true });
  const started = Date.now();
  let building = liveBuild(where.dir);
  if (building) {
    log(`a baseline build is already running (pid ${building.pid}, main ${String(building.commit).slice(0, 12)}); waiting for it`);
  } else {
    if (refresh) rmSync(where.file, { force: true });
    log(`no cached baseline for main ${where.commit.slice(0, 12)}; starting the build in the background (log: ${where.file.replace(/\.json$/, ".log")})`);
    spawnBuilder(where, { refresh });
  }
  let told = Date.now();
  for (;;) {
    if (existsSync(where.file) && (!refresh || !liveBuild(where.dir))) return result(false);
    building = liveBuild(where.dir);
    if (!building && Date.now() - started > 20_000 && !existsSync(where.file)) {
      let tail = "";
      try {
        tail = readFileSync(where.file.replace(/\.json$/, ".log"), "utf8").trim().split("\n").slice(-3).join(" | ");
      } catch {
        // No log.
      }
      throw new Error(`the baseline build ended without a result; run the command again. Last log lines: ${tail}`);
    }
    if (Date.now() - started > waitMs) throw new Error(`the baseline build did not finish in ${waitMs / 60000} min; run the command again to keep waiting`);
    if (Date.now() - told >= progressMs) {
      log(`still building main ${(building?.commit ?? where.commit).slice(0, 12)}: ${building?.stage ?? "starting"} (${Math.round((Date.now() - started) / 1000)} s so far)`);
      told = Date.now();
    }
    await sleep(pollMs);
  }
}

// The detached builder. Exits at once when another live builder holds the lock.
async function buildCli(opts) {
  const where = locateBaseline({ base: opts.base });
  mkdirSync(where.dir, { recursive: true });
  const logFile = where.file.replace(/\.json$/, ".log");
  const log = (t) => appendFileSync(logFile, `[${new Date().toISOString()}] ${t}\n`);
  const release = tryLock(where.dir, where.commit, log);
  if (!release) return 0;
  // SIGHUP is handled like SIGTERM. Until buildBaseline starts the app and the container,
  // the handler stops the running child and releases the lock; after, it also cleans them up.
  signalHandler = () => {
    try {
      currentChild?.kill("SIGTERM");
    } catch {
      // Already gone.
    }
    rmSync(lockPath(where.dir), { recursive: true, force: true });
    process.exit(3);
  };
  for (const sig of SIGNALS) process.on(sig, () => signalHandler());
  try {
    if (existsSync(where.file) && !opts.refresh) return 0;
    await buildBaseline({ ...where, log });
    return 0;
  } catch (error) {
    log(`build failed: ${String(error.message ?? error).split("\n")[0]}`);
    return 2;
  } finally {
    release();
  }
}

async function cli(argv) {
  const opts = { base: null, refresh: false, status: false, build: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--base") opts.base = argv[++i];
    else if (arg === "--refresh") opts.refresh = true;
    else if (arg === "--status") opts.status = true;
    else if (arg === "--build") opts.build = true; // internal: the detached builder
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: npm run layout-baseline -- [--base <rev>] [--refresh] [--status]");
      return 0;
    } else {
      console.error(`layout-baseline: unknown option ${arg}`);
      return 2;
    }
  }
  try {
    if (opts.build) return await buildCli(opts);
    if (opts.status) {
      const w = locateBaseline({ base: opts.base });
      const built = w.cached ? builtFrom(w.file, w.commit) : null;
      console.log(`${w.cached ? "cached" : "not cached"}: key ${w.key.slice(0, 12)}, main ${w.commit.slice(0, 12)}${built && built !== w.commit ? `, rows built from ${built.slice(0, 12)}` : ""} (${w.file})`);
      const live = liveBuild(w.dir);
      if (live) console.log(`building now: main ${String(live.commit).slice(0, 12)}, ${live.stage} (pid ${live.pid})`);
      return 0;
    }
    const got = await resolveBaseline(opts);
    const data = JSON.parse(readFileSync(got.file, "utf8"));
    const blockers = data.blockers.filter((b) => (b.level ?? "blocker") === "blocker").length;
    console.log(`Baseline: main ${got.commit.slice(0, 12)}${got.cached ? " (cached)" : " (built now)"}, ${blockers} blockers. Use it with: npm run layout-check -- --url <app> --baseline main`);
    return 0;
  } catch (error) {
    console.error(`layout-baseline: ${String(error.message ?? error).split("\n")[0]}`);
    return 2;
  }
}

const invokedAsScript = (() => {
  try {
    return !!process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (invokedAsScript) {
  cli(process.argv.slice(2)).then((code) => {
    process.exitCode = code;
  });
}
