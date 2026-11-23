#!/usr/bin/env node
// Revenant layout baseline: the layout check's BLOCKER and polish rows on main, once per
// main commit. Owner-only (tools/**). See docs/agent-loop.md "Layout check".
//
//   npm run layout-baseline                 the baseline for the merge-base of HEAD and origin/main
//   npm run layout-baseline -- --status     says whether it is cached; builds nothing
//   npm run layout-baseline -- --base <rev> --refresh
//
// `npm run layout-check -- --baseline main` calls resolveBaseline() itself, so an agent
// never builds main by hand. The cache lives outside the worktree, in
// ~/kiro/revenant-crew/layout-baseline/ (REVENANT_LAYOUT_BASELINE_DIR overrides it):
//   <sha>.json                 the rows, when this checkout's check script is main's
//   <sha>-script-<hash>.json   the rows, when the check script differs (a platform-dev
//                              branch that edits tools/qa), so main is checked with it
//   <name>.log                 the build and check output of that baseline
//   work/                      the last main build; node_modules is kept while
//                              package-lock.json is unchanged
// On a cache miss it extracts the commit with `git archive`, runs npm ci (when the lockfile
// changed) and npm run build, starts a throwaway Postgres (docker run), migrates, seals
// the personas, fetches figures, starts the app with RP_ID=localhost so /demo/live works,
// runs the full check (every default size and stage group) and keeps the result. Only one
// build runs at a time; a second caller waits for it.

import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync, appendFileSync } from "node:fs";
import { createServer } from "node:net";
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

export function baselineDir(env = process.env) {
  return env.REVENANT_LAYOUT_BASELINE_DIR ? resolve(env.REVENANT_LAYOUT_BASELINE_DIR) : join(homedir(), "kiro", "revenant-crew", "layout-baseline");
}

// The cache file name. When the check scripts of this checkout are main's own, the name is
// just the commit; otherwise it carries a hash of the scripts, because main checked with a
// changed script is a different baseline.
export function baselineName({ commit, scripts, mainScripts }) {
  if (!/^[0-9a-f]{40}$/.test(commit)) throw new Error(`not a commit id: ${commit}`);
  const same = scripts.length === mainScripts.length && scripts.every((b, i) => b && b === mainScripts[i]);
  if (same) return `${commit}.json`;
  const hash = createHash("sha256").update(scripts.join("\n")).digest("hex").slice(0, 12);
  return `${commit}-script-${hash}.json`;
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

// The commit, cache file and whether it exists, without building anything.
export function locateBaseline({ base = null, cwd = process.cwd(), env = process.env } = {}) {
  const root = git(cwd, ["rev-parse", "--show-toplevel"]);
  const commit = base
    ? git(root, ["rev-parse", "--verify", `${base}^{commit}`])
    : git(root, ["merge-base", "HEAD", "origin/main"]);
  const scripts = [CHECK_SCRIPT, SCOPE_SCRIPT].map((p) => git(root, ["hash-object", p]));
  const mainScripts = ["tools/qa/layout-check.mjs", "tools/qa/layout-scope.mjs"].map((p) => gitOrNull(root, ["rev-parse", `${commit}:${p}`]));
  const dir = baselineDir(env);
  const file = join(dir, baselineName({ commit, scripts, mainScripts }));
  return { root, commit, dir, file, cached: existsSync(file) };
}

function readCached(file) {
  readBlockersFile(JSON.parse(readFileSync(file, "utf8")));
  return file;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === "EPERM";
  }
}

async function acquireLock(dir, commit, log) {
  const lock = join(dir, ".lock");
  const started = Date.now();
  let told = 0;
  for (;;) {
    try {
      mkdirSync(lock);
      writeFileSync(join(lock, "owner"), `${process.pid} ${hostname()} ${commit}\n`);
      return () => rmSync(lock, { recursive: true, force: true });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
    }
    let owner = "";
    try {
      owner = readFileSync(join(lock, "owner"), "utf8").trim();
    } catch {
      // Just created by the other process; its owner file follows.
    }
    const [pid, host] = owner.split(" ");
    const lockAge = Date.now() - (statSync(lock, { throwIfNoEntry: false })?.mtimeMs ?? Date.now());
    if ((pid && host === hostname() && !alive(Number(pid))) || (!pid && lockAge > 60_000)) {
      rmSync(lock, { recursive: true, force: true });
      continue;
    }
    if (Date.now() - started > LOCK_WAIT_MS) throw new Error(`another baseline build (${owner || "unknown"}) still holds ${lock} after ${LOCK_WAIT_MS / 60000} min`);
    if (Date.now() - told > 60_000) {
      log(`waiting for another baseline build to finish (${owner || "starting"})`);
      told = Date.now();
    }
    await sleep(5000);
  }
}

function run(cmd, args, { cwd, env = process.env, logFile, timeoutMs = 0 }) {
  return new Promise((resolvePromise) => {
    appendFileSync(logFile, `\n$ ${cmd} ${args.join(" ")}\n`);
    const child = spawn(cmd, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
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

async function buildBaseline({ root, commit, dir, file, log }) {
  const logFile = file.replace(/\.json$/, ".log");
  writeFileSync(logFile, `layout baseline for ${commit}, started ${new Date().toISOString()}\n`);
  log(`no cached baseline for main ${commit.slice(0, 12)}; building it (log: ${logFile})`);
  const work = join(dir, "work");
  mkdirSync(work, { recursive: true });
  for (const entry of readdirSync(work)) {
    if (entry !== "node_modules") rmSync(join(work, entry), { recursive: true, force: true });
  }
  await extract(root, commit, work, logFile);

  const lockHash = createHash("sha256").update(readFileSync(join(work, "package-lock.json"))).digest("hex");
  const marker = join(work, "node_modules", ".revenant-lock-sha256");
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1" };
  if (!existsSync(marker) || readFileSync(marker, "utf8").trim() !== lockHash) {
    log("npm ci");
    rmSync(join(work, "node_modules"), { recursive: true, force: true });
    await must("npm ci", run("npm", ["ci", "--no-audit", "--no-fund"], { cwd: work, env, logFile }));
    writeFileSync(marker, `${lockHash}\n`);
  }
  log("npm run build");
  await must("npm run build", run("npm", ["run", "build"], { cwd: work, env, logFile }));

  const container = `revenant-layout-baseline-${commit.slice(0, 12)}-${process.pid}`;
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
    cleanup().finally(() => process.exit(3));
  };
  process.once("SIGTERM", onSignal);
  process.once("SIGINT", onSignal);
  try {
    log("throwaway Postgres, migrations, personas, figures");
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
    app = spawn("npm", ["start"], { cwd: work, env: appEnv, detached: true, stdio: ["ignore", "pipe", "pipe"] });
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

    log(`full layout check of main on ${url}`);
    const tmp = `${file}.tmp-${process.pid}`;
    const shots = join(dir, `shots-${commit.slice(0, 12)}`);
    const code = await run(process.execPath, [CHECK_SCRIPT, "--url", url, "--shots", shots, "--save-blockers", tmp, "--quiet"], { cwd: root, logFile });
    if (code !== 0 && code !== 1) throw new Error(`the layout check of main did not finish (exit ${code})`);
    const data = readBlockersFile(JSON.parse(readFileSync(tmp, "utf8")));
    data.commit = commit;
    data.setup = { figures, rpId: "localhost", builtAt: new Date().toISOString() };
    writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
    renameSync(tmp, file);
    prune(dir, commit);
    const blockers = data.blockers.filter((b) => (b.level ?? "blocker") === "blocker").length;
    log(`main ${commit.slice(0, 12)}: ${blockers} blockers saved to ${file}`);
  } finally {
    process.off("SIGTERM", onSignal);
    process.off("SIGINT", onSignal);
    await cleanup();
  }
}

// Returns { file, commit, cached } for the baseline of `base` (default: the merge-base of
// HEAD and origin/main), building it first on a cache miss.
export async function resolveBaseline({ base = null, refresh = false, cwd = process.cwd(), log = (t) => console.error(`layout-baseline: ${t}`) } = {}) {
  const where = locateBaseline({ base, cwd });
  if (where.cached && !refresh) return { file: readCached(where.file), commit: where.commit, cached: true };
  mkdirSync(where.dir, { recursive: true });
  const release = await acquireLock(where.dir, where.commit, log);
  try {
    // Another caller may have built it while this one waited.
    if (existsSync(where.file) && !refresh) return { file: readCached(where.file), commit: where.commit, cached: true };
    await buildBaseline({ ...where, log });
    return { file: readCached(where.file), commit: where.commit, cached: false };
  } finally {
    release();
  }
}

async function cli(argv) {
  const opts = { base: null, refresh: false, status: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--base") opts.base = argv[++i];
    else if (arg === "--refresh") opts.refresh = true;
    else if (arg === "--status") opts.status = true;
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: npm run layout-baseline -- [--base <rev>] [--refresh] [--status]");
      return 0;
    } else {
      console.error(`layout-baseline: unknown option ${arg}`);
      return 2;
    }
  }
  try {
    if (opts.status) {
      const w = locateBaseline({ base: opts.base });
      console.log(`${w.cached ? "cached" : "not cached"}: main ${w.commit.slice(0, 12)} (${w.file})`);
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
